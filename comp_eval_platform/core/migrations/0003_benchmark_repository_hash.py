from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_taskstep_retries'),
    ]

    operations = [
        migrations.AddField(
            model_name='benchmark',
            name='repository',
            field=models.CharField(blank=True, max_length=512),
        ),
        migrations.AddField(
            model_name='benchmark',
            name='hash',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
