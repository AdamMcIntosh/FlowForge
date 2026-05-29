using FlowForge.Api.Authentication;
using FlowForge.Api.Cors;
using FlowForge.Api.Endpoints;
using FlowForge.Api.Exceptions;
using FlowForge.Api.HealthChecks;
using FlowForge.Api.Logging;
using FlowForge.Api.OpenApi;
using FlowForge.Api.RateLimiting;
using FlowForge.Api.Security;
using FlowForge.Api.Validation;
using FlowForge.Application;
using FlowForge.Infrastructure;
using FlowForge.Infrastructure.Persistence;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.AddFlowForgeSerilogIfEnabled();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddFlowForgeTraceIdLogging();
builder.Services.AddFlowForgeExceptionHandling();
builder.Services.AddFlowForgeValidation();

builder.Services.AddFlowForgeJwtAuthentication(builder.Configuration, builder.Environment);

builder.Services.AddAuthorization();
builder.Services.AddFlowForgeCors(builder.Configuration, builder.Environment);
builder.Services.AddFlowForgeSecurityHeaders(builder.Configuration, builder.Environment);
builder.Services.AddFlowForgeRateLimiting(builder.Configuration);
builder.Services.AddFlowForgeSwagger();
builder.Services.AddFlowForgeHealthChecks();

var app = builder.Build();

try
{
    await app.ApplyMigrationsInNonProductionAsync();

    app.UseFlowForgeForwardedHeaders(builder.Configuration);
    app.UseFlowForgeTraceId();
    app.UseExceptionHandler();
    app.UseFlowForgeSecurityHeaders();
    app.UseFlowForgeSwagger();
    app.UseFlowForgeCors();
    app.UseAuthentication();
    app.UseRateLimiter();
    app.UseAuthorization();

    app.MapHealthChecks("/health").DisableRateLimiting();
    app.MapAuthEndpoints();
    app.MapMeEndpoints();
    app.MapProjectEndpoints();
    app.MapTaskEndpoints();

    Log.Information("FlowForge API started");
    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "FlowForge API terminated unexpectedly");
    throw;
}
finally
{
    if (builder.Configuration.GetValue(SerilogLoggingExtensions.EnabledConfigurationKey, true))
    {
        await SerilogLoggingExtensions.CloseAndFlushSerilogAsync();
    }
}

public partial class Program;
