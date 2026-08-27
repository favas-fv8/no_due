from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from submissions.models import VerificationRequest, SectionStatus, AuditLog, FILE_SECTIONS, SECTION_ORDER
from submissions.serializers import VerificationRequestSerializer, SectionStatusSerializer
from accounts.models import VerifierProfile, StaffAdvisorProfile, HODProfile, PrincipalProfile

def get_inbox_requests(user):
    # returns queryset of VerificationRequest relevant to user
    if user.role=='VERIFIER':
        try:
            vp=user.verifier_profile
        except:
            return VerificationRequest.objects.none()
        # Strict filtering: only requests whose section matches verifier's verification_type
        # Normalize verification_type -> section key
        vt = (vp.verification_type or '').strip().lower()
        type_to_section = {
            'office': 'OFFICE',
            'placement': 'PLACEMENT',
            'pta': 'PTA',
            'bus': 'BUS',
            'bus maintenance': 'BUS',
            'hostel': 'HOSTEL',
            'lab': 'LAB',
            'library': 'LIBRARY',
        }
        allowed_section = type_to_section.get(vt)
        if not allowed_section:
            # unknown type - fallback to no results to avoid leaking other sections
            return VerificationRequest.objects.none()
        # all requests for this section (any status - status filter applied in InboxView)
        qs = VerificationRequest.objects.filter(section=allowed_section).select_related('student','section_status')
        filtered = []
        for vr in qs:
            try:
                sp=vr.student.student_profile
            except:
                continue
            dept_ok = vp.verifying_department in ('ALL','All', sp.department)
            div_ok = vp.verifying_division in ('ALL','All', sp.division)
            sem_ok = vp.verifying_semester in ('ALL','All', sp.semester)
            if dept_ok and div_ok and sem_ok:
                filtered.append(vr.id)
        # also include directly assigned requests but ONLY for the allowed section
        assigned = VerificationRequest.objects.filter(assigned_to=user, section=allowed_section)
        ids=set(filtered) | set(assigned.values_list('id', flat=True))
        return VerificationRequest.objects.filter(id__in=ids).select_related('student','section_status')
    elif user.role=='STAFF_ADVISOR':
        try:
            spf=user.staff_advisor_profile
        except:
            return VerificationRequest.objects.none()
        qs=VerificationRequest.objects.filter(section='STAFF_ADVISOR', status='PENDING').select_related('student')
        filtered=[]
        for vr in qs:
            try:
                sprof=vr.student.student_profile
            except:
                continue
            if sprof.department==spf.verifying_department and sprof.division==spf.verifying_division and sprof.semester==spf.verifying_semester:
                filtered.append(vr.id)
        # also assigned
        assigned=VerificationRequest.objects.filter(assigned_to=user)
        ids=set(filtered) | set(assigned.values_list('id', flat=True))
        return VerificationRequest.objects.filter(id__in=ids)
    elif user.role=='HOD':
        try:
            hp=user.hod_profile
        except:
            return VerificationRequest.objects.none()
        qs=VerificationRequest.objects.filter(section='HOD', status='PENDING').select_related('student')
        filtered=[]
        for vr in qs:
            try:
                sprof=vr.student.student_profile
            except:
                continue
            if sprof.department==hp.verifying_department:
                filtered.append(vr.id)
        assigned=VerificationRequest.objects.filter(assigned_to=user)
        ids=set(filtered) | set(assigned.values_list('id', flat=True))
        return VerificationRequest.objects.filter(id__in=ids)
    elif user.role=='PRINCIPAL':
        return VerificationRequest.objects.filter(section='PRINCIPAL').select_related('student')
    else:
        return VerificationRequest.objects.none()

class InboxView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        if request.user.role in ('STUDENT','ADMIN'):
            return Response({"detail":"No inbox for this role"}, status=400)
        qs=get_inbox_requests(request.user)
        # filter status param
        status_filter=request.query_params.get('status')
        if status_filter:
            qs=qs.filter(status=status_filter)
        # search?
        return Response(VerificationRequestSerializer(qs, many=True).data)


