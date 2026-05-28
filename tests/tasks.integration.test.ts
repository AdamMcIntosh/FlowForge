/**
 * HTTP integration tests for Task CRUD, assignment, and status-change endpoints.
 *
 * Setup: No external infrastructure. Uses createTaskIntegrationTestApp() in
 * beforeEach for isolated in-memory user, project, and task repositories.
 *
 * HTTP helpers expect the Fastify instance (testApp.app). Project setup uses
 * createOwnedProject(testApp.app, accessToken).
 *
 * Single-field PATCH bodies route to dedicated use cases: `{ assigneeId }` → assign,
 * `{ status }` → changeStatus. Multi-field PATCH bodies use the general update use case.
 *
 * Authorization matrix (assignee denial, owner vs intruder per operation) lives
 * in tests/tasks-authz-matrix.integration.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TaskStatus } from '../src/domain/task/task-status.js';
import {
  createTaskIntegrationTestApp,
  type TaskIntegrationTestApp,
} from './helpers/create-task-integration-test-app.js';
import { registerAndGetAccessToken } from './helpers/project-http.js';
import {
  createOwnedProject,
  deleteTask,
  getTask,
  listTasks,
  patchTask,
  postTask,
} from './helpers/task-http.js';

const unauthorizedBody = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication required',
  code: 'AUTH_UNAUTHORIZED',
};

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

type OwnerFixture = {
  accessToken: string;
  projectId: string;
  taskId: string;
};

async function seedOwnerProjectWithTask(app: TaskIntegrationTestApp['app']): Promise<OwnerFixture> {
  const owner = await registerAndGetAccessToken(app, { email: 'owner@tasks-basic.example.com' });
  const projectId = await createOwnedProject(app, owner.accessToken);

  const created = await postTask(
    app,
    projectId,
    { title: 'Seed task', description: 'For CRUD tests', status: TaskStatus.TODO },
    { accessToken: owner.accessToken },
  );
  expect(created.statusCode).toBe(201);

  return {
    accessToken: owner.accessToken,
    projectId,
    taskId: created.json().id as string,
  };
}

describe('POST /projects/:id/tasks', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 201 with the created task for the project owner', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const projectId = await createOwnedProject(testApp.app, accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'New task', description: 'Details', status: TaskStatus.IN_PROGRESS },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: expect.any(String),
      title: 'New task',
      description: 'Details',
      status: TaskStatus.IN_PROGRESS,
      projectId,
      assigneeId: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await postTask(testApp.app, 'some-project-id', { title: 'No auth' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when a non-owner creates a task in a foreign project', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, { email: 'owner-post@example.com' });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-post@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const response = await postTask(
      testApp.app,
      projectId,
      { title: 'Forbidden create' },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(projectOwnershipBody);
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
});

describe('GET /projects/:id/tasks', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with tasks belonging to the requested project', async () => {
    const { accessToken, projectId, taskId } = await seedOwnerProjectWithTask(testApp.app);

    const response = await listTasks(testApp.app, projectId, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json().tasks).toEqual([
      expect.objectContaining({
        id: taskId,
        title: 'Seed task',
        projectId,
        status: TaskStatus.TODO,
      }),
    ]);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await listTasks(testApp.app, 'some-project-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when a non-owner lists tasks in a foreign project', async () => {
    const { projectId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-list@example.com',
    });

    const response = await listTasks(testApp.app, projectId, { accessToken: intruder.accessToken });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(projectOwnershipBody);
  });

  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await listTasks(testApp.app, 'missing-project-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(projectNotFoundBody);
  });
});

describe('GET /tasks/:id', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the task when the project owner requests it by id', async () => {
    const { accessToken, projectId, taskId } = await seedOwnerProjectWithTask(testApp.app);

    const response = await getTask(testApp.app, taskId, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: taskId,
      title: 'Seed task',
      description: 'For CRUD tests',
      status: TaskStatus.TODO,
      projectId,
      assigneeId: null,
    });
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await getTask(testApp.app, 'some-task-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when a non-owner requests the task', async () => {
    const { taskId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-get@example.com',
    });

    const response = await getTask(testApp.app, taskId, { accessToken: intruder.accessToken });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await getTask(testApp.app, 'missing-task-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });
});

describe('PATCH /tasks/:id', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the updated task for the project owner', async () => {
    const { accessToken, projectId, taskId } = await seedOwnerProjectWithTask(testApp.app);

    const response = await patchTask(
      testApp.app,
      taskId,
      { title: 'Updated title', status: TaskStatus.DONE },
      { accessToken },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: taskId,
      title: 'Updated title',
      status: TaskStatus.DONE,
      projectId,
    });
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await patchTask(testApp.app, 'some-task-id', { title: 'Nope' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when a non-owner updates the task', async () => {
    const { taskId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-patch@example.com',
    });

    const response = await patchTask(
      testApp.app,
      taskId,
      { title: 'Hijacked' },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);
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
});

describe('DELETE /tasks/:id', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 204 and removes the task for the project owner', async () => {
    const { accessToken, projectId, taskId } = await seedOwnerProjectWithTask(testApp.app);

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

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await deleteTask(testApp.app, 'some-task-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when a non-owner deletes the task', async () => {
    const { taskId, accessToken: ownerToken } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-delete@example.com',
    });

    const response = await deleteTask(testApp.app, taskId, { accessToken: intruder.accessToken });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);

    const stillThere = await getTask(testApp.app, taskId, { accessToken: ownerToken });
    expect(stillThere.statusCode).toBe(200);
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await deleteTask(testApp.app, 'missing-task-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });
});

describe('PATCH /tasks/:id — assignment', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the assigned user when the project owner sets assigneeId', async () => {
    const { accessToken, projectId, taskId } = await seedOwnerProjectWithTask(testApp.app);
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee@tasks-basic.example.com',
    });

    const response = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: assignee.user.id },
      { accessToken },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: taskId,
      projectId,
      assigneeId: assignee.user.id,
      status: TaskStatus.TODO,
    });

    const followUp = await getTask(testApp.app, taskId, { accessToken });
    expect(followUp.statusCode).toBe(200);
    expect(followUp.json().assigneeId).toBe(assignee.user.id);
  });

  it('returns 200 and clears assigneeId when the project owner sends null', async () => {
    const { accessToken, taskId } = await seedOwnerProjectWithTask(testApp.app);
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'unassign@tasks-basic.example.com',
    });

    const assignResponse = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: assignee.user.id },
      { accessToken },
    );
    expect(assignResponse.statusCode).toBe(200);
    expect(assignResponse.json().assigneeId).toBe(assignee.user.id);

    const unassignResponse = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: null },
      { accessToken },
    );

    expect(unassignResponse.statusCode).toBe(200);
    expect(unassignResponse.json().assigneeId).toBeNull();

    const followUp = await getTask(testApp.app, taskId, { accessToken });
    expect(followUp.statusCode).toBe(200);
    expect(followUp.json().assigneeId).toBeNull();
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const { taskId } = await seedOwnerProjectWithTask(testApp.app);
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assign-no-auth@tasks-basic.example.com',
    });

    const response = await patchTask(testApp.app, taskId, { assigneeId: assignee.user.id });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when a non-owner assigns the task', async () => {
    const { taskId, accessToken: ownerToken } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-assign@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'target-assignee@example.com',
    });

    const response = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: assignee.user.id },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);

    const stillUnassigned = await getTask(testApp.app, taskId, { accessToken: ownerToken });
    expect(stillUnassigned.statusCode).toBe(200);
    expect(stillUnassigned.json().assigneeId).toBeNull();
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assign-missing@tasks-basic.example.com',
    });

    const response = await patchTask(
      testApp.app,
      'missing-task-id',
      { assigneeId: assignee.user.id },
      { accessToken },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });
});

describe('PATCH /tasks/:id — status change', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 when the project owner advances status todo → in_progress → done', async () => {
    const { accessToken, projectId, taskId } = await seedOwnerProjectWithTask(testApp.app);

    const toInProgress = await patchTask(
      testApp.app,
      taskId,
      { status: TaskStatus.IN_PROGRESS },
      { accessToken },
    );

    expect(toInProgress.statusCode).toBe(200);
    expect(toInProgress.json()).toMatchObject({
      id: taskId,
      projectId,
      status: TaskStatus.IN_PROGRESS,
    });

    const toDone = await patchTask(
      testApp.app,
      taskId,
      { status: TaskStatus.DONE },
      { accessToken },
    );

    expect(toDone.statusCode).toBe(200);
    expect(toDone.json()).toMatchObject({
      id: taskId,
      projectId,
      status: TaskStatus.DONE,
    });

    const followUp = await getTask(testApp.app, taskId, { accessToken });
    expect(followUp.statusCode).toBe(200);
    expect(followUp.json().status).toBe(TaskStatus.DONE);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const { taskId } = await seedOwnerProjectWithTask(testApp.app);

    const response = await patchTask(testApp.app, taskId, { status: TaskStatus.DONE });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody);
  });

  it('returns 403 TASK_UNAUTHORIZED when a non-owner changes task status', async () => {
    const { taskId, accessToken: ownerToken } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-status@example.com',
    });

    const response = await patchTask(
      testApp.app,
      taskId,
      { status: TaskStatus.DONE },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);

    const unchanged = await getTask(testApp.app, taskId, { accessToken: ownerToken });
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json().status).toBe(TaskStatus.TODO);
  });

  it('returns 400 VALIDATION_ERROR when status is not a valid enum value', async () => {
    const { accessToken, taskId } = await seedOwnerProjectWithTask(testApp.app);

    const response = await patchTask(
      testApp.app,
      taskId,
      { status: 'not-a-status' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns 404 TASK_NOT_FOUND when the task does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await patchTask(
      testApp.app,
      'missing-task-id',
      { status: TaskStatus.DONE },
      { accessToken },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(taskNotFoundBody);
  });
});

describe('Task assignment and status lifecycle', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('supports assign then status progression for the project owner', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'lifecycle-assign-status@example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'lifecycle-assignee@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken, 'Assign Status Project');

    const createResponse = await postTask(
      testApp.app,
      projectId,
      { title: 'Workflow task', status: TaskStatus.TODO },
      { accessToken: owner.accessToken },
    );
    expect(createResponse.statusCode).toBe(201);
    const taskId = createResponse.json().id as string;

    const assignResponse = await patchTask(
      testApp.app,
      taskId,
      { assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );
    expect(assignResponse.statusCode).toBe(200);
    expect(assignResponse.json()).toMatchObject({
      assigneeId: assignee.user.id,
      status: TaskStatus.TODO,
    });

    const inProgressResponse = await patchTask(
      testApp.app,
      taskId,
      { status: TaskStatus.IN_PROGRESS },
      { accessToken: owner.accessToken },
    );
    expect(inProgressResponse.statusCode).toBe(200);
    expect(inProgressResponse.json()).toMatchObject({
      assigneeId: assignee.user.id,
      status: TaskStatus.IN_PROGRESS,
    });

    const doneResponse = await patchTask(
      testApp.app,
      taskId,
      { status: TaskStatus.DONE },
      { accessToken: owner.accessToken },
    );
    expect(doneResponse.statusCode).toBe(200);
    expect(doneResponse.json()).toMatchObject({
      assigneeId: assignee.user.id,
      status: TaskStatus.DONE,
    });
  });
});

describe('Task CRUD lifecycle', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('supports create, list, get, update, and delete in sequence for the project owner', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app, {
      email: 'lifecycle@example.com',
    });
    const projectId = await createOwnedProject(testApp.app, accessToken, 'Lifecycle Project');

    const createResponse = await postTask(
      testApp.app,
      projectId,
      { title: 'Lifecycle task', status: TaskStatus.TODO },
      { accessToken },
    );
    expect(createResponse.statusCode).toBe(201);
    const taskId = createResponse.json().id as string;

    const listResponse = await listTasks(testApp.app, projectId, { accessToken });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tasks).toHaveLength(1);
    expect(listResponse.json().tasks[0].id).toBe(taskId);

    const getResponse = await getTask(testApp.app, taskId, { accessToken });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().title).toBe('Lifecycle task');

    const updateResponse = await patchTask(
      testApp.app,
      taskId,
      { title: 'Lifecycle updated', status: TaskStatus.DONE },
      { accessToken },
    );
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      title: 'Lifecycle updated',
      status: TaskStatus.DONE,
    });

    const deleteResponse = await deleteTask(testApp.app, taskId, { accessToken });
    expect(deleteResponse.statusCode).toBe(204);

    const emptyList = await listTasks(testApp.app, projectId, { accessToken });
    expect(emptyList.statusCode).toBe(200);
    expect(emptyList.json()).toEqual({ tasks: [] });
  });
});
