using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace FlowForge.Infrastructure.Persistence;

public class FlowForgeDbContext(DbContextOptions<FlowForgeDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<DomainTask> Tasks => Set<DomainTask>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlowForgeDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
