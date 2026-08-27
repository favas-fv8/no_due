from rest_framework import serializers
from .models import Submission, SectionStatus, UploadedFile, VerificationRequest, AuditLog

class UploadedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedFile
        fields = ['id','file','original_name','file_type','size','uploaded_at']

class SectionStatusSerializer(serializers.ModelSerializer):
    files = UploadedFileSerializer(many=True, read_only=True)
    has_request = serializers.SerializerMethodField()
    class Meta:
        model = SectionStatus
        fields = ['id','section','status','remark','updated_at','verifier','files','has_request']
    def get_has_request(self, obj):
        try:
            return hasattr(obj, 'request') and obj.request is not None
        except:
            return False

class SubmissionSerializer(serializers.ModelSerializer):
    sections = SectionStatusSerializer(many=True, read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_name = serializers.SerializerMethodField()
    overall = serializers.SerializerMethodField()
    hostel_required = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = ['id','student','student_username','student_name','sections','overall','hostel_required','created_at','updated_at']

    def get_student_name(self, obj):
        try:
            return obj.student.student_profile.name
        except:
            return obj.student.username
    def get_overall(self, obj):
        return obj.overall_status()
    def get_hostel_required(self, obj):
        try:
            return obj.student.student_profile.is_hosteller
        except:
            return False

class AuditLogSerializer(serializers.ModelSerializer):
    performed_by_username = serializers.CharField(source='performed_by.username', read_only=True, default=None)
    class Meta:
        model = AuditLog
        fields = ['id','section','action','performed_by','performed_by_username','from_status','to_status','remark','timestamp']

class VerificationRequestSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_name = serializers.SerializerMethodField()
    student_profile = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    class Meta:
        model = VerificationRequest
        fields = ['id','section','student','student_username','student_name','student_profile','assigned_to','status','created_at','updated_at','files']
    def get_student_name(self, obj):
        try:
            return obj.student.student_profile.name
        except:
            return obj.student.username
    def get_student_profile(self, obj):
        try:
            p=obj.student.student_profile
            return {"name":p.name,"department":p.department,"division":p.division,"semester":p.semester,"is_hosteller":p.is_hosteller,"year_of_admission":p.year_of_admission}
        except:
            return None
    def get_files(self, obj):
        try:
            files=obj.section_status.files.all()
            return UploadedFileSerializer(files, many=True).data
        except:
            return []
