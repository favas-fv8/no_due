from django.urls import path
from .views import CustomTokenObtainPairView, me, ProfileView, AdminUserListCreateView, AdminUserDetailView, AdminResetPasswordView, AdminRevealPasswordView, VerificationTypeView, ChangePasswordView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', me, name='me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('admin/users/', AdminUserListCreateView.as_view(), name='admin_users'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/users/<int:pk>/reset-password/', AdminResetPasswordView.as_view(), name='admin_reset_password'),
    path('admin/users/<int:pk>/password/', AdminRevealPasswordView.as_view(), name='admin_reveal_password'),
    path('verification-types/', VerificationTypeView.as_view(), name='verification_types'),
]
