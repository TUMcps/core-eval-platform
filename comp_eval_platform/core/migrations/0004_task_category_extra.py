import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_benchmark_repository_hash'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='core.category'),
        ),
        migrations.AddField(
            model_name='task',
            name='extra',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
