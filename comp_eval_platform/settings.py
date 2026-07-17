"""Base Django settings shared by every variant.

A variant deployment ships its own project settings that does::

    from comp_eval_platform.settings import *  # noqa

    ACTIVE_COMPETITION = "vnn"
    INSTALLED_APPS += ["vnn_comp"]

and overrides whatever else it needs. The three engine knobs below are the axes
that make the platform modular; see docs/unified-platform.md.
"""
from pathlib import Path

from decouple import Csv, config
from dj_database_url import parse as db_url

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Engine knobs -----------------------------------------------------------
#: Which competition variant is live. Its plugin app must be in INSTALLED_APPS
#: and register itself (AppConfig.ready). Read by competitions.get_competition().
ACTIVE_COMPETITION = config("ACTIVE_COMPETITION", default="")
#: What a worker is, on the (orthogonal) compute axis.
EXECUTION_BACKEND = config("EXECUTION_BACKEND", default="local_docker")  # aws | local_docker
#: How many workers the scheduler keeps busy in parallel. Each worker still runs
#: its benchmarks sequentially.
MAX_PARALLEL_NODES = config("MAX_PARALLEL_NODES", default=1, cast=int)
#: Re-executions a retrying step gets before the task fails (installs are flaky over
#: the network); also bounds the execute/step_failed retry loop.
MAX_STEP_RETRIES = config("MAX_STEP_RETRIES", default=10, cast=int)
#: Background job cadence (seconds) and whether the web process starts it.
AUTOMATIC_UPDATE_INTERVAL = config("AUTOMATIC_UPDATE_INTERVAL", default=60, cast=int)
SCHEDULER_AUTOSTART = config("SCHEDULER_AUTOSTART", default=False, cast=bool)

# --- Core Django ------------------------------------------------------------
SECRET_KEY = config("SECRET_KEY", default="dev-insecure-change-me")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_apscheduler",
    "drf_spectacular",
    # Core (variants append their plugin app after this)
    "comp_eval_platform.core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

AUTH_USER_MODEL = "core.User"

ROOT_URLCONF = config("ROOT_URLCONF", default="comp_eval_platform.urls")

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = config("WSGI_APPLICATION", default="comp_eval_platform.wsgi.application")

DATABASES = {
    "default": config(
        "DATABASE_URL",
        default="postgres://postgres:postgres@localhost:5432/eval",
        cast=db_url,
    )
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# ROOT_URL must be reachable by the node (it curls callbacks back to us).
ROOT_URL = config("ROOT_URL", default="http://localhost:8000")

# Bytes of a running step's node log tailed into the DB each tick (and sent to the
# detail page). Bounded so a progress-bar-spamming generator can't bloat the row or
# poll payload; the frontend renders a tail of this (VITE_MAX_LOG_KB).
LIVE_LOG_TAIL_BYTES = config("LIVE_LOG_TAIL_BYTES", default=1_000_000, cast=int)

# Persistent host dir holding the local git repos artifacts default to.
DATA_DIR = config("DATA_DIR", default=str(BASE_DIR / "data"))
LOCAL_REPOS_DIR = config("LOCAL_REPOS_DIR", default=str(Path(DATA_DIR) / "repos"))

# Benchmark generation + export.
# Seed passed to every generator (generate_properties.py <seed>).
BENCHMARK_SEED = config("BENCHMARK_SEED", default="")
# Empty -> commit to a local repo under LOCAL_REPOS_DIR; set to a remote SSH URL
# to push there instead. Export runs backend-side, so the key stays on the host.
BENCHMARKS_PUSH_REPO = config("BENCHMARKS_PUSH_REPO", default="")
BENCHMARKS_DEPLOY_KEY = config("BENCHMARKS_DEPLOY_KEY", default="")

# Where a tool run's results.csv + counterexamples are exported. Same contract as
# the benchmarks repo above: empty -> a local repo under LOCAL_REPOS_DIR.
RESULTS_PUSH_REPO = config("RESULTS_PUSH_REPO", default="")
RESULTS_DEPLOY_KEY = config("RESULTS_DEPLOY_KEY", default="")

# The local dev origin (frontend proxies to the backend, so the browser's Origin is
# the Vite host) plus public dev tunnels (Cloudflare/ngrok) for remote demos.
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173,"
            "https://*.trycloudflare.com,https://*.ngrok-free.app,https://*.ngrok.io",
    cast=Csv(),
)

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
