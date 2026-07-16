"""Core routes: the JSON API under ``/api/`` and the node callbacks at the root
(``ROOT_URL/update/<task_id>/success|failure``, which must be node-reachable)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import api, auth_views, forms_api, views

router = DefaultRouter()
router.register("tools", api.ToolViewSet)
router.register("benchmarks", api.BenchmarkViewSet)
router.register("tracks", api.TrackViewSet)
router.register("tasks", api.TaskViewSet)
router.register("results", api.ResultViewSet, basename="result")
router.register("categories", api.CategoryViewSet)
router.register("users", api.UserViewSet)

urlpatterns = [
    path("api/auth/signup/", auth_views.signup),
    path("api/auth/login/", auth_views.login_view),
    path("api/auth/logout/", auth_views.logout_view),
    path("api/auth/me/", auth_views.me),
    path("api/auth/profile/", auth_views.update_profile),
    path("api/settings/", auth_views.settings_view),
    path("api/competition/", auth_views.competition_info),
    path("api/competition/assets/<str:name>", auth_views.competition_asset),
    path("api/toolkit/form_data/", forms_api.toolkit_form_data),
    path("api/toolkit/submit/", forms_api.toolkit_submit),
    path("api/benchmark/form_data/", forms_api.benchmark_form_data),
    path("api/benchmark/submit/", forms_api.benchmark_submit),
    path("api/", include(router.urls)),
    path("update/<int:task_id>/success", views.update_success, name="update_success"),
    path("update/<int:task_id>/failure", views.update_failure, name="update_failure"),
]
