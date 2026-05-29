using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FlowForge.Infrastructure.Persistence;

public class FlowForgeDbContext(DbContextOptions<FlowForgeDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<DomainTask> Tasks => Set<DomainTask>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // Migrations are authored against SQL Server; SQLite dev/test applies the same migration
        // with provider-specific type mapping, which otherwise triggers PendingModelChangesWarning.
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlowForgeDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
