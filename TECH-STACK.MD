# FlowForge Technology Stack

## Backend
- **Runtime**: Node.js 20+ (ESM only)
- **Framework**: Fastify
- **Language**: TypeScript 5.x (strict)
- **Validation**: Zod
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (refresh tokens)
- **Rate Limiting**: Custom middleware with fixed-window
- **Testing**: Vitest + Supertest

## Frontend
- **Framework**: React 18 + Vite
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios or TanStack Query

## Development Tools
- ESLint + Prettier
- Prisma Studio
- Docker + Docker Compose
- npm scripts for dev, build, test

## Key Conventions
- All files use `.js` extensions in imports
- Repository pattern for data access
- Early rate limiting checks before body parsing
- Comprehensive integration tests for auth flows