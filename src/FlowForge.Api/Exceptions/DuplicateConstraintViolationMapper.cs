using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace FlowForge.Api.Exceptions;

internal static class DuplicateConstraintViolationMapper
{
    internal const string DuplicateNameTitle = "Duplicate name";
    internal const string DuplicateNameDetail = "A resource with this name already exists.";

    public static bool TryMap(
        Exception exception,
        out int statusCode,
        out string title,
        out string detail,
        out LogLevel logLevel)
    {
        if (IsDuplicateNameConstraintViolation(exception))
        {
            statusCode = StatusCodes.Status409Conflict;
            title = DuplicateNameTitle;
            detail = DuplicateNameDetail;
            logLevel = LogLevel.Warning;
            return true;
        }

        statusCode = default;
        title = default!;
        detail = default!;
        logLevel = default;
        return false;
    }

    private static bool IsDuplicateNameConstraintViolation(Exception exception)
    {
        if (exception is InvalidOperationException invalidOperation
            && IsInMemoryDuplicateNameMessage(invalidOperation.Message))
        {
            return true;
        }

        if (exception is DbUpdateException dbUpdateException
            && IsUniqueConstraintViolation(dbUpdateException))
        {
            return true;
        }

        return false;
    }

    private static bool IsInMemoryDuplicateNameMessage(string message) =>
        (message.Contains("A project with name", StringComparison.Ordinal)
         && message.Contains("already exists", StringComparison.Ordinal))
        || (message.Contains("A task with name", StringComparison.Ordinal)
            && message.Contains("already exists in project", StringComparison.Ordinal));

    private static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (var inner = exception.InnerException; inner is not null; inner = inner.InnerException)
        {
            if (inner is SqliteException sqliteException)
            {
                if (sqliteException.SqliteExtendedErrorCode == 2067)
                {
                    return true;
                }

                if (sqliteException.SqliteErrorCode == 19
                    && sqliteException.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            if (inner is SqlException sqlException && sqlException.Number is 2627 or 2601)
            {
                return true;
            }
        }

        return false;
    }
}
