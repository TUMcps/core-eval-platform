"""Core node-callback routes. Mounted at the project root so the node-reachable
URL is ``ROOT_URL/update/<task_id>/success|failure``."""
from django.urls import path

from . import views

urlpatterns = [
    path("update/<uuid:task_id>/success", views.update_success, name="update_success"),
    path("update/<uuid:task_id>/failure", views.update_failure, name="update_failure"),
]
