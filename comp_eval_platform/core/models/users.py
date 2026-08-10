"""Custom user + roles.

Email is the login. Three roles: ``user`` submits; ``organizer`` additionally
curates tracks/benchmarks; ``admin`` has full control. The first account created
via signup becomes an enabled admin; every later signup is disabled until an
admin enables it.
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    USER = "user", "User"
    ORGANIZER = "organizer", "Organizer"  # curates tracks/benchmarks
    ADMIN = "admin", "Admin"  # full control


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", Role.USER)
        extra.setdefault("enabled", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=Role.ADMIN, enabled=True, is_staff=True, is_superuser=True)
        return self._create(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    #: Human-readable display name shown across the UI (email stays the login).
    #: Blank for legacy accounts; displays fall back to the email.
    name = models.CharField(max_length=200, blank=True, default="")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.USER)
    #: May submit / log in. First signup is enabled; later ones await an admin.
    enabled = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)  # Django admin access
    created_at = models.DateTimeField(auto_now_add=True)

    # AWS compute-backend only (unused when EXECUTION_BACKEND=local_docker).
    aws_eni = models.CharField(max_length=255, null=True, blank=True)
    aws_mac = models.CharField(max_length=255, null=True, blank=True)
    #: Optional worker-service override for remote_docker submissions.
    worker_service_url = models.CharField(max_length=255, null=True, blank=True)
    worker_service_port = models.PositiveIntegerField(null=True, blank=True)
    #: Runtime banked from deleted submissions, so usage tables keep counting it.
    deleted_runtime = models.PositiveIntegerField(default=0)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "core_user"

    def __str__(self):
        return self.email

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    @property
    def is_organizer(self) -> bool:
        """Organizers and admins may curate tracks/benchmarks."""
        return self.role in (Role.ORGANIZER, Role.ADMIN)
