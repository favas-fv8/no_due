from django.db import models
from django.conf import settings

SECTION_CHOICES = [
    ('OFFICE','Office'),
    ('PLACEMENT','Placement'),
    ('PTA','PTA'),
    ('BUS','Bus Maintenance'),
    ('LAB','Lab'),
    ('HOSTEL','Hostel'),
    ('LIBRARY','Library'),
    ('STAFF_ADVISOR','Staff Advisor'),
    ('HOD','HOD'),
    ('PRINCIPAL','Principal'),
]

STATUS_CHOICES = [
    ('PENDING','Pending'),
    ('APPROVED','Approved'),
    ('REJECTED','Rejected'),
    ('NOT_REQUIRED','Not Required'),
]

SECTION_ORDER = ['OFFICE','PLACEMENT','PTA','BUS','LAB','HOSTEL','LIBRARY','STAFF_ADVISOR','HOD','PRINCIPAL']

# which sections need file upload vs request
FILE_SECTIONS = {'OFFICE','PLACEMENT','PTA','BUS','HOSTEL'}
REQUEST_SECTIONS = {'LAB','LIBRARY','STAFF_ADVISOR','HOD','PRINCIPAL'}

class Submission(models.Model):
    student = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submission')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Submission {self.student.username}"

    def overall_status(self):
        # check each section status; need to consider hostel not required if not hosteller
        sections = self.sections.all()
        sec_map = {s.section: s.status for s in sections}
        # ensure all exist
        for sec in SECTION_ORDER:
            st = sec_map.get(sec, 'PENDING')
            if sec=='HOSTEL':
                # check hosteller
                try:
                    is_hosteller = self.student.student_profile.is_hosteller
                except:
                    is_hosteller = False
                if not is_hosteller:
                    continue  # not required
            if st != 'APPROVED':
                return 'PENDING'
        return 'APPROVED'

class SectionStatus(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='sections')
    section = models.CharField(max_length=20, choices=SECTION_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    remark = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    verifier = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_sections')

    class Meta:
        unique_together = ('submission','section')
        ordering = ['id']

    def __str__(self):
        return f"{self.submission.student.username} - {self.section}: {self.status}"

class UploadedFile(models.Model):
    section_status = models.ForeignKey(SectionStatus, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='uploads/%Y/%m/%d/')
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20)  # pdf/image
    size = models.IntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.original_name} ({self.section_status.section})"

class VerificationRequest(models.Model):
    section_status = models.OneToOneField(SectionStatus, on_delete=models.CASCADE, related_name='request')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_requests')
    section = models.CharField(max_length=20, choices=SECTION_CHOICES)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_requests')
    # for lab/library etc, assigned_to can be null until matched? Or we store target logic.
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Req {self.student.username} {self.section} -> {self.assigned_to}"

class AuditLog(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='audit_logs')
    section = models.CharField(max_length=20, choices=SECTION_CHOICES)
    action = models.CharField(max_length=50)  # upload, send_request, approve, reject
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    from_status = models.CharField(max_length=15, blank=True)
    to_status = models.CharField(max_length=15, blank=True)
    remark = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Audit {self.section} {self.action} by {self.performed_by}"
