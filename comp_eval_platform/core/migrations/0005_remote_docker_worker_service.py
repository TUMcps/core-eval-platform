"""Migration to support per-user and per-node remote Docker worker routing."""
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds configuration fields to User and Node models for the remote_docker backend.
    This allows the system to route provisioning requests to custom remote worker services 
    on a per-user basis, and tracks which worker service manages each node.
    """

    dependencies = [
        # Relies on the previous core migration where task category extras were added
        ("core", "0004_task_category_extra"),
    ]

    operations = [
        # Add custom remote worker URL for individual users (overrides the global settings)
        migrations.AddField(
            model_name="user", 
            name="worker_service_url", 
            field=models.CharField(blank=True, max_length=255, null=True)
        ),
        
        # Add custom remote worker port for individual users
        migrations.AddField(
            model_name="user", 
            name="worker_service_port", 
            field=models.PositiveIntegerField(blank=True, null=True)
        ),
        
        # Track which remote worker service provisioned and currently manages this specific compute node
        migrations.AddField(
            model_name="node", 
            name="worker_service_url", 
            field=models.CharField(blank=True, default="", max_length=255)
        ),
    ]