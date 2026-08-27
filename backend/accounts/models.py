from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        STUDENT = 'STUDENT', 'Student'
        VERIFIER = 'VERIFIER', 'Verifier'
        STAFF_ADVISOR = 'STAFF_ADVISOR', 'Staff Advisor'
        HOD = 'HOD', 'HOD'
        PRINCIPAL = 'PRINCIPAL', 'Principal'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    is_active_user = models.BooleanField(default=True)  # soft deactivate
    must_change_password = models.BooleanField(default=False)
    # Demo-only: stores last plain password so admin can view it. Not for production.
    # Hashed password (password field) remains the source of truth.
    admin_visible_password = models.CharField(max_length=128, blank=True, default='', help_text='Demo-only: last plain password set by admin (viewable).')

    def __str__(self):
        return f"{self.username} ({self.role})"


class VerificationType(models.Model):
    name = models.CharField(max_length=50, unique=True)  # e.g. Office, Library, Lab, etc
    slug = models.SlugField(unique=True)
    description = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.name


DEPT_CHOICES = [
    ('CS','CS'),('EC','EC'),('EEE','EEE'),('MECH','MECH'),('CIVIL','CIVIL'),('ALL','All'),
]
DIV_CHOICES = [('A','A'),('B','B'),('C','C'),('ALL','All')]
SEM_CHOICES = [(str(i), str(i)) for i in range(1,9)] + [('ALL','All')]

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    name = models.CharField(max_length=150)
    division = models.CharField(max_length=5, choices=[('A','A'),('B','B'),('C','C')])
    semester = models.CharField(max_length=2, choices=[(str(i),str(i)) for i in range(1,9)])
    department = models.CharField(max_length=10, choices=[('CS','CS'),('EC','EC'),('EEE','EEE'),('MECH','MECH'),('CIVIL','CIVIL')])
    address = models.TextField()
    is_hosteller = models.BooleanField(default=False)
    personal_email = models.EmailField()
    personal_phone = models.CharField(max_length=15)
    year_of_admission = models.IntegerField(null=True, blank=True)
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Student {self.name} - {self.user.username}"

class VerifierProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='verifier_profile')
    name = models.CharField(max_length=150)
    verification_type = models.CharField(max_length=50)  # Office, Placement, PTA, Bus, Lab, Library, Hostel etc or custom
    verifying_division = models.CharField(max_length=5, choices=DIV_CHOICES, default='ALL')
    verifying_semester = models.CharField(max_length=5, choices=SEM_CHOICES, default='ALL')
    verifying_department = models.CharField(max_length=10, choices=DEPT_CHOICES, default='ALL')
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Verifier {self.name} ({self.verification_type})"

class StaffAdvisorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_advisor_profile')
    name = models.CharField(max_length=150)
    verification_type = models.CharField(max_length=50, default='Staff Advisor')
    verifying_division = models.CharField(max_length=5, choices=[('A','A'),('B','B'),('C','C')])
    verifying_semester = models.CharField(max_length=2, choices=[(str(i),str(i)) for i in range(1,9)])
    verifying_department = models.CharField(max_length=10, choices=[('CS','CS'),('EC','EC'),('EEE','EEE'),('MECH','MECH'),('CIVIL','CIVIL')])
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class HODProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hod_profile')
    name = models.CharField(max_length=150)
    verification_type = models.CharField(max_length=50, default='HOD')
    verifying_division = models.CharField(max_length=5, default='All')  # always All
    verifying_semester = models.CharField(max_length=5, default='All')
    verifying_department = models.CharField(max_length=10, choices=[('CS','CS'),('EC','EC'),('EEE','EEE'),('MECH','MECH'),('CIVIL','CIVIL')])
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class PrincipalProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='principal_profile')
    name = models.CharField(max_length=150)
    verification_type = models.CharField(max_length=50, default='Principal')
    verifying_division = models.CharField(max_length=5, default='All')
    verifying_semester = models.CharField(max_length=5, default='All')
    verifying_department = models.CharField(max_length=10, default='All')
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
