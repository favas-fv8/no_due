from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .models import Submission, SectionStatus, UploadedFile, VerificationRequest, AuditLog, SECTION_ORDER, FILE_SECTIONS, REQUEST_SECTIONS
from .serializers import SubmissionSerializer, AuditLogSerializer, VerificationRequestSerializer
from .utils import get_or_create_submission, can_send_request, find_assignee
import os

User=get_user_model()

def is_admin(u): return u.role=='ADMIN'
def is_student(u): return u.role=='STUDENT'

class MySubmissionView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        if not is_student(request.user):
            return Response({"detail":"Only students have submissions"}, status=403)
        # check profile complete
        try:
            if not request.user.student_profile.is_complete:
                return Response({"detail":"Please complete your profile first"}, status=400)
        except:
            return Response({"detail":"Please complete your profile first"}, status=400)
        sub=get_or_create_submission(request.user)
        return Response(SubmissionSerializer(sub).data)

class UploadFileView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, section):
        if not is_student(request.user):
            return Response({"detail":"Only students"}, status=403)
        section=section.upper()
        if section not in FILE_SECTIONS:
            return Response({"detail":"Section does not accept file upload"}, status=400)
        # check profile
        try:
            if not request.user.student_profile.is_complete:
                return Response({"detail":"Complete profile first"}, status=400)
        except:
            return Response({"detail":"Complete profile first"}, status=400)
        # hostel check
        if section=='HOSTEL':
            try:
                if not request.user.student_profile.is_hosteller:
                    return Response({"detail":"Hostel section not required for day scholars"}, status=400)
            except:
                pass
        # sequential check? Office..Hostel can be uploaded any time? But staff onward is blocked. Allow file sections independent.
        # But ensure previous workflow not needed for first 7 sections
        sub=get_or_create_submission(request.user)
        try:
            ss=SectionStatus.objects.get(submission=sub, section=section)
        except:
            return Response({"detail":"Section not found"}, status=404)
        # if already approved, prevent re-upload? Allow re-upload if rejected/pending
        if ss.status=='APPROVED':
            return Response({"detail":"Section already approved, cannot re-upload"}, status=400)
        files=request.FILES.getlist('file') or ([request.FILES['file']] if 'file' in request.FILES else [])
        if not files or files[0].size==0:
            return Response({"detail":"No file provided"}, status=400)
        # hostel up to 5 - for REJECTED allow reupload (replace old files)
        if section=='HOSTEL':
            existing=ss.files.count()
            if ss.status=='REJECTED':
                if len(files) > 5:
                    return Response({"detail":f"Hostel allows max 5 files. You selected {len(files)}"}, status=400)
                # delete old rejected files so reupload can replace them (max 5)
                for old in ss.files.all():
                    try:
                        if old.file:
                            old.file.delete(save=False)
                    except:
                        pass
                    old.delete()
            else:
                if existing + len(files) > 5:
                    return Response({"detail":f"Hostel allows max 5 files. You have {existing}"}, status=400)
        else:
            # single file replace
            if len(files)>1:
                return Response({"detail":"Only one file allowed for this section"}, status=400)

        # validation
        allowed_pdf = ['application/pdf']
        allowed_img = ['image/jpeg','image/png','image/jpg','image/webp']
        for f in files:
            if f.size > 10*1024*1024:
                return Response({"detail":f"File {f.name} too large (max 10MB)"}, status=400)
            ct = f.content_type
            if section=='OFFICE':
                if ct not in allowed_pdf and not f.name.lower().endswith('.pdf'):
                    return Response({"detail":"Office requires PDF only"}, status=400)
            else:
                if ct not in allowed_img and not f.name.lower().endswith(('.png','.jpg','.jpeg','.webp')):
                    return Response({"detail":"This section requires image (jpg/png/webp)"}, status=400)

        # if non-hostel, delete old files
        if section!='HOSTEL':
            for old in ss.files.all():
                try:
                    if old.file:
                        old.file.delete(save=False)
                except:
                    pass
                old.delete()

        created_files=[]
        for f in files:
            # determine file_type
            ft='pdf' if f.name.lower().endswith('.pdf') else 'image'
            uf=UploadedFile.objects.create(section_status=ss, file=f, original_name=f.name, file_type=ft, size=f.size, uploaded_by=request.user)
            created_files.append(uf.id)

        # after upload, create or update VerificationRequest for file sections, auto-assign
        assignee=find_assignee(section, request.user)
        vr, created = VerificationRequest.objects.get_or_create(section_status=ss, defaults={'student':request.user,'section':section,'assigned_to':assignee,'status':'PENDING'})
        if not created:
            vr.status='PENDING'
            vr.assigned_to=assignee
            vr.save()
            # reset section status to pending if was rejected
            if ss.status=='REJECTED':
                ss.status='PENDING'
                ss.remark=''
                ss.save()

        # audit
        AuditLog.objects.create(submission=sub, section=section, action='upload', performed_by=request.user, from_status=ss.status, to_status='PENDING', remark=f"Uploaded {len(files)} file(s)")

        # refresh
        ss.refresh_from_db()
        return Response({"detail":"Upload successful","files":created_files, "assigned_to": assignee.username if assignee else None})