class VerifierSearchView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        if request.user.role not in ('VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL'):
            return Response({"detail":"Only verifiers can search"}, status=403)
        student_id = request.query_params.get('student_id') or request.query_params.get('username') or request.query_params.get('q')
        if not student_id:
            return Response({"detail":"Provide student_id query param (student username or id)"}, status=400)
        student_id = str(student_id).strip()
        # optional year filter - must follow existing constraints plus year match
        year_param = request.query_params.get('year_of_admission') or request.query_params.get('year')
        selected_year = None
        if year_param and str(year_param).strip() not in ('', 'ALL', 'All', 'all'):
            try:
                selected_year = int(str(year_param).strip())
            except:
                return Response({"detail":f"Invalid year '{year_param}'"}, status=400)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        from accounts.models import StudentProfile
        from submissions.models import Submission
        from submissions.serializers import SubmissionSerializer
        from accounts.serializers import StudentProfileSerializer
        # lookup student by username (case-sensitive) or by id if numeric
        try:
            if student_id.isdigit():
                stu = User.objects.filter(id=int(student_id), role='STUDENT').first()
                if not stu:
                    stu = User.objects.filter(username=student_id, role='STUDENT').first()
            else:
                stu = User.objects.filter(username=student_id, role='STUDENT').first()
            if not stu:
                # try case-insensitive username
                stu = User.objects.filter(username__iexact=student_id, role='STUDENT').first()
            if not stu:
                return Response({"detail":f"Student user id '{student_id}' does not exist or is not a student"}, status=404)
        except Exception as e:
            return Response({"detail":f"Invalid student id '{student_id}': {str(e)}"}, status=400)
        # check profile exists
        try:
            prof = stu.student_profile
        except StudentProfile.DoesNotExist:
            return Response({"detail":f"Student '{stu.username}' has no profile yet"}, status=404)
        # check verifier scope filtering - including year filter following all existing constrains
        user = request.user
        allowed = True
        reason = ""
        # year filter first (if selected)
        if selected_year is not None:
            if prof.year_of_admission is None or int(prof.year_of_admission) != int(selected_year):
                reason = f"Student '{stu.username}' year of admission is {prof.year_of_admission if prof.year_of_admission is not None else 'not set'} but you selected Year {selected_year}. No match."
                return Response({"detail": reason}, status=403)
        if user.role == 'VERIFIER':
            try:
                vp = user.verifier_profile
                # check dept/div/sem
                dept_ok = vp.verifying_department in ('ALL','All', prof.department)
                div_ok = vp.verifying_division in ('ALL','All', prof.division)
                sem_ok = vp.verifying_semester in ('ALL','All', prof.semester)
                if not (dept_ok and div_ok and sem_ok):
                    allowed = False
                    reason = f"Student '{stu.username}' is in {prof.department}/{prof.division}/Sem {prof.semester} but your verifier profile allows only {vp.verifying_department}/{vp.verifying_division}/Sem {vp.verifying_semester}. No access to this department."
                # also check verification_type vs student's sections? For search we just check dept scope, but also inform about verification_type
                # we still allow to view student's profile even if no request for your type exists
            except Exception as e:
                allowed = False
                reason = f"Verifier profile incomplete: {str(e)}"
        elif user.role == 'STAFF_ADVISOR':
            try:
                spf = user.staff_advisor_profile
                if not (prof.department==spf.verifying_department and prof.division==spf.verifying_division and prof.semester==spf.verifying_semester):
                    allowed=False
                    reason=f"Student '{stu.username}' is in {prof.department}/{prof.division}/Sem {prof.semester} but your Staff Advisor profile is for {spf.verifying_department}/{spf.verifying_division}/Sem {spf.verifying_semester}. No access."
            except Exception as e:
                allowed=False
                reason=str(e)
        elif user.role == 'HOD':
            try:
                hp = user.hod_profile
                if prof.department != hp.verifying_department and hp.verifying_department not in ('ALL','All'):
                    allowed=False
                    reason=f"Student '{stu.username}' is in department {prof.department} but your HOD profile is for {hp.verifying_department}. No access to this department."
            except Exception as e:
                allowed=False
                reason=str(e)
        elif user.role == 'PRINCIPAL':
            allowed=True
        if not allowed:
            return Response({"detail": reason or f"Student '{stu.username}' is not in your allowed scope"}, status=403)
        # fetch submission - only return verifier's verification_type data (not all verification data)
        from submissions.utils import get_or_create_submission
        try:
            sub = get_or_create_submission(stu)
            # also fetch requests that are in verifier's inbox for this student (already filtered to your type)
            inbox_qs = get_inbox_requests(user).filter(student=stu)
            from submissions.serializers import AuditLogSerializer, SubmissionSerializer
            from submissions.models import AuditLog
            # base logs for this student
            logs_qs = AuditLog.objects.filter(submission=sub).order_by('-timestamp')
            sub_data = SubmissionSerializer(sub).data
            # filter to only verification_type section
            if user.role == 'VERIFIER':
                try:
                    vp = user.verifier_profile
                    vt = (vp.verification_type or '').strip().lower()
                    type_to_section = {
                        'office':'OFFICE','placement':'PLACEMENT','pta':'PTA',
                        'bus':'BUS','bus maintenance':'BUS','hostel':'HOSTEL',
                        'lab':'LAB','library':'LIBRARY',
                    }
                    allowed = type_to_section.get(vt)
                    if allowed:
                        sub_data['sections'] = [s for s in sub_data['sections'] if s['section']==allowed]
                        logs_qs = logs_qs.filter(section=allowed)
                except: pass
            elif user.role == 'STAFF_ADVISOR':
                sub_data['sections'] = [s for s in sub_data['sections'] if s['section']=='STAFF_ADVISOR']
                logs_qs = logs_qs.filter(section='STAFF_ADVISOR')
            elif user.role == 'HOD':
                sub_data['sections'] = [s for s in sub_data['sections'] if s['section']=='HOD']
                logs_qs = logs_qs.filter(section='HOD')
            elif user.role == 'PRINCIPAL':
                sub_data['sections'] = [s for s in sub_data['sections'] if s['section']=='PRINCIPAL']
                logs_qs = logs_qs.filter(section='PRINCIPAL')
            logs = logs_qs[:50]
        except Exception as e:
            return Response({"detail":f"Error fetching data: {str(e)}"}, status=500)
        return Response({
            "student": {
                "id": stu.id,
                "username": stu.username,
                "email": stu.email,
                "profile": StudentProfileSerializer(prof).data,
            },
            "submission": sub_data,
            "requests": VerificationRequestSerializer(inbox_qs, many=True).data,
            "logs": AuditLogSerializer(logs, many=True).data,
        })

