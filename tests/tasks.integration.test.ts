/**
 * Integration tests for Task CRUD HTTP endpoints.
 *
 * Setup: No external infrastructure required. Uses buildServer() with in-memory
 * user, project, and task repositories (see tests/helpers/create-auth-test-app.ts).
 * Each describe block creates a fresh app via createAuthTestApp() to avoid
 * cross-test state leakage.
 *
 * HTTP helpers expect the Fastify instance: pass testApp.app (not AuthTestApp).
 * Project setup: createOwnedProject(testApp.app, accessToken).
 *
 * Authorization model under test: only the project owner may CRUD tasks.
 * Assignee metadata is stored but does not grant access.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TaskStatus } from '../src/domain/task/task-status.js';
import {
  createAuthTestApp,
  type AuthTestApp,
} from './helpers/create-auth-test-app.js';
import { registerAndGetAccessToken } from './helpers/project-http.js';
import {
  createOwnedProject,
  deleteTask,
  getTask,
  listTasks,
  patchTask,
  postTask,
} from './helpers/task-http.js';

const unauthorizedBody = (message: string) => ({
  statusCode: 401,
  error: 'Unauthorized',
  message,
  code: 'AUTH_UNAUTHORIZED',
});

const projectOwnershipBody = {
  statusCode: 403,
  error: 'Forbidden',
  message: 'You do not have permission to access this project',
  code: 'PROJECT_OWNERSHIP',
};

const taskUnauthorizedBody = {
  statusCode: 403,
  error: 'Forbidden',
  message: 'You do not have permission to access this task',
  code: 'TASK_UNAUTHORIZED',
};

const projectNotFoundBody = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Project not found',
  code: 'PROJECT_NOT_FOUND',
};

const taskNotFoundBody = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Task not found',
  code: 'TASK_NOT_FOUND',
};

function repeatChar(char: string, count: number): string {
  return char.repeat(count);
}

describe('POST /projects/:id/tasks', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 201 with the created task scoped to the URL project', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
      name: 'Owner',
    });
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      {
        title: 'Write tests',
        description: 'Cover all endpoints',
        status: TaskStatus.IN_PROGRESS,
      },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body).toEqual({
      id: expect.any(String),
      title: 'Write tests',
      description: 'Cover all endpoints',
      status: TaskStatus.IN_PROGRESS,
      projectId,
      assigneeId: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });

  it('defaults status to TODO and description to null when omitted', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Minimal task' },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      title: 'Minimal task',
      description: null,
      status: TaskStatus.TODO,
      assigneeId: null,
    });
  });

  it('persists assigneeId when provided', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Assigned task', assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );

    expect(response.statusCode).toBe(201);
    expect(response.json().assigneeId).toBe(assignee.user.id);
  });

  it('accepts each valid TaskStatus value on create', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    for (const status of [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE]) {
      const response = await postTask(
        testApp.app,
        projectId,
        { title: `Task ${status}`, status },
        { accessToken },
      );

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        title: `Task ${status}`,
        status,
        projectId,
      });
    }
  });

  it('associates the task with the project id from the URL, not the request body', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Scoped task', projectId: 'other-project-id' },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);
    expect(response.json().projectId).toBe(projectId);
    expect(response.json().projectId).not.toBe('other-project-id');
  });

  it('uses userId from the JWT subject and ignores userId in the request body', async () => {
    const { accessToken, user } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Auth scoped', userId: 'attacker-id' },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);

    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });
    const denied = await getTask(testApp.app, response.json().id as string, {
      accessToken: intruder.accessToken,
    });

    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toEqual(taskUnauthorizedBody);

    const allowed = await getTask(testApp.app, response.json().id as string, { accessToken });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().projectId).toBe(projectId);
    expect(user.id).toBeDefined();
  });

  it('returns 400 VALIDATION_ERROR when title is missing', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { description: 'No title' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Title is required',
    });
  });

  it('returns 400 VALIDATION_ERROR when title is empty after trimming', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: '   ' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Title is required',
    });
  });

  it('returns 400 VALIDATION_ERROR when title exceeds 255 characters', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: repeatChar('t', 256) },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Title must be at most 255 characters',
    });
  });

  it('returns 400 VALIDATION_ERROR when description exceeds 2000 characters', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Valid title', description: repeatChar('d', 2001) },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Description must be at most 2000 characters',
    });
  });

  it('returns 400 VALIDATION_ERROR for an invalid status value', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Bad status', status: 'BLOCKED' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await postTask(
      testApp.app,
      'missing-project-id',
      { title: 'Orphan task' },
      { accessToken },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(projectNotFoundBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when another user creates a task in a foreign project', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Unauthorized create' },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(projectOwnershipBody);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await postTask(testApp.app, 'some-project-id', { title: 'No auth' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });

  it('returns 401 for a malformed bearer token', async () => {
    const response = await postTask(
      testApp.app,
      'some-project-id',
      { title: 'Bad token' },
      { accessToken: 'not-a-jwt' },
    );

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Invalid or expired token'));
  });
});

describe('GET /projects/:id/tasks', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with an empty list when the project has no tasks', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await listTasks(testApp.app, projectId, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ tasks: [] });
  });

  it('returns only tasks belonging to the requested project', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectA = await createOwnedProject(testApp.app, accessToken, 'Project A');
    const projectB = await createOwnedProject(testApp.app, accessToken, 'Project B');

    const taskA = await postTask(
      testApp.app,
      projectA,
      { title: 'Task A' },
      { accessToken },
    );
    expect(taskA.statusCode).toBe(201);

    const taskB = await postTask(
      testApp.app,
      projectB,
      { title: 'Task B' },
      { accessToken },
    );
    expect(taskB.statusCode).toBe(201);

    const response = await listTasks(testApp.app, projectA, { accessToken });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0]).toMatchObject({
      id: taskA.json().id,
      title: 'Task A',
      projectId: projectA,
    });
  });

  it('orders tasks by most recently updated first', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const first = await postTask(
      testApp.app,
      projectId,
      { title: 'First' },
      { accessToken },
    );
    expect(first.statusCode).toBe(201);
    const firstId = first.json().id as string;

    const second = await postTask(
      testApp.app,
      projectId,
      { title: 'Second' },
      { accessToken },
    );
    expect(second.statusCode).toBe(201);
    const secondId = second.json().id as string;

    const updatedFirst = await patchTask(
      testApp.app,
      firstId,
      { status: TaskStatus.IN_PROGRESS },
      { accessToken },
    );
    expect(updatedFirst.statusCode).toBe(200);

    const response = await listTasks(testApp.app, projectId, { accessToken });

    expect(response.statusCode).toBe(200);
    const ids = response.json().tasks.map((task: { id: string }) => task.id);
    expect(ids).toEqual([firstId, secondId]);
    expect(ids[0]).not.toBe(secondId);
  });

  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await listTasks(testApp.app, 'missing-project-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(projectNotFoundBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when another user lists tasks in a foreign project', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    await postTask(
      testApp.app,
      projectId,
      { title: 'Private task' },
      { accessToken: owner.accessToken },
    );

    const response = await listTasks(testApp.app, projectId, {
      accessToken: intruder.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(projectOwnershipBody);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await listTasks(testApp.app, 'some-project-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('GET /tasks/:id', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the task when the authenticated user owns the parent project', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Detail task', description: 'Details', status: TaskStatus.DONE },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await getTask(testApp.app, taskId, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: taskId,
      title: 'Detail task',
      description: 'Details',
      status: TaskStatus.DONE,
      projectId,
      assigneeId: null,
      createdAt: created.json().createdAt,
      updatedAt: created.json().updatedAt,
    });
  });

  it('returns 403 TASK_UNAUTHORIZED when the assignee is not the project owner', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Assigned work', assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await getTask(testApp.app, created.json().id as string, {
      accessToken: assignee.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await getTask(testApp.app, 'missing-task-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when another user requests the task', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Private task' },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await getTask(testApp.app, created.json().id as string, {
      accessToken: intruder.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await getTask(testApp.app, 'some-task-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('PATCH /tasks/:id', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the updated task when title and status change', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Before', description: 'Keep me' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await patchTask(
      testApp.app,
      taskId,
      { title: 'After', status: TaskStatus.IN_PROGRESS },
      { accessToken },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: taskId,
      title: 'After',
      description: 'Keep me',
      status: TaskStatus.IN_PROGRESS,
      projectId,
    });
    expect(response.json().title).not.toBe(created.json().title);
    expect(response.json().status).not.toBe(created.json().status);
    expect(new Date(response.json().updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.json().updatedAt).getTime(),
    );
  });

  it('returns 200 when assigneeId is set and when cleared with null', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Assignable' },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const assigned = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().assigneeId).toBe(assignee.user.id);

    const cleared = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: null },
      { accessToken: owner.accessToken },
    );
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().assigneeId).toBeNull();
  });

  it('returns 200 when description is cleared with null', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Clear desc', description: 'Temporary' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await patchTask(
      testApp.app,
      created.json().id as string,
      { description: null },
      { accessToken },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().description).toBeNull();
  });

  it('leaves projectId unchanged because it is not accepted in the update body', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Immutable project' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await patchTask(
      testApp.app,
      taskId,
      { title: 'Still same project', projectId: 'other-project-id' },
      { accessToken },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().projectId).toBe(projectId);
  });

  it('returns 400 VALIDATION_ERROR when the update body is empty', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'No-op update' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await patchTask(
      testApp.app,
      created.json().id as string,
      {},
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'At least one field must be provided for update',
    });
  });

  it('returns 400 VALIDATION_ERROR when title is empty after trimming', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Valid' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await patchTask(
      testApp.app,
      created.json().id as string,
      { title: '   ' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Title is required',
    });
  });

  it('returns 400 VALIDATION_ERROR for an invalid status value', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Status check' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await patchTask(
      testApp.app,
      created.json().id as string,
      { status: 'ARCHIVED' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await patchTask(
      testApp.app,
      'missing-task-id',
      { title: 'Ghost' },
      { accessToken },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when another user attempts to update the task', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Protected' },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await patchTask(
      testApp.app,
      created.json().id as string,
      { title: 'Hijacked' },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when the assignee attempts to update the task', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Assigned work', assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await patchTask(
      testApp.app,
      taskId,
      { status: TaskStatus.DONE },
      { accessToken: assignee.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);

    const unchanged = await getTask(testApp.app, taskId, { accessToken: owner.accessToken });
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json().status).toBe(TaskStatus.TODO);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await patchTask(testApp.app, 'some-task-id', { title: 'Nope' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('DELETE /tasks/:id', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 204 and removes the task for the project owner', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'To delete' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await deleteTask(testApp.app, taskId, { accessToken });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const followUp = await getTask(testApp.app, taskId, { accessToken });
    expect(followUp.statusCode).toBe(404);
    expect(followUp.json()).toEqual(taskNotFoundBody);

    const listResponse = await listTasks(testApp.app, projectId, { accessToken });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({ tasks: [] });
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await deleteTask(testApp.app, 'missing-task-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when another user attempts to delete the task', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Keep' },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await deleteTask(testApp.app, taskId, {
      accessToken: intruder.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);

    const stillThere = await getTask(testApp.app, taskId, { accessToken: owner.accessToken });
    expect(stillThere.statusCode).toBe(200);
  });

  it('returns 403 TASK_UNAUTHORIZED when the assignee attempts to delete the task', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Assigned keep', assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const response = await deleteTask(testApp.app, taskId, {
      accessToken: assignee.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);

    const stillThere = await getTask(testApp.app, taskId, { accessToken: owner.accessToken });
    expect(stillThere.statusCode).toBe(200);
    expect(stillThere.json().assigneeId).toBe(assignee.user.id);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await deleteTask(testApp.app, 'some-task-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('Task CRUD lifecycle', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('supports create, list, get, update, and delete in sequence for the project owner', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'lifecycle@example.com',
      name: 'Lifecycle Owner',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'lifecycle-assignee@example.com',
      name: 'Lifecycle Assignee',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken, 'Lifecycle Project');

    const createResponse = await postTask(
      testApp.app,
      projectId,
      {
        title: 'Lifecycle task',
        description: 'Initial',
        status: TaskStatus.TODO,
        assigneeId: assignee.user.id,
      },
      { accessToken: owner.accessToken },
    );
    expect(createResponse.statusCode).toBe(201);
    const taskId = createResponse.json().id as string;

    const listResponse = await listTasks(testApp.app, projectId, {
      accessToken: owner.accessToken,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tasks).toHaveLength(1);
    expect(listResponse.json().tasks[0].id).toBe(taskId);

    const getResponse = await getTask(testApp.app, taskId, { accessToken: owner.accessToken });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({
      id: taskId,
      title: 'Lifecycle task',
      description: 'Initial',
      status: TaskStatus.TODO,
      projectId,
      assigneeId: assignee.user.id,
    });

    const assigneeDenied = await getTask(testApp.app, taskId, {
      accessToken: assignee.accessToken,
    });
    expect(assigneeDenied.statusCode).toBe(403);
    expect(assigneeDenied.json()).toEqual(taskUnauthorizedBody);

    const updateResponse = await patchTask(
      testApp.app,
      taskId,
      { title: 'Lifecycle updated', status: TaskStatus.DONE, description: 'Revised' },
      { accessToken: owner.accessToken },
    );
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      id: taskId,
      title: 'Lifecycle updated',
      description: 'Revised',
      status: TaskStatus.DONE,
      projectId,
      assigneeId: assignee.user.id,
    });

    const deleteResponse = await deleteTask(testApp.app, taskId, {
      accessToken: owner.accessToken,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const emptyList = await listTasks(testApp.app, projectId, {
      accessToken: owner.accessToken,
    });
    expect(emptyList.statusCode).toBe(200);
    expect(emptyList.json()).toEqual({ tasks: [] });
  });
});
