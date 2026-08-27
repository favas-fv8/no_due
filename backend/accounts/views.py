from rest_framework import status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.contrib.auth import get_user_model
from .models import StudentProfile, VerifierProfile, StaffAdvisorProfile, HODProfile, PrincipalProfile, VerificationType, User
from .serializers import (
    UserSerializer, StudentProfileSerializer, VerifierProfileSerializer,
    StaffAdvisorProfileSerializer, HODProfileSerializer, PrincipalProfileSerializer,
    CreateUserSerializer, UpdateUserSerializer, ResetPasswordSerializer, VerificationTypeSerializer,
    ChangePasswordSerializer
)
from rest_framework.views import APIView

UserModel = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    # optional role field for login page role selector
    role = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        # extract requested role before super
        requested_role = attrs.get('role')
        if requested_role == '':
            requested_role = None
        # remove role from attrs so parent doesn't complain (parent ignores unknown but be safe)
        attrs_pop = dict(attrs)
        attrs_pop.pop('role', None)

        username = attrs_pop.get('username') or attrs_pop.get('username')
        password = attrs_pop.get('password') or ''
        username = username.strip() if isinstance(username, str) else username
        # Pre-check: if user exists but deactivated, give clear error
        if username:
            try:
                u = UserModel.objects.get(username=username)
                if not u.is_active or not u.is_active_user:
                    raise serializers.ValidationError({"detail": "Account is deactivated by admin. Contact admin to activate."})
                # Pre-check password to give specific error instead of generic 401
                if password and not u.check_password(password):
                    raise serializers.ValidationError({"detail": "Invalid password. Please check your password or ask admin to Reset Password."})
            except UserModel.DoesNotExist:
                pass

        try:
            data = super().validate(attrs_pop)
        except (InvalidToken, AuthenticationFailed) as e:
            # normalize to detail key
            detail = str(e.detail) if hasattr(e, 'detail') else str(e)
            # check if user exists to give better hint
            if username:
                try:
                    u = UserModel.objects.get(username=username)
                    # password check hint
                    if not u.check_password(attrs_pop.get('password','')):
                        raise serializers.ValidationError({"detail": "Invalid password."})
                except UserModel.DoesNotExist:
                    pass
            raise serializers.ValidationError({"detail": detail if isinstance(detail, str) else "Invalid credentials."})

        user = self.user
        # role mismatch check if requested_role provided
        if requested_role and user.role != requested_role:
            raise serializers.ValidationError({"detail": f"Role mismatch: your account is '{user.role}', but you selected '{requested_role}'. Please select correct role."})

        if not user.is_active or not user.is_active_user:
            raise serializers.ValidationError({"detail": "Account is deactivated by admin."})

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'email': user.email,
        }
        data['profile_complete'] = check_profile_complete(user)
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

def check_profile_complete(user):
    try:
        if user.role == 'STUDENT':
            p = user.student_profile
            return p.is_complete
        elif user.role == 'VERIFIER':
            return user.verifier_profile.is_complete
        elif user.role == 'STAFF_ADVISOR':
            return user.staff_advisor_profile.is_complete
        elif user.role == 'HOD':
            return user.hod_profile.is_complete
        elif user.role == 'PRINCIPAL':
            return user.principal_profile.is_complete
        elif user.role == 'ADMIN':
            return True
    except Exception:
        return False
    return False

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    data = UserSerializer(user).data
    data['profile_complete'] = check_profile_complete(user)
    # include profile
    profile = None
    try:
        if user.role == 'STUDENT':
            profile = StudentProfileSerializer(user.student_profile).data
        elif user.role == 'VERIFIER':
            profile = VerifierProfileSerializer(user.verifier_profile).data
        elif user.role == 'STAFF_ADVISOR':
            profile = StaffAdvisorProfileSerializer(user.staff_advisor_profile).data
        elif user.role == 'HOD':
            profile = HODProfileSerializer(user.hod_profile).data
        elif user.role == 'PRINCIPAL':
            profile = PrincipalProfileSerializer(user.principal_profile).data
    except Exception:
        profile = None
    data['profile'] = profile
    return Response(data)

