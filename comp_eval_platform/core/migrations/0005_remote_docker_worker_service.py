from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_task_category_extra"),
    ]

    operations = [
        migrations.AddField(model_name="user", name="worker_service_url", field=models.CharField(blank=True, max_length=255, null=True)),
        migrations.AddField(model_name="user", name="worker_service_port", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="node", name="worker_service_url", field=models.CharField(blank=True, default="", max_length=255)),
    ]