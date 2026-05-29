using FlowForge.Domain.Tasks;

namespace FlowForge.Tests;

public class TaskIdTests
{
    [Fact]
    public void New_CreatesNonEmptyGuid()
    {
        var taskId = TaskId.New();

        Assert.NotEqual(Guid.Empty, taskId.Value);
    }

    [Fact]
    public void From_WithValidGuid_ReturnsTaskIdWithSameValue()
    {
        var guid = Guid.NewGuid();

        var taskId = TaskId.From(guid);

        Assert.Equal(guid, taskId.Value);
    }

    [Fact]
    public void From_WithEmptyGuid_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(() => TaskId.From(Guid.Empty));

        Assert.Equal("value", exception.ParamName);
        Assert.Contains("cannot be empty", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Equals_WithSameValue_ReturnsTrue()
    {
        var guid = Guid.NewGuid();
        var left = TaskId.From(guid);
        var right = TaskId.From(guid);

        Assert.True(left.Equals(right));
        Assert.True(left == right);
        Assert.False(left != right);
    }

    [Fact]
    public void Equals_WithDifferentValue_ReturnsFalse()
    {
        var left = TaskId.New();
        var right = TaskId.New();

        Assert.False(left.Equals(right));
        Assert.False(left == right);
        Assert.True(left != right);
    }

    [Fact]
    public void GetHashCode_WithEqualValues_IsSame()
    {
        var guid = Guid.NewGuid();
        var left = TaskId.From(guid);
        var right = TaskId.From(guid);

        Assert.Equal(left.GetHashCode(), right.GetHashCode());
    }

    [Fact]
    public void ToString_ReturnsGuidString()
    {
        var guid = Guid.NewGuid();
        var taskId = TaskId.From(guid);

        Assert.Equal(guid.ToString(), taskId.ToString());
    }
}