class SendRequestView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, section):
        if not is_student(request.user):
            return Response({"detail":"Only students"}, status=403)
        section=section.upper()
        if section not in REQUEST_SECTIONS:
            return Response({"detail":"Use file upload for this section"}, status=400)
        try:
            if not request.user.student_profile.is_complete:
                return Response({"detail":"Complete profile first"}, status=400)
        except:
            return Response({"detail":"Complete profile first"}, status=400)
        sub=get_or_create_submission(request.user)
        # First 7 sections (Office..Library) are independent - no sequential check
        FIRST_SEVEN = ['OFFICE','PLACEMENT','PTA','BUS','LAB','HOSTEL','LIBRARY']
        if section not in FIRST_SEVEN:
            can, msg = can_send_request(sub, section)
            if not can:
                return Response({"detail":msg}, status=400)
        try:
            ss=SectionStatus.objects.get(submission=sub, section=section)
        except:
            return Response({"detail":"Section not found"}, status=404)
        if ss.status=='APPROVED':
            return Response({"detail":"Already approved"}, status=400)
        if section in ('LAB','LIBRARY') and ss.status=='PENDING' and hasattr(ss,'request'):
            # check if already pending request
            try:
                if ss.request.status=='PENDING':
                    return Response({"detail":"Request already sent, awaiting verification"}, status=400)
            except:
                pass

        assignee=find_assignee(section, request.user)
        # allow request even if no assignee found (assign to None, admin can route) - fixes 400 for STAFF/HOD/PRINCIPAL
        if section in ('STAFF_ADVISOR','HOD','PRINCIPAL') and not assignee:
            pass
        if section in ('LAB','LIBRARY') and not assignee:
            # allow unassigned but warn
            pass

        vr, created = VerificationRequest.objects.get_or_create(section_status=ss, defaults={'student':request.user,'section':section,'assigned_to':assignee,'status':'PENDING'})
        if not created:
            # if rejected, allow resend
            if vr.status=='REJECTED' or ss.status=='REJECTED':
                vr.status='PENDING'
                vr.assigned_to=assignee
                vr.save()
                ss.status='PENDING'
                ss.remark=''
                ss.save()
            else:
                return Response({"detail":"Request already exists with status "+vr.status}, status=400)
        # audit
        AuditLog.objects.create(submission=sub, section=section, action='send_request', performed_by=request.user, from_status=ss.status, to_status='PENDING', remark=f"Sent request to {assignee.username if assignee else 'verifier'}")
        return Response({"detail":"Request sent successfully","assigned_to": assignee.username if assignee else None})

class DeleteFileView(APIView):
    permission_classes=[IsAuthenticated]
    def delete(self, request, file_id):
        if not is_student(request.user):
            return Response({"detail":"Only students can remove files"}, status=403)
        try:
            uf = UploadedFile.objects.select_related('section_status','section_status__submission').get(id=file_id, uploaded_by=request.user)
        except UploadedFile.DoesNotExist:
            return Response({"detail":"File not found or not owned by you"}, status=404)
        ss = uf.section_status
        # cannot remove if already approved
        if ss.status == 'APPROVED':
            return Response({"detail":"Cannot remove file: section already Approved. Contact verifier/admin."}, status=400)
        sub = ss.submission
        # hostel special: allow removing one file even if others remain
        # delete file from storage
        try:
            if uf.file:
                uf.file.delete(save=False)
        except:
            pass
        section = ss.section
        uf.delete()
        # if no files left for this section and section is file-based and status is PENDING/REJECTED, delete VerificationRequest
        remaining = ss.files.count()
        if remaining == 0 and ss.section in FILE_SECTIONS:
            try:
                vr = ss.request
                vr.delete()
            except VerificationRequest.DoesNotExist:
                pass
            # keep status PENDING (or REJECTED -> PENDING)
            if ss.status == 'REJECTED':
                ss.status = 'PENDING'
                ss.remark = ''
                ss.save()
        # audit
        AuditLog.objects.create(submission=sub, section=section, action='remove_file', performed_by=request.user, from_status=ss.status, to_status=ss.status, remark=f"Removed file {uf.original_name}")
        return Response({"detail":"File removed successfully", "remaining": remaining})

