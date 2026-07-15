"""Root URL conf. Variants extend this (or set ROOT_URLCONF) to mount their
plugin's API and the frontend shell. The node-callback and API routes live in
the core apps and are included here as they land."""
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
