using FlowForge.Domain.Tasks;
using FlowForge.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace FlowForge.Tests.Fixtures;

public sealed class InMemoryTaskRepositoryFixture : IDisposable
{
    private readonly ServiceProvider _serviceProvider;

    public InMemoryTaskRepositoryFixture()
    {
        var services = new ServiceCollection();
        services.AddScoped<ITaskRepository, InMemoryTaskRepository>();
        _serviceProvider = services.BuildServiceProvider();
    }

    public IServiceScope CreateScope() => _serviceProvider.CreateScope();

    public ITaskRepository ResolveTaskRepository(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<ITaskRepository>();

    public void Dispose() => _serviceProvider.Dispose();
}

[CollectionDefinition(nameof(InMemoryTaskRepositoryCollection))]
public sealed class InMemoryTaskRepositoryCollection : ICollectionFixture<InMemoryTaskRepositoryFixture>;