class UndoSectionView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, section):
        if not is_student(request.user):
            return Response({"detail":"Only students"}, status=403)
        section = section.upper()
        if section not in SECTION_ORDER:
            return Response({"detail":"Invalid section"}, status=400)
        if section == 'FINAL':
            return Response({"detail":"Cannot undo Final Status"}, status=400)
        sub = get_or_create_submission(request.user)
        try:
            ss = SectionStatus.objects.get(submission=sub, section=section)
        except SectionStatus.DoesNotExist:
            return Response({"detail":"Section not found"}, status=404)
        if ss.status == 'APPROVED':
            return Response({"detail":"Cannot undo: section already Approved. Contact admin."}, status=400)
        if ss.status == 'NOT_REQUIRED':
            return Response({"detail":"Section not required"}, status=400)
        # For hostel, check hosteller
        if section == 'HOSTEL' and not request.user.student_profile.is_hosteller:
            return Response({"detail":"Hostel not required"}, status=400)
        # delete all files for file sections
        if section in FILE_SECTIONS:
            for uf in ss.files.all():
                try:
                    if uf.file:
                        uf.file.delete(save=False)
                except:
                    pass
                uf.delete()
        # delete verification request if exists
        try:
            vr = ss.request
            vr.delete()
        except VerificationRequest.DoesNotExist:
            pass
        old_status = ss.status
        ss.status = 'PENDING'
        ss.remark = ''
        ss.verifier = None
        ss.save()
        AuditLog.objects.create(submission=sub, section=section, action='undo', performed_by=request.user, from_status=old_status, to_status='PENDING', remark=f"Undid {section} submission/request")
        return Response({"detail":f"{section} undone successfully. You can re-upload / re-send."})

class AuditLogView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        # student sees own, admin sees all, verifier sees assigned?
        user=request.user
        if is_student(user):
            sub=get_or_create_submission(user)
            logs=AuditLog.objects.filter(submission=sub)
        elif is_admin(user):
            sid=request.query_params.get('submission')
            if sid:
                logs=AuditLog.objects.filter(submission_id=sid)
            else:
                logs=AuditLog.objects.all()[:200]
        else:
            # verifier: show logs for requests assigned to them?
            logs=AuditLog.objects.all()[:100]
        return Response(AuditLogSerializer(logs, many=True).data)

class AdminSubmissionListView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        if not is_admin(request.user):
            return Response({"detail":"Forbidden"}, status=403)
        subs=Submission.objects.all().select_related('student')
        # filters
        dept=request.query_params.get('department')
        sem=request.query_params.get('semester')
        div=request.query_params.get('division')
        status_filter=request.query_params.get('status')
        # need to filter via student profile
        if dept:
            subs=subs.filter(student__student_profile__department=dept)
        if sem:
            subs=subs.filter(student__student_profile__semester=sem)
        if div:
            subs=subs.filter(student__student_profile__division=div)
        data=SubmissionSerializer(subs, many=True).data
        if status_filter:
            data=[d for d in data if d['overall']==status_filter]
        return Response(data)

class AdminSubmissionDetailView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request, pk):
        if not is_admin(request.user):
            return Response({"detail":"Forbidden"}, status=403)
        try:
            sub=Submission.objects.get(pk=pk)
        except:
            return Response({"detail":"Not found"}, status=404)
        logs=AuditLog.objects.filter(submission=sub)
        return Response({"submission":SubmissionSerializer(sub).data, "logs":AuditLogSerializer(logs,many=True).data})
