using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FlowForge.Infrastructure.Persistence;

public static class DatabaseMigrationExtensions
{
    public static async Task ApplyMigrationsInNonProductionAsync(
        this WebApplication app,
        CancellationToken cancellationToken = default)
    {
        if (app.Environment.IsProduction())
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FlowForgeDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}
