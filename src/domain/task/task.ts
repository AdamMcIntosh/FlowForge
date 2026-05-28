import type { UserId } from '../auth/user.js';
import type { ProjectId } from '../project/project.js';
import {
  InvalidTaskDescriptionError,
  InvalidTaskTitleError,
  UnauthorizedTaskAccessError,
} from './errors.js';
import { TaskStatus, parseTaskStatus, type TaskStatusValue } from './task-status.js';

const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;

export type TaskId = string;

export type TaskProps = {
  id: TaskId;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  projectId: ProjectId;
  assigneeId: UserId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTaskInput = {
  id: TaskId;
  title: string;
  description?: string | null;
  status?: TaskStatusValue;
  projectId: ProjectId;
  assigneeId?: UserId | null;
  createdAt?: Date;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatusValue;
  assigneeId?: UserId | null;
};

export class Task {
  readonly id: TaskId;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatusValue;
  readonly projectId: ProjectId;
  readonly assigneeId: UserId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: TaskProps) {
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.status = props.status;
    this.projectId = props.projectId;
    this.assigneeId = props.assigneeId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static validateTitle(title: string): string {
    return Task.normalizeTitle(title);
  }

  static validateDescription(description: string | null | undefined): string | null {
    return Task.normalizeDescription(description);
  }

  static validateStatus(status: string): TaskStatusValue {
    return parseTaskStatus(status);
  }

  static create(input: CreateTaskInput): Task {
    const title = Task.validateTitle(input.title);
    const description = Task.validateDescription(input.description);
    const status =
      input.status !== undefined
        ? Task.validateStatus(input.status)
        : TaskStatus.TODO;
    const now = input.createdAt ?? new Date();

    return new Task({
      id: input.id,
      title,
      description,
      status,
      projectId: input.projectId,
      assigneeId: input.assigneeId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: TaskProps): Task {
    return new Task({
      id: props.id,
      title: Task.validateTitle(props.title),
      description: Task.validateDescription(props.description),
      status: parseTaskStatus(props.status),
      projectId: props.projectId,
      assigneeId: props.assigneeId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  isInProject(projectId: ProjectId): boolean {
    return this.projectId === projectId;
  }

  assertInProject(projectId: ProjectId): void {
    if (!this.isInProject(projectId)) {
      throw new UnauthorizedTaskAccessError();
    }
  }

  assertAccessibleByProjectOwner(projectOwnerId: UserId, userId: UserId): void {
    if (projectOwnerId !== userId) {
      throw new UnauthorizedTaskAccessError();
    }
  }

  update(input: UpdateTaskInput): Task {
    const title =
      input.title !== undefined ? Task.validateTitle(input.title) : this.title;
    const description =
      input.description !== undefined
        ? Task.validateDescription(input.description)
        : this.description;
    const status =
      input.status !== undefined ? parseTaskStatus(input.status) : this.status;
    const assigneeId =
      input.assigneeId !== undefined ? input.assigneeId : this.assigneeId;

    return new Task({
      id: this.id,
      title,
      description,
      status,
      projectId: this.projectId,
      assigneeId,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  toProps(): TaskProps {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      projectId: this.projectId,
      assigneeId: this.assigneeId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static normalizeTitle(title: string): string {
    const normalized = title.trim();

    if (normalized.length < MIN_TITLE_LENGTH) {
      throw new InvalidTaskTitleError('Task title is required');
    }

    if (normalized.length > MAX_TITLE_LENGTH) {
      throw new InvalidTaskTitleError(
        `Task title must be at most ${String(MAX_TITLE_LENGTH)} characters`,
      );
    }

    return normalized;
  }

  private static normalizeDescription(
    description: string | null | undefined,
  ): string | null {
    if (description === null || description === undefined) {
      return null;
    }

    const normalized = description.trim();

    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > MAX_DESCRIPTION_LENGTH) {
      throw new InvalidTaskDescriptionError(
        `Task description must be at most ${String(MAX_DESCRIPTION_LENGTH)} characters`,
      );
    }

    return normalized;
  }
}
