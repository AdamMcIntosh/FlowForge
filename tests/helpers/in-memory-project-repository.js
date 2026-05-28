export function createInMemoryProjectRepository() {
    const projectsById = new Map();
    return {
        async save(project) {
            projectsById.set(project.id, project);
            return project;
        },
        async findById(id) {
            return projectsById.get(id) ?? null;
        },
        async findByOwnerId(ownerId) {
            return [...projectsById.values()]
                .filter((project) => project.ownerId === ownerId)
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        },
        async update(project) {
            projectsById.set(project.id, project);
            return project;
        },
        async delete(id) {
            projectsById.delete(id);
        },
    };
}
//# sourceMappingURL=in-memory-project-repository.js.map