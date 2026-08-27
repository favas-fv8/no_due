from django.urls import path
from .views import InboxView, RequestDetailView, VerifyActionView, AllRequestsView, VerifierSearchView

urlpatterns = [
    path('inbox/', InboxView.as_view(), name='inbox'),
    path('search/', VerifierSearchView.as_view(), name='verifier_search'),
    path('request/<int:pk>/', RequestDetailView.as_view(), name='req_detail'),
    path('request/<int:pk>/action/', VerifyActionView.as_view(), name='verify_action'),
    path('admin/all/', AllRequestsView.as_view(), name='all_requests'),
]