class RequestDetailView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request, pk):
        try:
            vr=VerificationRequest.objects.select_related('student','section_status','assigned_to').get(pk=pk)
        except:
            return Response({"detail":"Not found"}, status=404)
        # strict verification_type check for VERIFIER role
        if request.user.role=='VERIFIER':
            try:
                vp=request.user.verifier_profile
                vt=(vp.verification_type or '').strip().lower()
                type_to_section={
                    'office':'OFFICE','placement':'PLACEMENT','pta':'PTA',
                    'bus':'BUS','bus maintenance':'BUS','hostel':'HOSTEL',
                    'lab':'LAB','library':'LIBRARY',
                }
                allowed_section=type_to_section.get(vt)
                if allowed_section and vr.section != allowed_section:
                    return Response({"detail":f"Not authorized: your verification type is '{vp.verification_type}' ({allowed_section}), but request is for '{vr.section}'"}, status=403)
            except Exception:
                pass
        # check permission
        if request.user.role=='ADMIN':
            pass
        elif request.user.role=='STUDENT' and vr.student!=request.user:
            return Response({"detail":"Forbidden"}, status=403)
        elif request.user.role not in ('ADMIN','STUDENT'):
            inbox=get_inbox_requests(request.user)
            if vr.id not in inbox.values_list('id', flat=True) and vr.assigned_to!=request.user:
                # still allow if matches filters? for safety allow if assigned or in inbox
                # if not, deny
                if request.user.role!='PRINCIPAL':
                    # check if verifier type matches?
                    pass
                pass
            # re-enforce strict type filtering for verifier even if inbox check passed via fallback
            if request.user.role=='VERIFIER':
                try:
                    vp=request.user.verifier_profile
                    vt=(vp.verification_type or '').strip().lower()
                    type_to_section={
                        'office':'OFFICE','placement':'PLACEMENT','pta':'PTA',
                        'bus':'BUS','bus maintenance':'BUS','hostel':'HOSTEL',
                        'lab':'LAB','library':'LIBRARY',
                    }
                    allowed_section=type_to_section.get(vt)
                    if allowed_section and vr.section != allowed_section:
                        return Response({"detail":"Not authorized for this verification type"}, status=403)
                except Exception:
                    pass
        from submissions.serializers import UploadedFileSerializer, SubmissionSerializer
        data=VerificationRequestSerializer(vr).data
        # include section status details
        try:
            ss=vr.section_status
            data['section_status']=SectionStatusSerializer(ss).data
            # audit logs for this section only — strictly filtered to request's section (= verifier's verification_type)
            logs=AuditLog.objects.filter(submission=ss.submission, section=ss.section)
            # extra safety: for VERIFIER, ensure logs section matches allowed verification_type
            if request.user.role=='VERIFIER':
                try:
                    vp=request.user.verifier_profile
                    vt=(vp.verification_type or '').strip().lower()
                    type_to_section={
                        'office':'OFFICE','placement':'PLACEMENT','pta':'PTA',
                        'bus':'BUS','bus maintenance':'BUS','hostel':'HOSTEL',
                        'lab':'LAB','library':'LIBRARY',
                    }
                    allowed_section=type_to_section.get(vt)
                    if allowed_section:
                        logs=logs.filter(section=allowed_section)
                except Exception:
                    pass
            from submissions.serializers import AuditLogSerializer
            data['logs']=AuditLogSerializer(logs,many=True).data
            # include full submission for context so verifier can see all uploaded proofs
            # Staff Advisor / HOD / Principal need to see previous sections' files
            data['submission']=SubmissionSerializer(ss.submission).data
        except:
            data['section_status']=None
            data['submission']=None
        return Response(data)

