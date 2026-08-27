from rest_framework import serializers
from .models import User, StudentProfile, VerifierProfile, StaffAdvisorProfile, HODProfile, PrincipalProfile, VerificationType

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id','username','email','role','is_active','is_active_user','must_change_password','date_joined']
        read_only_fields = ['id','date_joined']

class VerificationTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationType
        fields = ['id','name','slug','description']

class StudentProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = StudentProfile
        fields = ['id','user','username','name','division','semester','department','address','is_hosteller','personal_email','personal_phone','year_of_admission','is_complete','created_at','updated_at']
        read_only_fields = ['id','user','is_complete','created_at','updated_at']
    def validate(self, attrs):
        import re
        from datetime import datetime
        # get current values or existing instance
        name = attrs.get('name', getattr(self.instance, 'name', None) if self.instance else None)
        address = attrs.get('address', getattr(self.instance, 'address', None) if self.instance else None)
        email = attrs.get('personal_email', getattr(self.instance, 'personal_email', None) if self.instance else None)
        phone = attrs.get('personal_phone', getattr(self.instance, 'personal_phone', None) if self.instance else None)
        year = attrs.get('year_of_admission', getattr(self.instance, 'year_of_admission', None) if self.instance else None)
        # name: only characters (letters and spaces), 2-50
        if name is not None:
            if not re.match(r'^[A-Za-z\s]+$', name):
                raise serializers.ValidationError({'name':'Name must contain only letters and spaces (no numbers/special characters).'})
            if len(name.strip()) < 2 or len(name.strip()) > 50:
                raise serializers.ValidationError({'name':'Name must be 2-50 characters.'})
        # address: only characters with limited specials, 10-200
        if address is not None:
            # allow letters, numbers, spaces, comma, period, hyphen, slash, hash
            if not re.match(r'^[A-Za-z0-9\s,.\-/#]+$', address):
                raise serializers.ValidationError({'address':'Address contains invalid characters. Allowed: letters, numbers, spaces, , . - / #'})
            if len(address.strip()) < 10 or len(address.strip()) > 200:
                raise serializers.ValidationError({'address':'Address must be 10-200 characters.'})
        # email type
        if email is not None:
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                raise serializers.ValidationError({'personal_email':'Invalid email format.'})
        # phone: 10 digits digits only
        if phone is not None:
            if not re.match(r'^\d{10}$', str(phone)):
                raise serializers.ValidationError({'personal_phone':'Phone must be exactly 10 digits (digits only).'})
        # year_of_admission: 2000 to current year
        if year is not None and year != '':
            try:
                y = int(year)
            except:
                raise serializers.ValidationError({'year_of_admission':'Year must be a number.'})
            cur = datetime.now().year
            if y < 2000 or y > cur:
                raise serializers.ValidationError({'year_of_admission':f'Year must be between 2000 and {cur}.'})
            attrs['year_of_admission'] = y
        return attrs

class VerifierProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = VerifierProfile
        fields = ['id','user','username','name','verification_type','verifying_division','verifying_semester','verifying_department','is_complete','created_at','updated_at']
        read_only_fields = ['id','user','is_complete','created_at','updated_at']

class StaffAdvisorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = StaffAdvisorProfile
        fields = ['id','user','username','name','verification_type','verifying_division','verifying_semester','verifying_department','is_complete','created_at','updated_at']
        read_only_fields = ['id','user','is_complete','created_at','updated_at']

class HODProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = HODProfile
        fields = ['id','user','username','name','verification_type','verifying_division','verifying_semester','verifying_department','is_complete','created_at','updated_at']
        read_only_fields = ['id','user','is_complete','created_at','updated_at']

class PrincipalProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = PrincipalProfile
        fields = ['id','user','username','name','verification_type','verifying_division','verifying_semester','verifying_department','is_complete','created_at','updated_at']
        read_only_fields = ['id','user','is_complete','created_at','updated_at']

class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=4)
    role = serializers.ChoiceField(choices=User.Role.choices)
    email = serializers.EmailField(required=False, allow_blank=True)

class UpdateUserSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)
    is_active_user = serializers.BooleanField(required=False)
    email = serializers.EmailField(required=False, allow_blank=True)

class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=4)

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(min_length=4)
    new_password = serializers.CharField(min_length=4)
