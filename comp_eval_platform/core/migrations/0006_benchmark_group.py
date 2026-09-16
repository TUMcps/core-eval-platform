from django.db import migrations, models


def copy_legacy_groups(apps, schema_editor):
    """Promote the first-cut extra['group'] convention into the real field."""
    Benchmark = apps.get_model("core", "Benchmark")
    for benchmark in Benchmark.objects.only("id", "extra").iterator():
        legacy = (benchmark.extra or {}).get("group")
        if isinstance(legacy, str) and legacy.strip():
            Benchmark.objects.filter(pk=benchmark.pk).update(group=legacy.strip())


class Migration(migrations.Migration):
    dependencies = [("core", "0005_remote_docker_worker_service")]

    operations = [
        migrations.AddField(
            model_name="benchmark",
            name="group",
            field=models.CharField(default="default", max_length=64),
        ),
        migrations.RunPython(copy_legacy_groups, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="benchmark",
            constraint=models.CheckConstraint(
                check=~models.Q(group=""), name="benchmark_group_nonempty"
            ),
        ),
        migrations.AddIndex(
            model_name="benchmark",
            index=models.Index(
                fields=["category", "group", "name"],
                name="benchmark_cat_group_name_idx",
            ),
        ),
    ]
