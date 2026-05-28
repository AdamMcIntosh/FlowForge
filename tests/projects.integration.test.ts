/**
 * Integration tests for /projects CRUD HTTP endpoints.
 *
 * Setup: No external infrastructure required. Uses buildServer() with in-memory
 * user and project repositories (see tests/helpers/create-auth-test-app.ts).
 * Each describe block creates a fresh app to avoid cross-test state leakage.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createAuthTestApp,
  type AuthTestApp,
} from './helpers/create-auth-test-app.js';
import {
  deleteProject,
  getProject,
  listProjects,
  patchProject,
  postProject,
  registerAndGetAccessToken,
} from './helpers/project-http.js';

const unauthorizedBody = (message: string) => ({
  statusCode: 401,
  error: 'Unauthorized',
  message,
  code: 'AUTH_UNAUTHORIZED',
});

const ownershipBody = {
  statusCode: 403,
  error: 'Forbidden',
  message: 'You do not have permission to access this project',
  code: 'PROJECT_OWNERSHIP',
};

const notFoundBody = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Project not found',
  code: 'PROJECT_NOT_FOUND',
};

function repeatChar(char: string, count: number): string {
  return char.repeat(count);
}

describe('POST /projects', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 201 with the created project for a valid authenticated request', async () => {
    const { accessToken, user } = await registerAndGetAccessToken(testApp.app, {
      email: 'creator@example.com',
      name: 'Creator',
    });

    const response = await postProject(
      testApp.app,
      { name: 'FlowForge', description: 'Task management' },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body).toEqual({
      id: expect.any(String),
      name: 'FlowForge',
      description: 'Task management',
      ownerId: user.id,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });

  it('defaults description to null when omitted', async () => {
    const { accessToken, user } = await registerAndGetAccessToken(testApp.app);

    const response = await postProject(testApp.app, { name: 'No Description' }, { accessToken });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: 'No Description',
      description: null,
      ownerId: user.id,
    });
  });

  it('assigns ownerId from the JWT subject, ignoring any ownerId in the request body', async () => {
    const { accessToken, user } = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });

    const response = await postProject(
      testApp.app,
      { name: 'Owned Project', ownerId: 'attacker-id' },
      { accessToken },
    );

    expect(response.statusCode).toBe(201);
    expect(response.json().ownerId).toBe(user.id);
    expect(response.json().ownerId).not.toBe('attacker-id');
  });

  it('returns 400 VALIDATION_ERROR when name is missing', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await postProject(testApp.app, { description: 'No name' }, { accessToken });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Name is required',
    });
  });

  it('returns 400 VALIDATION_ERROR when name is empty after trimming', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await postProject(testApp.app, { name: '   ' }, { accessToken });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Name is required',
    });
  });

  it('returns 400 VALIDATION_ERROR when name exceeds 255 characters', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await postProject(
      testApp.app,
      { name: repeatChar('a', 256) },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Name must be at most 255 characters',
    });
  });

  it('returns 400 VALIDATION_ERROR when description exceeds 2000 characters', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await postProject(
      testApp.app,
      { name: 'Valid Name', description: repeatChar('d', 2001) },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Description must be at most 2000 characters',
    });
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await postProject(testApp.app, { name: 'Unauthorized' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });

  it('returns 401 for a malformed bearer token', async () => {
    const response = await postProject(
      testApp.app,
      { name: 'Unauthorized' },
      { accessToken: 'not-a-jwt' },
    );

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Invalid or expired token'));
  });
});

describe('GET /projects', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with an empty list when the user has no projects', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await listProjects(testApp.app, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ projects: [] });
  });

  it('returns only projects owned by the authenticated user', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
      name: 'Owner',
    });
    const other = await registerAndGetAccessToken(testApp.app, {
      email: 'other@example.com',
      name: 'Other',
    });

    const owned = await postProject(testApp.app, { name: 'Mine' }, { accessToken: owner.accessToken });
    expect(owned.statusCode).toBe(201);

    const foreign = await postProject(
      testApp.app,
      { name: 'Theirs' },
      { accessToken: other.accessToken },
    );
    expect(foreign.statusCode).toBe(201);

    const response = await listProjects(testApp.app, { accessToken: owner.accessToken });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      id: owned.json().id,
      name: 'Mine',
      ownerId: owner.user.id,
    });
  });

  it('orders projects by most recently updated first', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const first = await postProject(testApp.app, { name: 'First' }, { accessToken });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().id as string;

    const second = await postProject(testApp.app, { name: 'Second' }, { accessToken });
    expect(second.statusCode).toBe(201);
    const secondId = second.json().id as string;

    const updatedFirst = await patchProject(
      testApp.app,
      firstId,
      { description: 'Updated later' },
      { accessToken },
    );
    expect(updatedFirst.statusCode).toBe(200);

    const response = await listProjects(testApp.app, { accessToken });

    expect(response.statusCode).toBe(200);
    const ids = response.json().projects.map((project: { id: string }) => project.id);
    expect(ids).toEqual([firstId, secondId]);
    expect(ids[0]).not.toBe(secondId);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await listProjects(testApp.app);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('GET /projects/:id', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the project when the authenticated user is the owner', async () => {
    const { accessToken, user } = await registerAndGetAccessToken(testApp.app);

    const created = await postProject(
      testApp.app,
      { name: 'Detail Project', description: 'Details' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id as string;

    const response = await getProject(testApp.app, projectId, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: projectId,
      name: 'Detail Project',
      description: 'Details',
      ownerId: user.id,
      createdAt: created.json().createdAt,
      updatedAt: created.json().updatedAt,
    });
  });

  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await getProject(testApp.app, 'missing-project-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(notFoundBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when another user requests the project', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });

    const created = await postProject(testApp.app, { name: 'Private' }, { accessToken: owner.accessToken });
    expect(created.statusCode).toBe(201);

    const response = await getProject(testApp.app, created.json().id as string, {
      accessToken: intruder.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(ownershipBody);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await getProject(testApp.app, 'some-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('PATCH /projects/:id', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with the updated project when name is changed', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const created = await postProject(
      testApp.app,
      { name: 'Before', description: 'Keep me' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id as string;

    const response = await patchProject(testApp.app, projectId, { name: 'After' }, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: projectId,
      name: 'After',
      description: 'Keep me',
    });
    expect(response.json().updatedAt).not.toBe(created.json().updatedAt);
  });

  it('returns 200 when description is cleared with null', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const created = await postProject(
      testApp.app,
      { name: 'Clear Desc', description: 'Temporary' },
      { accessToken },
    );
    expect(created.statusCode).toBe(201);

    const response = await patchProject(
      testApp.app,
      created.json().id as string,
      { description: null },
      { accessToken },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().description).toBeNull();
  });

  it('returns 400 VALIDATION_ERROR when the update body is empty', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const created = await postProject(testApp.app, { name: 'Immutable' }, { accessToken });
    expect(created.statusCode).toBe(201);

    const response = await patchProject(
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

  it('returns 400 VALIDATION_ERROR when name is empty after trimming', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const created = await postProject(testApp.app, { name: 'Valid' }, { accessToken });
    expect(created.statusCode).toBe(201);

    const response = await patchProject(
      testApp.app,
      created.json().id as string,
      { name: '   ' },
      { accessToken },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Name is required',
    });
  });

  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await patchProject(
      testApp.app,
      'missing-project-id',
      { name: 'Ghost' },
      { accessToken },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(notFoundBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when another user attempts to update the project', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });

    const created = await postProject(testApp.app, { name: 'Protected' }, { accessToken: owner.accessToken });
    expect(created.statusCode).toBe(201);

    const response = await patchProject(
      testApp.app,
      created.json().id as string,
      { name: 'Hijacked' },
      { accessToken: intruder.accessToken },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(ownershipBody);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await patchProject(testApp.app, 'some-id', { name: 'Nope' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('DELETE /projects/:id', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 204 and removes the project for the owner', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const created = await postProject(testApp.app, { name: 'To Delete' }, { accessToken });
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id as string;

    const response = await deleteProject(testApp.app, projectId, { accessToken });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const followUp = await getProject(testApp.app, projectId, { accessToken });
    expect(followUp.statusCode).toBe(404);
    expect(followUp.json()).toEqual(notFoundBody);
  });

  it('returns 404 PROJECT_NOT_FOUND when the project does not exist', async () => {
    const { accessToken } = await registerAndGetAccessToken(testApp.app);

    const response = await deleteProject(testApp.app, 'missing-project-id', { accessToken });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(notFoundBody);
  });

  it('returns 403 PROJECT_OWNERSHIP when another user attempts to delete the project', async () => {
    const owner = await registerAndGetAccessToken(testApp.app, {
      email: 'owner@example.com',
    });
    const intruder = await registerAndGetAccessToken(testApp.app, {
      email: 'intruder@example.com',
    });

    const created = await postProject(testApp.app, { name: 'Keep' }, { accessToken: owner.accessToken });
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id as string;

    const response = await deleteProject(testApp.app, projectId, {
      accessToken: intruder.accessToken,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(ownershipBody);

    const stillThere = await getProject(testApp.app, projectId, { accessToken: owner.accessToken });
    expect(stillThere.statusCode).toBe(200);
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await deleteProject(testApp.app, 'some-id');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });
});

describe('Project CRUD lifecycle', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('supports create, list, get, update, and delete in sequence for one user', async () => {
    const { accessToken, user } = await registerAndGetAccessToken(testApp.app, {
      email: 'lifecycle@example.com',
      name: 'Lifecycle User',
    });

    const createResponse = await postProject(
      testApp.app,
      { name: 'Lifecycle Project', description: 'Initial' },
      { accessToken },
    );
    expect(createResponse.statusCode).toBe(201);
    const projectId = createResponse.json().id as string;

    const listResponse = await listProjects(testApp.app, { accessToken });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().projects).toHaveLength(1);
    expect(listResponse.json().projects[0].id).toBe(projectId);

    const getResponse = await getProject(testApp.app, projectId, { accessToken });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({
      id: projectId,
      name: 'Lifecycle Project',
      description: 'Initial',
      ownerId: user.id,
    });

    const updateResponse = await patchProject(
      testApp.app,
      projectId,
      { name: 'Lifecycle Updated', description: 'Revised' },
      { accessToken },
    );
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      id: projectId,
      name: 'Lifecycle Updated',
      description: 'Revised',
      ownerId: user.id,
    });

    const deleteResponse = await deleteProject(testApp.app, projectId, { accessToken });
    expect(deleteResponse.statusCode).toBe(204);

    const emptyList = await listProjects(testApp.app, { accessToken });
    expect(emptyList.statusCode).toBe(200);
    expect(emptyList.json()).toEqual({ projects: [] });
  });
});