class VerifyActionView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, pk):
        if request.user.role in ('STUDENT','ADMIN'):
            return Response({"detail":"Not allowed"}, status=403)
        try:
            vr=VerificationRequest.objects.select_related('section_status','student').get(pk=pk)
        except:
            return Response({"detail":"Not found"}, status=404)
        # check inbox permission
        inbox=get_inbox_requests(request.user)
        if vr.id not in inbox.values_list('id', flat=True):
            # also allow if assigned_to
            if vr.assigned_to != request.user:
                return Response({"detail":"Not authorized for this request"}, status=403)
        action=request.data.get('action')  # approve / reject
        remark=request.data.get('remark','')
        if action not in ('APPROVE','REJECT','APPROVED','REJECTED'):
            return Response({"detail":"action must be APPROVE or REJECT"}, status=400)
        new_status='APPROVED' if action.startswith('APPROVE') else 'REJECTED'
        # update both VerificationRequest and SectionStatus
        old_status=vr.status
        vr.status=new_status
        vr.save()
        ss=vr.section_status
        ss_old=ss.status
        ss.status=new_status
        ss.remark=remark
        ss.verifier=request.user
        ss.save()
        # audit log
        AuditLog.objects.create(submission=ss.submission, section=ss.section, action='approve' if new_status=='APPROVED' else 'reject', performed_by=request.user, from_status=ss_old, to_status=new_status, remark=remark)
        return Response({"detail":f"Marked {new_status}", "section": ss.section, "status": ss.status})

# For admin to see all requests
class AllRequestsView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        qs=VerificationRequest.objects.all().select_related('student').order_by('-created_at')
        section=request.query_params.get('section')
        status_f=request.query_params.get('status')
        if section:
            qs=qs.filter(section=section.upper())
        if status_f:
            qs=qs.filter(status=status_f.upper())
        return Response(VerificationRequestSerializer(qs, many=True).data)
