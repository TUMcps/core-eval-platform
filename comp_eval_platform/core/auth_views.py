"""Session-based auth + competition info for the frontend shell.

Session cookies + CSRF (not JWT), matching the VNN frontend's axios client. The
first account created becomes an enabled admin; later ones are disabled until an
admin enables them.
"""
from dataclasses import asdict

from django.contrib.auth import authenticate, login, logout
from django.http import FileResponse, Http404
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Role, User


def _user_data(u):
    from .models import RuntimeSettings

    return {
        "id": str(u.id), "email": u.email, "name": u.name, "role": u.role, "enabled": u.enabled,
        "is_admin": u.is_admin, "is_organizer": u.is_organizer,
        "aws_eni": u.aws_eni or "", "aws_mac": u.aws_mac or "",
        "execution_backend": RuntimeSettings.get().execution_backend,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    email = (request.data.get("email") or "").strip()
    name = (request.data.get("name") or "").strip()
    password = request.data.get("password") or ""
    if not email or not password:
        return Response({"detail": "email and password are required"}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({"detail": "an account with this email already exists"}, status=400)
    first = not User.objects.exists()
    user = User.objects.create_user(
        email=email, password=password, name=name,
        role=Role.ADMIN if first else Role.USER, enabled=first,
    )
    return Response(_user_data(user), status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email = (request.data.get("email") or "").strip()
    password = request.data.get("password") or ""
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response({"detail": "invalid email or password"}, status=400)
    if not user.enabled:
        return Response({"detail": "account is awaiting admin approval"}, status=403)
    login(request, user)
    return Response(_user_data(user))


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response(status=204)


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    """Current user (or null). Also sets the CSRF cookie the client echoes back."""
    if request.user.is_authenticated:
        return Response(_user_data(request.user))
    return Response(None)


@api_view(["PATCH"])
@permission_classes([AllowAny])
def update_profile(request):
    """Let the signed-in user edit their own display name and email."""
    if not request.user.is_authenticated:
        return Response({"detail": "not authenticated"}, status=401)
    fields = []
    if "name" in request.data:
        request.user.name = (request.data.get("name") or "").strip()
        fields.append("name")
    if "email" in request.data:
        email = (request.data.get("email") or "").strip()
        if not email:
            return Response({"detail": "email is required"}, status=400)
        if User.objects.filter(email__iexact=email).exclude(pk=request.user.pk).exists():
            return Response({"detail": "an account with this email already exists"}, status=400)
        request.user.email = email
        fields.append("email")
    if fields:
        request.user.save(update_fields=fields)
    return Response(_user_data(request.user))


_SETTINGS_FIELDS = [
    "scheduler_enabled", "execution_backend", "terminate_at_end", "terminate_on_failure",
    "allow_non_admin_login", "users_can_submit_benchmarks", "users_can_submit_tools",
    "submission_timeout", "benchmark_timeout", "enforce_timeouts", "allow_full_evaluation",
]


@api_view(["GET", "PATCH"])
@permission_classes([AllowAny])
def settings_view(request):
    """Read/patch the RuntimeSettings singleton (admin only)."""
    from .models import RuntimeSettings

    if not (request.user.is_authenticated and request.user.is_admin):
        return Response({"detail": "admin only"}, status=403)
    s = RuntimeSettings.get()
    if request.method == "PATCH":
        for f in _SETTINGS_FIELDS:
            if f in request.data:
                setattr(s, f, request.data[f])
        s.save()
    return Response({f: getattr(s, f) for f in _SETTINGS_FIELDS})


@api_view(["GET"])
@permission_classes([AllowAny])
def competition_info(request):
    """Active variant + its presentation hints, so the shell renders variant-specific
    form fields / result columns / score columns."""
    from comp_eval_platform.competitions import get_competition

    comp = get_competition()
    data = {"name": comp.name, "display_name": comp.display_name or comp.name, "presentation": None}
    try:
        pres = comp.presentation()
        data["presentation"] = {
            "result_columns": pres.result_columns,
            "submission_fields": pres.submission_fields,
            "score_columns": pres.score_columns,
            "branding": {
                "primary_color": pres.branding.primary_color,
                "hero_image": pres.branding.hero_image,
                "hero_max_width": pres.branding.hero_max_width,
                "favicon": pres.branding.favicon,
            },
            "landing": {
                "tagline": pres.landing.tagline,
                "links": pres.landing.links,
                "contacts": pres.landing.contacts,
                "related": pres.landing.related,
            },
            "guides": {name: asdict(g) for name, g in pres.guides.items()},
        }
    except NotImplementedError:
        pass
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def competition_asset(request, name):
    """Serve a branding asset file (favicon, hero image) shipped by the active variant."""
    from comp_eval_platform.competitions import get_competition

    path = get_competition().asset_path(name)
    if not path:
        raise Http404(name)
    return FileResponse(open(path, "rb"))
