import type { PrismaClient } from '@prisma/client';

import { Project } from '../../domain/project/project.js';
import type { ProjectRepository } from './types.js';

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

function mapRecordToProject(record: ProjectRecord): Project {
  return Project.reconstitute({
    id: record.id,
    name: record.name,
    description: record.description,
    ownerId: record.ownerId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function createPrismaProjectRepository(prisma: PrismaClient): ProjectRepository {
  return {
    async save(project: Project): Promise<Project> {
      const props = project.toProps();
      const record = await prisma.project.create({
        data: {
          id: props.id,
          name: props.name,
          description: props.description,
          ownerId: props.ownerId,
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
        },
      });

      return mapRecordToProject(record);
    },

    async findById(id: string): Promise<Project | null> {
      const record = await prisma.project.findUnique({
        where: { id },
      });

      if (record === null) {
        return null;
      }

      return mapRecordToProject(record);
    },

    async findByOwnerId(ownerId: string): Promise<Project[]> {
      const records = await prisma.project.findMany({
        where: { ownerId },
        orderBy: { updatedAt: 'desc' },
      });

      return records.map(mapRecordToProject);
    },

    async update(project: Project): Promise<Project> {
      const props = project.toProps();
      const record = await prisma.project.update({
        where: { id: props.id },
        data: {
          name: props.name,
          description: props.description,
          updatedAt: props.updatedAt,
        },
      });

      return mapRecordToProject(record);
    },

    async delete(id: string): Promise<void> {
      await prisma.project.delete({
        where: { id },
      });
    },
  };
}
