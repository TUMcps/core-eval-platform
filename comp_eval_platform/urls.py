"""Root URL conf. Variants extend this (or set ROOT_URLCONF) to mount their
plugin's API and the frontend shell. The node-callback and API routes live in
the core apps and are included here as they land."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # Node callbacks at the root: ROOT_URL/update/<task_id>/success|failure
    path("", include("comp_eval_platform.core.urls")),
]