# Profile views
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u=request.user
        try:
            if u.role=='STUDENT':
                return Response(StudentProfileSerializer(u.student_profile).data)
            elif u.role=='VERIFIER':
                return Response(VerifierProfileSerializer(u.verifier_profile).data)
            elif u.role=='STAFF_ADVISOR':
                return Response(StaffAdvisorProfileSerializer(u.staff_advisor_profile).data)
            elif u.role=='HOD':
                return Response(HODProfileSerializer(u.hod_profile).data)
            elif u.role=='PRINCIPAL':
                return Response(PrincipalProfileSerializer(u.principal_profile).data)
            else:
                return Response({"detail":"Admin has no profile"}, status=400)
        except Exception as e:
            return Response({"detail":"Profile not found. Please create it.", "error":str(e)}, status=404)

    def post(self, request):
        u=request.user
        return self._upsert(request, create=True)
    def put(self, request):
        return self._upsert(request, create=False)
    def patch(self, request):
        return self._upsert(request, create=False, partial=True)

    def _upsert(self, request, create=True, partial=False):
        u=request.user
        data=request.data
        try:
            if u.role=='STUDENT':
                try:
                    obj = u.student_profile
                    ser = StudentProfileSerializer(obj, data=data, partial=partial)
                except StudentProfile.DoesNotExist:
                    ser = StudentProfileSerializer(data=data)
                if ser.is_valid():
                    p=ser.save(user=u)
                    p.is_complete = bool(p.name and p.division and p.semester and p.department and p.address and p.personal_email and p.personal_phone and p.year_of_admission)
                    p.save()
                    return Response(StudentProfileSerializer(p).data)
                return Response(ser.errors, status=400)

            elif u.role=='VERIFIER':
                try:
                    obj=u.verifier_profile
                    ser=VerifierProfileSerializer(obj, data=data, partial=partial)
                except VerifierProfile.DoesNotExist:
                    ser=VerifierProfileSerializer(data=data)
                if ser.is_valid():
                    p=ser.save(user=u)
                    p.is_complete = bool(p.name and p.verification_type)
                    p.save()
                    return Response(VerifierProfileSerializer(p).data)
                return Response(ser.errors, status=400)

            elif u.role=='STAFF_ADVISOR':
                try:
                    obj=u.staff_advisor_profile
                    ser=StaffAdvisorProfileSerializer(obj, data=data, partial=partial)
                except StaffAdvisorProfile.DoesNotExist:
                    ser=StaffAdvisorProfileSerializer(data=data)
                # enforce verification_type
                d=dict(data)
                d['verification_type']='Staff Advisor'
                if ser.is_valid():
                    # need to handle save with corrected type
                    # re-serialize with corrected
                    if 'obj' in locals():
                        ser2=StaffAdvisorProfileSerializer(obj, data=d, partial=partial)
                    else:
                        ser2=StaffAdvisorProfileSerializer(data=d)
                    if ser2.is_valid():
                        p=ser2.save(user=u)
                        p.is_complete=True
                        p.save()
                        return Response(StaffAdvisorProfileSerializer(p).data)
                    return Response(ser2.errors, status=400)
                # try with corrected data
                try:
                    obj2=u.staff_advisor_profile
                    ser2=StaffAdvisorProfileSerializer(obj2, data=d, partial=partial)
                except:
                    ser2=StaffAdvisorProfileSerializer(data=d)
                if ser2.is_valid():
                    p=ser2.save(user=u)
                    p.is_complete=True
                    p.save()
                    return Response(StaffAdvisorProfileSerializer(p).data)
                return Response(ser2.errors, status=400)

            elif u.role=='HOD':
                try:
                    obj=u.hod_profile
                    ser=HODProfileSerializer(obj, data=data, partial=partial)
                except HODProfile.DoesNotExist:
                    ser=HODProfileSerializer(data=data)
                d=dict(data)
                d['verification_type']='HOD'
                d['verifying_division']='All'
                d['verifying_semester']='All'
                # fix serializer
                try:
                    obj2=u.hod_profile
                    ser2=HODProfileSerializer(obj2, data=d, partial=partial)
                except:
                    ser2=HODProfileSerializer(data=d)
                if ser2.is_valid():
                    p=ser2.save(user=u)
                    p.is_complete=True
                    p.save()
                    return Response(HODProfileSerializer(p).data)
                return Response(ser2.errors, status=400)

            elif u.role=='PRINCIPAL':
                try:
                    obj=u.principal_profile
                    ser=PrincipalProfileSerializer(obj, data=data, partial=partial)
                except PrincipalProfile.DoesNotExist:
                    ser=PrincipalProfileSerializer(data=data)
                d=dict(data)
                d['verification_type']='Principal'
                d['verifying_division']='All'
                d['verifying_semester']='All'
                d['verifying_department']='All'
                try:
                    obj2=u.principal_profile
                    ser2=PrincipalProfileSerializer(obj2, data=d, partial=partial)
                except:
                    ser2=PrincipalProfileSerializer(data=d)
                if ser2.is_valid():
                    p=ser2.save(user=u)
                    p.is_complete=True
                    p.save()
                    return Response(PrincipalProfileSerializer(p).data)
                return Response(ser2.errors, status=400)
            else:
                return Response({"detail":"Admin has no profile"}, status=400)
        except Exception as e:
            return Response({"detail":str(e)}, status=400)

# Admin user management
class AdminUserListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        users=User.objects.all().order_by('-id')
        # filter by role?
        role=request.query_params.get('role')
        if role:
            users=users.filter(role=role)
        search=request.query_params.get('search')
        if search:
            users=users.filter(username__icontains=search)
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        ser=CreateUserSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        if User.objects.filter(username=ser.validated_data['username']).exists():
            return Response({"detail":"Username already exists"}, status=400)
        u=User.objects.create_user(
            username=ser.validated_data['username'],
            password=ser.validated_data['password'],
            role=ser.validated_data['role'],
            email=ser.validated_data.get('email',''),
        )
        u.is_active=True
        u.is_active_user=True
        # store plain for admin view (demo-only)
        u.admin_visible_password = ser.validated_data['password']
        u.save()
        return Response(UserSerializer(u).data, status=201)

