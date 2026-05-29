namespace FlowForge.Api.Exceptions;

public static class ProblemDetailsResults
{
    public static IResult BadRequest(string detail) =>
        Results.Problem(
            title: "Invalid request",
            detail: detail,
            statusCode: StatusCodes.Status400BadRequest);

    public static IResult Unauthorized(string detail) =>
        Results.Problem(
            title: "Unauthorized",
            detail: detail,
            statusCode: StatusCodes.Status401Unauthorized);

    public static IResult Forbidden(string detail) =>
        Results.Problem(
            title: "Forbidden",
            detail: detail,
            statusCode: StatusCodes.Status403Forbidden);

    public static IResult NotFound(string title, string detail) =>
        Results.Problem(
            title: title,
            detail: detail,
            statusCode: StatusCodes.Status404NotFound);

    public static IResult Conflict(string detail) =>
        Results.Problem(
            title: "Conflict",
            detail: detail,
            statusCode: StatusCodes.Status409Conflict);

    public static IResult TooManyRequests(string detail) =>
        Results.Problem(
            title: "Too many requests",
            detail: detail,
            statusCode: StatusCodes.Status429TooManyRequests);
}
