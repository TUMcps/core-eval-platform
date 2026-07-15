import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "comp_eval_platform.settings")

application = get_wsgi_application()