class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get_user(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        u=self.get_user(pk)
        if not u:
            return Response({"detail":"Not found"}, status=404)
        data=UserSerializer(u).data
        # attach profile if exists
        try:
            if u.role=='STUDENT':
                data['profile']=StudentProfileSerializer(u.student_profile).data
            elif u.role=='VERIFIER':
                data['profile']=VerifierProfileSerializer(u.verifier_profile).data
            elif u.role=='STAFF_ADVISOR':
                data['profile']=StaffAdvisorProfileSerializer(u.staff_advisor_profile).data
            elif u.role=='HOD':
                data['profile']=HODProfileSerializer(u.hod_profile).data
            elif u.role=='PRINCIPAL':
                data['profile']=PrincipalProfileSerializer(u.principal_profile).data
            else:
                data['profile']=None
        except:
            data['profile']=None
        return Response(data)

    def put(self, request, pk):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        u=self.get_user(pk)
        if not u:
            return Response({"detail":"Not found"}, status=404)
        # Protect admin account: cannot deactivate admin
        if u.role == 'ADMIN' or u.username == 'admin':
            # block deactivation attempts
            is_active_req = request.data.get('is_active')
            is_active_user_req = request.data.get('is_active_user')
            # normalize to boolean check if explicitly False
            if is_active_req is False or is_active_user_req is False:
                return Response({"detail":"Cannot deactivate admin account. Admin must remain active."}, status=400)
            # also block role change away from ADMIN if it's the main admin
            if u.username == 'admin' and request.data.get('role') and request.data.get('role') != 'ADMIN':
                return Response({"detail":"Cannot change role of primary admin account."}, status=400)
        ser=UpdateUserSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        d=ser.validated_data
        if 'role' in d:
            u.role=d['role']
        if 'is_active' in d:
            u.is_active=d['is_active']
        if 'is_active_user' in d:
            u.is_active_user=d['is_active_user']
            u.is_active=d['is_active_user']
        if 'email' in d:
            u.email=d['email']
        # Ensure admin stays active regardless
        if u.role == 'ADMIN' or u.username == 'admin':
            u.is_active = True
            u.is_active_user = True
        u.save()
        return Response(UserSerializer(u).data)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        u=self.get_user(pk)
        if not u:
            return Response({"detail":"Not found"}, status=404)
        # Protect admin: cannot delete admin account
        if u.role == 'ADMIN' or u.username == 'admin':
            return Response({"detail":"Cannot delete admin account. Admin must remain active."}, status=400)
        # Prevent self-deletion
        if u.id == request.user.id:
            return Response({"detail":"Cannot delete your own account while logged in."}, status=400)
        # Hard delete - remove user and cascaded profiles/submissions
        username = u.username
        u.delete()
        return Response({"detail":f"User '{username}' deleted successfully."})

class AdminResetPasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, pk):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        try:
            u=User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail":"Not found"}, status=404)
        ser=ResetPasswordSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        u.set_password(ser.validated_data['new_password'])
        # ensure reactivated on reset
        u.is_active=True
        u.is_active_user=True
        u.admin_visible_password = ser.validated_data['new_password']
        u.save()
        return Response({"detail":"Password reset successful. Account reactivated.", "new_password": ser.validated_data['new_password']})

class AdminRevealPasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk):
        if request.user.role != 'ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        try:
            u = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail":"Not found"}, status=404)
        # Admin can view plain password only if stored (demo mode)
        if u.admin_visible_password:
            return Response({
                "username": u.username,
                "role": u.role,
                "password": u.admin_visible_password,
                "hashed_preview": u.password[:30] + "...",
                "note": "Demo-only: plain password stored for admin view. In production, passwords are hashed and cannot be retrieved — use Reset Password."
            })
        else:
            return Response({
                "username": u.username,
                "role": u.role,
                "password": None,
                "hashed_preview": u.password[:30] + "...",
                "note": "No plain password stored. Password was set before this feature or hashing only. Use Reset Password to set a new viewable password."
            })

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        u = request.user
        if not u.check_password(ser.validated_data['old_password']):
            return Response({"detail": "Current password is incorrect."}, status=400)
        if u.check_password(ser.validated_data['new_password']):
            return Response({"detail": "New password must be different from the current password."}, status=400)
        u.set_password(ser.validated_data['new_password'])
        u.admin_visible_password = ser.validated_data['new_password']
        u.save()
        return Response({"detail": "Password changed successfully."})

class VerificationTypeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        qs=VerificationType.objects.all()
        return Response(VerificationTypeSerializer(qs, many=True).data)
    def post(self, request):
        if request.user.role!='ADMIN':
            return Response({"detail":"Forbidden"}, status=403)
        ser=VerificationTypeSerializer(data=request.data)
        if ser.is_valid():
            ser.save()
            return Response(ser.data, status=201)
        return Response(ser.errors, status=400)
