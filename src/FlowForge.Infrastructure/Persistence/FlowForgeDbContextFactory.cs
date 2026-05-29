using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FlowForge.Infrastructure.Persistence;

public class FlowForgeDbContextFactory : IDesignTimeDbContextFactory<FlowForgeDbContext>
{
    public FlowForgeDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<FlowForgeDbContext>();
        optionsBuilder.UseSqlite("Data Source=flowforge.db");

        return new FlowForgeDbContext(optionsBuilder.Options);
    }
}
