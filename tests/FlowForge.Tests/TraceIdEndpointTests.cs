using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FlowForge.Api.Logging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FlowForge.Tests;

public class TraceIdEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public TraceIdEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
            builder.UseSetting("Jwt:Issuer", "FlowForge");
            builder.UseSetting("Jwt:Audience", "FlowForge");
            builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
        }).CreateClient();
    }

    [Fact]
    public async Task GetHealth_WhenNoCorrelationHeader_ReturnsGeneratedCorrelationId()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertCorrelationHeader(response);
    }

    [Fact]
    public async Task GetHealth_WhenCorrelationHeaderProvided_EchoesSameId()
    {
        var expectedTraceId = Guid.NewGuid().ToString("N");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add(TraceIdConstants.CorrelationIdHeader, expectedTraceId);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expectedTraceId, GetCorrelationHeader(response));
    }

    [Fact]
    public async Task GetHealth_WhenRequestIdHeaderProvided_UsesRequestIdAsTraceId()
    {
        var expectedTraceId = Guid.NewGuid().ToString("N");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add(TraceIdConstants.RequestIdHeader, expectedTraceId);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expectedTraceId, GetCorrelationHeader(response));
    }

    [Fact]
    public async Task GetMe_WithoutToken_ProblemDetailsTraceIdMatchesCorrelationHeader()
    {
        var expectedTraceId = Guid.NewGuid().ToString("N");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/me");
        request.Headers.Add(TraceIdConstants.CorrelationIdHeader, expectedTraceId);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(expectedTraceId, GetCorrelationHeader(response));

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.True(problem.Extensions.TryGetValue("traceId", out var traceIdValue));
        Assert.Equal(expectedTraceId, traceIdValue?.ToString());
    }

    [Fact]
    public async Task Register_WithInvalidEmail_ProblemDetailsTraceIdMatchesCorrelationHeader()
    {
        var expectedTraceId = Guid.NewGuid().ToString("N");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/register")
        {
            Content = JsonContent.Create(new { email = "not-an-email", password = "short" }),
        };
        request.Headers.Add(TraceIdConstants.CorrelationIdHeader, expectedTraceId);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(expectedTraceId, GetCorrelationHeader(response));

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.True(problem.Extensions.TryGetValue("traceId", out var traceIdValue));
        Assert.Equal(expectedTraceId, traceIdValue?.ToString());
    }

    private static void AssertCorrelationHeader(HttpResponseMessage response)
    {
        var traceId = GetCorrelationHeader(response);
        Assert.False(string.IsNullOrWhiteSpace(traceId));
        Assert.Equal(32, traceId.Length);
    }

    private static string GetCorrelationHeader(HttpResponseMessage response)
    {
        Assert.True(
            response.Headers.TryGetValues(TraceIdConstants.CorrelationIdHeader, out var values),
            $"Expected response header {TraceIdConstants.CorrelationIdHeader}.");
        return values!.Single();
    }
}
