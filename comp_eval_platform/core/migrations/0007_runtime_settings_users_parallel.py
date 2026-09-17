from django.conf import settings
from django.db import migrations, models


def carry_over_parallel_nodes(apps, schema_editor):
    """An existing deployment keeps the cap its MAX_PARALLEL_NODES env var set."""
    RuntimeSettings = apps.get_model("core", "RuntimeSettings")
    RuntimeSettings.objects.update(max_parallel_nodes=getattr(settings, "MAX_PARALLEL_NODES", 1))


class Migration(migrations.Migration):
    dependencies = [("core", "0006_benchmark_group")]

    operations = [
        migrations.AddField(
            model_name="runtimesettings",
            name="auto_enable_users",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="runtimesettings",
            name="max_parallel_nodes",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.RunPython(carry_over_parallel_nodes, migrations.RunPython.noop),
    ]
