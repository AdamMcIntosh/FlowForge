using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowForge.Infrastructure.Persistence.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("Projects");

        builder.HasKey(project => project.Id);

        builder.Property(project => project.Id)
            .ValueGeneratedNever();

        builder.Property(project => project.ProjectId)
            .HasConversion(
                projectId => projectId.Value,
                value => ProjectId.From(value))
            .HasColumnName("ProjectId")
            .IsRequired();

        builder.Property(project => project.OwnerId)
            .HasConversion(
                ownerId => ownerId.Value,
                value => UserId.From(value))
            .HasColumnName("OwnerId")
            .IsRequired();

        builder.HasIndex(project => project.OwnerId);

        builder.Property(project => project.Name)
            .HasMaxLength(Project.MaxNameLength)
            .IsRequired();

        builder.HasIndex(project => project.Name);

        builder.Property(project => project.CreatedAt)
            .IsRequired();

        builder.Property(project => project.UpdatedAt)
            .IsRequired();
    }
}
