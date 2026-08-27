from rest_framework.permissions import BasePermission

class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'

class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'STUDENT'

class IsVerifierRole(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ('VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL')

ANY_AUTH = ['IsAuthenticated']
