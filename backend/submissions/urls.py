from django.urls import path
from .views import MySubmissionView, UploadFileView, SendRequestView, DeleteFileView, UndoSectionView, AuditLogView, AdminSubmissionListView, AdminSubmissionDetailView

urlpatterns = [
    path('my/', MySubmissionView.as_view(), name='my_submission'),
    path('upload/<str:section>/', UploadFileView.as_view(), name='upload'),
    path('request/<str:section>/', SendRequestView.as_view(), name='send_request'),
    path('file/<int:file_id>/', DeleteFileView.as_view(), name='delete_file'),
    path('undo/<str:section>/', UndoSectionView.as_view(), name='undo_section'),
    path('audit/', AuditLogView.as_view(), name='audit'),
    path('admin/list/', AdminSubmissionListView.as_view(), name='admin_list'),
    path('admin/<int:pk>/', AdminSubmissionDetailView.as_view(), name='admin_detail'),
]
