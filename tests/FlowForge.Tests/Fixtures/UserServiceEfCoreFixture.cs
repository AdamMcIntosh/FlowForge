using FlowForge.Application;
using FlowForge.Application.Projects;
using FlowForge.Application.Tasks;
using FlowForge.Application.Users;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;
using FlowForge.Infrastructure;
using FlowForge.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FlowForge.Tests.Fixtures;

public sealed class UserServiceEfCoreFixture : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _serviceProvider;

    public UserServiceEfCoreFixture()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "FlowForge",
                ["Jwt:Audience"] = "FlowForge",
                ["Jwt:Secret"] = "FlowForge-Dev-Secret-Key-At-Least-32-Chars!",
                ["Jwt:ExpiryMinutes"] = "60",
            })
            .Build());
        services.AddLogging();
        services.AddInfrastructure(options => options.UseSqlite(_connection));
        services.AddApplication();

        _serviceProvider = services.BuildServiceProvider();
        EnsureDatabaseCreated();
    }

    public IServiceScope CreateScope() => _serviceProvider.CreateScope();

    public IUserService ResolveUserService(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IUserService>();

    public IProjectService ResolveProjectService(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IProjectService>();

    public IProjectRepository ResolveProjectRepository(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IProjectRepository>();

    public ITaskService ResolveTaskService(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<ITaskService>();

    public ITaskRepository ResolveTaskRepository(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<ITaskRepository>();

    public void Dispose()
    {
        _serviceProvider.Dispose();
        _connection.Dispose();
    }

    private void EnsureDatabaseCreated()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FlowForgeDbContext>();
        dbContext.Database.EnsureCreated();
    }
}

[CollectionDefinition(nameof(UserServiceEfCoreCollection))]
public sealed class UserServiceEfCoreCollection : ICollectionFixture<UserServiceEfCoreFixture>;
