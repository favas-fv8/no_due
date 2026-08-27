from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StudentProfile, VerifierProfile, StaffAdvisorProfile, HODProfile, PrincipalProfile, VerificationType

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username','role','email','is_active','is_active_user')
    list_filter = ('role','is_active')
    fieldsets = BaseUserAdmin.fieldsets + (('Role', {'fields': ('role','is_active_user','must_change_password')}),)

admin.site.register(StudentProfile)
admin.site.register(VerifierProfile)
admin.site.register(StaffAdvisorProfile)
admin.site.register(HODProfile)
admin.site.register(PrincipalProfile)
admin.site.register(VerificationType)
