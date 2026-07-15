import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "comp_eval_platform.settings")

application = get_asgi_application()
