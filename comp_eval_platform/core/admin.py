from django.contrib import admin

from .models import (
    Benchmark,
    Category,
    Instance,
    Node,
    Result,
    RuntimeSettings,
    Task,
    TaskStep,
    Tool,
    Track,
    User,
)

admin.site.register([Category, Tool, Benchmark, Instance, Track, Node, Result, RuntimeSettings])


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "enabled", "is_staff")
    list_filter = ("role", "enabled")
    search_fields = ("email",)


class TaskStepInline(admin.TabularInline):
    model = TaskStep
    fields = ("order", "kind", "status", "started_at", "finished_at")
    readonly_fields = fields
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "tool", "benchmark", "outcome", "created_at")
    list_filter = ("outcome",)
    inlines = [TaskStepInline]
