from django.db import migrations, models


def backfill_numbers(apps, schema_editor):
    """Assign sequential numbers to pre-existing tasks in creation order."""
    Task = apps.get_model("core", "Task")
    for n, task in enumerate(Task.objects.order_by("created_at", "id"), start=1):
        task.number = n
        task.save(update_fields=["number"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_user_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="number",
            field=models.PositiveIntegerField(unique=True, null=True, blank=True, editable=False),
        ),
        migrations.RunPython(backfill_numbers, migrations.RunPython.noop),
    ]
