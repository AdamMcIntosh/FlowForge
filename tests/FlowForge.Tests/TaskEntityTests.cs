using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;

namespace FlowForge.Tests;

public class TaskEntityTests
{
    private static ProjectId CreateProjectId() => ProjectId.New();

    [Fact]
    public void Constructor_WithProjectIdAndName_SetsProperties()
    {
        var projectId = CreateProjectId();

        var task = new DomainTask(projectId, "Write tests");

        Assert.Equal(projectId, task.ProjectId);
        Assert.Equal("Write tests", task.Name);
        Assert.Equal(task.TaskId.Value, task.Id);
        Assert.Equal(task.CreatedAt, task.UpdatedAt);
    }

    [Fact]
    public void Constructor_TrimsName()
    {
        var task = new DomainTask(CreateProjectId(), "  Trimmed  ");

        Assert.Equal("Trimmed", task.Name);
    }

    [Fact]
    public void Constructor_WithExplicitTaskId_UsesProvidedId()
    {
        var taskId = TaskId.New();
        var projectId = CreateProjectId();

        var task = new DomainTask(taskId, projectId, "Explicit");

        Assert.Equal(taskId, task.TaskId);
        Assert.Equal(taskId.Value, task.Id);
    }

    [Fact]
    public void Constructor_WhenTaskIdIsNull_Throws()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new DomainTask(null!, CreateProjectId(), "Name"));
    }

    [Fact]
    public void Constructor_WhenProjectIdIsNull_Throws()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new DomainTask(TaskId.New(), null!, "Name"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WhenNameIsNullOrWhitespace_Throws(string? name)
    {
        Assert.ThrowsAny<ArgumentException>(() => new DomainTask(CreateProjectId(), name!));
    }

    [Fact]
    public void Constructor_WhenNameExceedsMaxLength_Throws()
    {
        var tooLong = new string('a', DomainTask.MaxNameLength + 1);

        var exception = Assert.Throws<ArgumentException>(() =>
            new DomainTask(CreateProjectId(), tooLong));

        Assert.Equal("name", exception.ParamName);
        Assert.Contains("too long", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Constructor_WhenNameIsMaxLength_Succeeds()
    {
        var maxLengthName = new string('a', DomainTask.MaxNameLength);

        var task = new DomainTask(CreateProjectId(), maxLengthName);

        Assert.Equal(maxLengthName, task.Name);
    }

    [Fact]
    public void Rename_UpdatesNameAndTrims()
    {
        var task = new DomainTask(CreateProjectId(), "Original");

        task.Rename("  Renamed  ");

        Assert.Equal("Renamed", task.Name);
    }

    [Fact]
    public void Rename_UpdatesUpdatedAt()
    {
        var task = new DomainTask(CreateProjectId(), "Original");
        var beforeRename = task.UpdatedAt;

        task.Rename("Renamed");

        Assert.True(task.UpdatedAt >= beforeRename);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Rename_WhenNameIsNullOrWhitespace_Throws(string? name)
    {
        var task = new DomainTask(CreateProjectId(), "Original");

        Assert.ThrowsAny<ArgumentException>(() => task.Rename(name!));
    }

    [Fact]
    public void Rename_WhenNameExceedsMaxLength_Throws()
    {
        var task = new DomainTask(CreateProjectId(), "Original");
        var tooLong = new string('b', DomainTask.MaxNameLength + 1);

        var exception = Assert.Throws<ArgumentException>(() => task.Rename(tooLong));

        Assert.Equal("name", exception.ParamName);
        Assert.Contains("too long", exception.Message, StringComparison.OrdinalIgnoreCase);
    }
}
