/**
 * Task authorization matrix — HTTP integration (in-memory repos only).
 *
 * Setup: No external infrastructure. Each test calls createTaskIntegrationTestApp()
 * in beforeEach for isolated ProjectRepository + TaskRepository instances.
 *
 * Primary focus: create + list (project scope via requireOwnedProject).
 * Task-scope coverage: get, update, delete (requireTaskAccessibleByProjectOwner),
 * including assignee-denied rows. Keeps the matrix focused without duplicating the
 * full CRUD suite in tests/tasks.integration.test.ts.
 *
 * Authorization model: only the project owner may access tasks. Assignee metadata
 * does not grant access.
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

const unauthorizedBody = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication required',
  code: 'AUTH_UNAUTHORIZED',
};

type OwnerFixture = {
  accessToken: string;
  projectId: string;
  taskId: string;
};

async function seedOwnerProjectWithTask(app: TaskIntegrationTestApp['app']): Promise<OwnerFixture> {
  const owner = await registerAndGetAccessToken(app, { email: 'owner@authz-matrix.example.com' });
  const projectId = await createOwnedProject(app, owner.accessToken, 'Authz Matrix Project');

  const created = await postTask(
    app,
    projectId,
    { title: 'Matrix seed task', status: TaskStatus.TODO },
    { accessToken: owner.accessToken },
  );
  expect(created.statusCode).toBe(201);

  return {
    accessToken: owner.accessToken,
    projectId,
    taskId: created.json().id as string,
  };
}

describe('Task authorization matrix (owner vs non-owner)', () => {
  let testApp: TaskIntegrationTestApp;

  beforeEach(async () => {
    testApp = await createTaskIntegrationTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('allows the project owner to create and list tasks (project scope)', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner-create-list@authz-matrix.example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken);

    const createResponse = await postTask(
      testApp.app,
      projectId,
      { title: 'Owner create', status: TaskStatus.IN_PROGRESS },
      { accessToken: owner.accessToken },
    );
    expect(createResponse.statusCode).toBe(201);
    const taskId = createResponse.json().id as string;

    const listResponse = await listTasks(testApp.app, projectId, {
      accessToken: owner.accessToken,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          title: 'Owner create',
          status: TaskStatus.IN_PROGRESS,
          projectId,
        }),
      ]),
    );
  });

  it('denies non-owners on create and list with PROJECT_OWNERSHIP (project scope)', async () => {
    const { accessToken: ownerToken, projectId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-project@authz-matrix.example.com',
    });

    const createDenied = await postTask(
      testApp.app,
      projectId,
      { title: 'Intruder create' },
      { accessToken: intruder.accessToken },
    );
    expect(createDenied.statusCode).toBe(403);
    expect(createDenied.json()).toEqual(projectOwnershipBody);

    const listDenied = await listTasks(testApp.app, projectId, {
      accessToken: intruder.accessToken,
    });
    expect(listDenied.statusCode).toBe(403);
    expect(listDenied.json()).toEqual(projectOwnershipBody);

    const ownerList = await listTasks(testApp.app, projectId, { accessToken: ownerToken });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json().tasks).toHaveLength(1);
  });

  it('denies unauthenticated callers on create and list with AUTH_UNAUTHORIZED', async () => {
    const { projectId } = await seedOwnerProjectWithTask(testApp.app);

    const createDenied = await postTask(testApp.app, projectId, { title: 'Anonymous create' });
    expect(createDenied.statusCode).toBe(401);
    expect(createDenied.json()).toEqual(unauthorizedBody);

    const listDenied = await listTasks(testApp.app, projectId);
    expect(listDenied.statusCode).toBe(401);
    expect(listDenied.json()).toEqual(unauthorizedBody);
  });

  it('allows the project owner to get a task by id (task scope)', async () => {
    const { accessToken, taskId, projectId } = await seedOwnerProjectWithTask(testApp.app);

    const response = await getTask(testApp.app, taskId, { accessToken });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: taskId,
      title: 'Matrix seed task',
      status: TaskStatus.TODO,
      projectId,
    });
  });

  it('denies non-owners on get with TASK_UNAUTHORIZED (task scope)', async () => {
    const { taskId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-get@authz-matrix.example.com',
    });

    const response = await getTask(testApp.app, taskId, { accessToken: intruder.accessToken });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(taskUnauthorizedBody);
  });

  it('allows owner update and denies non-owner update with TASK_UNAUTHORIZED (task scope)', async () => {
    const { accessToken: ownerToken, taskId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-update@authz-matrix.example.com',
    });

    const updateAllowed = await patchTask(
      testApp.app,
      taskId,
      { title: 'Owner updated title' },
      { accessToken: ownerToken },
    );
    expect(updateAllowed.statusCode).toBe(200);
    expect(updateAllowed.json().title).toBe('Owner updated title');

    const updateDenied = await patchTask(
      testApp.app,
      taskId,
      { title: 'Intruder update' },
      { accessToken: intruder.accessToken },
    );
    expect(updateDenied.statusCode).toBe(403);
    expect(updateDenied.json()).toEqual(taskUnauthorizedBody);

    const stillOwned = await getTask(testApp.app, taskId, { accessToken: ownerToken });
    expect(stillOwned.statusCode).toBe(200);
    expect(stillOwned.json().title).toBe('Owner updated title');
  });

  it('allows owner delete and denies non-owner delete with TASK_UNAUTHORIZED (task scope)', async () => {
    const { accessToken: ownerToken, taskId } = await seedOwnerProjectWithTask(testApp.app);
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder-delete@authz-matrix.example.com',
    });

    const deleteDenied = await deleteTask(testApp.app, taskId, {
      accessToken: intruder.accessToken,
    });
    expect(deleteDenied.statusCode).toBe(403);
    expect(deleteDenied.json()).toEqual(taskUnauthorizedBody);

    const deleteAllowed = await deleteTask(testApp.app, taskId, { accessToken: ownerToken });
    expect(deleteAllowed.statusCode).toBe(204);
    expect(deleteAllowed.body).toBe('');

    const followUp = await getTask(testApp.app, taskId, { accessToken: ownerToken });
    expect(followUp.statusCode).toBe(404);
  });

  it('denies the assignee on get, update, and delete with TASK_UNAUTHORIZED (task scope)', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner-assignee-deny@authz-matrix.example.com',
    });
    const assignee = await registerAndGetAccessToken(testApp.app, {
      email: 'assignee-deny@authz-matrix.example.com',
    });
    const projectId = await createOwnedProject(testApp.app, owner.accessToken, 'Assignee Deny Project');

    const created = await postTask(
      testApp.app,
      projectId,
      { title: 'Assigned matrix task', assigneeId: assignee.user.id },
      { accessToken: owner.accessToken },
    );
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id as string;

    const getDenied = await getTask(testApp.app, taskId, { accessToken: assignee.accessToken });
    expect(getDenied.statusCode).toBe(403);
    expect(getDenied.json()).toEqual(taskUnauthorizedBody);

    const updateDenied = await patchTask(
      testApp.app,
      taskId,
      { title: 'Assignee update attempt' },
      { accessToken: assignee.accessToken },
    );
    expect(updateDenied.statusCode).toBe(403);
    expect(updateDenied.json()).toEqual(taskUnauthorizedBody);

    const deleteDenied = await deleteTask(testApp.app, taskId, {
      accessToken: assignee.accessToken,
    });
    expect(deleteDenied.statusCode).toBe(403);
    expect(deleteDenied.json()).toEqual(taskUnauthorizedBody);

    const stillOwned = await getTask(testApp.app, taskId, { accessToken: owner.accessToken });
    expect(stillOwned.statusCode).toBe(200);
    expect(stillOwned.json()).toMatchObject({
      id: taskId,
      title: 'Assigned matrix task',
      assigneeId: assignee.user.id,
    });
  });
});
