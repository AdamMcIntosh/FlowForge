using FlowForge.Application.Common.Interfaces;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;
using FlowForge.Domain.Users;
using FlowForge.Infrastructure.Authentication;
using FlowForge.Infrastructure.Persistence;
using FlowForge.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FlowForge.Infrastructure;

public static class DependencyInjection
{
    public const string SqliteProvider = "Sqlite";
    public const string SqlServerProvider = "SqlServer";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

        var provider = configuration["Database:Provider"] ?? SqliteProvider;

        return provider.Equals(SqlServerProvider, StringComparison.OrdinalIgnoreCase)
            ? services.AddInfrastructure(options => options.UseSqlServer(connectionString))
            : services.AddInfrastructure(options => options.UseSqlite(connectionString));
    }

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        Action<DbContextOptionsBuilder> configureDbContext)
    {
        services.AddDbContext<FlowForgeDbContext>(options => configureDbContext(options));
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<ITaskRepository, TaskRepository>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();

        return services;
    }
}
