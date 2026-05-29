using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FlowForge.Infrastructure.Persistence;

public class FlowForgeDbContextFactory : IDesignTimeDbContextFactory<FlowForgeDbContext>
{
    private const string DefaultSqlServerConnectionString =
        "Server=localhost;Database=FlowForgeDesign;TrustServerCertificate=True;";

    public FlowForgeDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<FlowForgeDbContext>();

        var provider = Environment.GetEnvironmentVariable("Database__Provider")
            ?? DependencyInjection.SqlServerProvider;

        if (provider.Equals(DependencyInjection.SqlServerProvider, StringComparison.OrdinalIgnoreCase))
        {
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? DefaultSqlServerConnectionString;

            optionsBuilder.UseSqlServer(connectionString);
        }
        else
        {
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? "Data Source=flowforge.db";

            optionsBuilder.UseSqlite(connectionString);
        }

        return new FlowForgeDbContext(optionsBuilder.Options);
    }
}
