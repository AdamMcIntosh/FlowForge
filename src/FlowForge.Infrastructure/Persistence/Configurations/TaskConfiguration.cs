using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowForge.Infrastructure.Persistence.Configurations;

public class TaskConfiguration : IEntityTypeConfiguration<DomainTask>
{
    public void Configure(EntityTypeBuilder<DomainTask> builder)
    {
        builder.ToTable("Tasks");

        builder.HasKey(task => task.Id);

        builder.Property(task => task.Id)
            .ValueGeneratedNever();

        builder.Property(task => task.TaskId)
            .HasConversion(
                taskId => taskId.Value,
                value => TaskId.From(value))
            .HasColumnName("TaskId")
            .IsRequired();

        builder.Property(task => task.ProjectId)
            .HasConversion(
                projectId => projectId.Value,
                value => ProjectId.From(value))
            .HasColumnName("ProjectId")
            .IsRequired();

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(task => task.ProjectId)
            .HasPrincipalKey(project => project.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(task => task.Name)
            .HasMaxLength(DomainTask.MaxNameLength)
            .IsRequired();

        builder.HasIndex(task => new { task.ProjectId, task.Name })
            .IsUnique();

        builder.Property(task => task.CreatedAt)
            .IsRequired();

        builder.Property(task => task.UpdatedAt)
            .IsRequired();
    }
}
