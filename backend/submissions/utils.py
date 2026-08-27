from .models import Submission, SectionStatus, SECTION_ORDER

def get_or_create_submission(user):
    sub, created = Submission.objects.get_or_create(student=user)
    # ensure all SectionStatus exist
    for sec in SECTION_ORDER:
        ss, c = SectionStatus.objects.get_or_create(submission=sub, section=sec, defaults={'status':'PENDING'})
        # handle hostel not required
        if sec=='HOSTEL':
            try:
                is_host = user.student_profile.is_hosteller
            except:
                is_host = False
            if not is_host and ss.status=='PENDING':
                # mark NOT_REQUIRED? But spec says Pending until? We'll keep PENDING but allow bypass.
                # Instead set NOT_REQUIRED for non-hosteller initially
                if c:
                    ss.status='NOT_REQUIRED'
                    ss.save()
                # else keep existing
                pass
    # update hostel status if hosteller changed
    try:
        is_host = user.student_profile.is_hosteller
        ss = SectionStatus.objects.get(submission=sub, section='HOSTEL')
        if not is_host and ss.status!='NOT_REQUIRED':
            # if not hosteller, mark not required if pending
            if ss.status=='PENDING':
                ss.status='NOT_REQUIRED'
                ss.save()
        elif is_host and ss.status=='NOT_REQUIRED':
            ss.status='PENDING'
            ss.save()
    except Exception:
        pass
    return sub

def can_send_request(submission, section):
    """Check sequential workflow: all previous sections must be APPROVED (or NOT_REQUIRED for hostel)"""
    order = SECTION_ORDER
    try:
        idx = order.index(section)
    except:
        return False, "Invalid section"
    # previous sections
    for prev in order[:idx]:
        try:
            ss = SectionStatus.objects.get(submission=submission, section=prev)
            if prev=='HOSTEL':
                # if not hosteller, skip check (NOT_REQUIRED counts as approved)
                if ss.status=='NOT_REQUIRED':
                    continue
            if ss.status!='APPROVED':
                return False, f"Previous section {prev} not approved yet ({ss.status})"
        except SectionStatus.DoesNotExist:
            return False, f"Previous section {prev} not found"
    return True, "ok"

def find_assignee(section, student):
    """Find assignee for staff/advisor/hod/principal"""
    from django.contrib.auth import get_user_model
    User=get_user_model()
    try:
        sp = student.student_profile
    except:
        return None

    if section=='STAFF_ADVISOR':
        # find Staff Advisor matching dept, division, semester - with fallbacks
        from accounts.models import StaffAdvisorProfile
        qs = StaffAdvisorProfile.objects.filter(verifying_department=sp.department, verifying_division=sp.division, verifying_semester=sp.semester)
        if qs.exists():
            return qs.first().user
        # fallback: any advisor for same department
        qs2 = StaffAdvisorProfile.objects.filter(verifying_department=sp.department)
        if qs2.exists():
            return qs2.first().user
        qs_all = StaffAdvisorProfile.objects.filter(verifying_department__in=['ALL','All'])
        if qs_all.exists():
            return qs_all.first().user
        # final fallback: any staff advisor
        if StaffAdvisorProfile.objects.exists():
            return StaffAdvisorProfile.objects.first().user
        return None
    elif section=='HOD':
        from accounts.models import HODProfile
        qs = HODProfile.objects.filter(verifying_department=sp.department)
        if qs.exists():
            return qs.first().user
        qs_all = HODProfile.objects.filter(verifying_department__in=['ALL','All'])
        if qs_all.exists():
            return qs_all.first().user
        if HODProfile.objects.exists():
            return HODProfile.objects.first().user
        return None
    elif section=='PRINCIPAL':
        from accounts.models import PrincipalProfile
        prof = PrincipalProfile.objects.first()
        if prof:
            return prof.user
        # fallback find user with role principal
        try:
            return User.objects.filter(role='PRINCIPAL').first()
        except:
            return None
    elif section in ('LAB','LIBRARY'):
        from accounts.models import VerifierProfile
        # verifier type = section name capitalized
        vtype = 'Lab' if section=='LAB' else 'Library'
        # filter by department? spec says verifiers receive only requests matching their configured type, dept, division, semester
        # For Lab/Library, they have verifying_dept etc
        # We assign to first matching verifier; if none, leave unassigned but visible to matching verifiers
        qs = VerifierProfile.objects.filter(verification_type__iexact=vtype)
        # try exact match dept/div/sem
        for vp in qs:
            dept_match = vp.verifying_department in (sp.department,'ALL','All')
            div_match = vp.verifying_division in (sp.division,'ALL','All')
            sem_match = vp.verifying_semester in (sp.semester,'ALL','All')
            if dept_match and div_match and sem_match:
                return vp.user
        # fallback any lab/library verifier
        if qs.exists():
            return qs.first().user
        return None
    else:
        # Office, Placement, PTA, Bus, Hostel are file uploads, but they also need verifier?
        # They will be verified by verifier with matching type
        from accounts.models import VerifierProfile
        mapping = {'OFFICE':'Office','PLACEMENT':'Placement','PTA':'PTA','BUS':'Bus Maintenance','HOSTEL':'Hostel'}
        vtype = mapping.get(section)
        if vtype:
            qs = VerifierProfile.objects.filter(verification_type__iexact=vtype)
            try:
                sp2=student.student_profile
            except:
                return qs.first().user if qs.exists() else None
            for vp in qs:
                dept_match = vp.verifying_department in (sp2.department,'ALL','All')
                div_match = vp.verifying_division in (sp2.division,'ALL','All')
                sem_match = vp.verifying_semester in (sp2.semester,'ALL','All')
                if dept_match and div_match and sem_match:
                    return vp.user
            if qs.exists():
                return qs.first().user
        return None
