using System.Text;
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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.AddFlowForgeSerilogIfEnabled();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddFlowForgeTraceIdLogging();
builder.Services.AddFlowForgeExceptionHandling();
builder.Services.AddFlowForgeValidation();

var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSettings["Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = ExceptionHandlingExtensions.CreateJwtBearerProblemDetailsEvents();
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

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
    app.UseAuthorization();
    app.UseRateLimiter();

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
