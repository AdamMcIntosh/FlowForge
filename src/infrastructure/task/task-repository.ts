import type { PrismaClient, TaskStatus as PrismaTaskStatus } from '@prisma/client';

import { Task } from '../../domain/task/task.js';
import type { TaskStatusValue } from '../../domain/task/task-status.js';
import type { TaskRepository } from './types.js';

type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: PrismaTaskStatus;
  projectId: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPrismaTaskStatus(status: TaskStatusValue): PrismaTaskStatus {
  return status;
}

function mapRecordToTask(record: TaskRecord): Task {
  return Task.reconstitute({
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    projectId: record.projectId,
    assigneeId: record.assigneeId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function createPrismaTaskRepository(prisma: PrismaClient): TaskRepository {
  return {
    async save(task: Task): Promise<Task> {
      const props = task.toProps();
      const record = await prisma.task.create({
        data: {
          id: props.id,
          title: props.title,
          description: props.description,
          status: toPrismaTaskStatus(props.status),
          projectId: props.projectId,
          assigneeId: props.assigneeId,
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
        },
      });

      return mapRecordToTask(record);
    },

    async findById(id: string): Promise<Task | null> {
      const record = await prisma.task.findUnique({
        where: { id },
      });

      if (record === null) {
        return null;
      }

      return mapRecordToTask(record);
    },

    async findByProjectId(projectId: string): Promise<Task[]> {
      const records = await prisma.task.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
      });

      return records.map(mapRecordToTask);
    },

    async update(task: Task): Promise<Task> {
      const props = task.toProps();
      const record = await prisma.task.update({
        where: { id: props.id },
        data: {
          title: props.title,
          description: props.description,
          status: toPrismaTaskStatus(props.status),
          assigneeId: props.assigneeId,
          updatedAt: props.updatedAt,
        },
      });

      return mapRecordToTask(record);
    },

    async delete(id: string): Promise<void> {
      await prisma.task.delete({
        where: { id },
      });
    },
  };
}
