import type { UserId } from '../auth/user.js';
import {
  InvalidProjectDescriptionError,
  InvalidProjectNameError,
  ProjectOwnershipError,
} from './errors.js';

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;

export type ProjectId = string;

export type ProjectProps = {
  id: ProjectId;
  name: string;
  description: string | null;
  ownerId: UserId;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectInput = {
  id: ProjectId;
  name: string;
  description?: string | null;
  ownerId: UserId;
  createdAt?: Date;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
};

export class Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string | null;
  readonly ownerId: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProjectProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.ownerId = props.ownerId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static validateName(name: string): string {
    return Project.normalizeName(name);
  }

  static validateDescription(description: string | null | undefined): string | null {
    return Project.normalizeDescription(description);
  }

  static create(input: CreateProjectInput): Project {
    const name = Project.validateName(input.name);
    const description = Project.validateDescription(input.description);
    const now = input.createdAt ?? new Date();

    return new Project({
      id: input.id,
      name,
      description,
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ProjectProps): Project {
    return new Project({
      id: props.id,
      name: Project.validateName(props.name),
      description: Project.validateDescription(props.description),
      ownerId: props.ownerId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  isOwnedBy(userId: UserId): boolean {
    return this.ownerId === userId;
  }

  assertOwnedBy(userId: UserId): void {
    if (!this.isOwnedBy(userId)) {
      throw new ProjectOwnershipError();
    }
  }

  update(input: UpdateProjectInput): Project {
    const name =
      input.name !== undefined ? Project.validateName(input.name) : this.name;
    const description =
      input.description !== undefined
        ? Project.validateDescription(input.description)
        : this.description;

    return new Project({
      id: this.id,
      name,
      description,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  toProps(): ProjectProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized.length < MIN_NAME_LENGTH) {
      throw new InvalidProjectNameError('Project name is required');
    }

    if (normalized.length > MAX_NAME_LENGTH) {
      throw new InvalidProjectNameError(
        `Project name must be at most ${String(MAX_NAME_LENGTH)} characters`,
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
      throw new InvalidProjectDescriptionError(
        `Project description must be at most ${String(MAX_DESCRIPTION_LENGTH)} characters`,
      );
    }

    return normalized;
  }
}
