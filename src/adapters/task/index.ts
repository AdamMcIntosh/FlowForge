export { createTaskController, type TaskControllerDeps } from './task-controller.js';
export {
  createTaskBodySchema,
  projectIdParamSchema,
  taskIdParamSchema,
  updateTaskBodySchema,
  type CreateTaskBody,
  type ProjectIdParams,
  type TaskIdParams,
  type UpdateTaskBody,
} from './map-task-request.js';
export { mapTaskError, type TaskHttpError } from './map-task-error.js';
export { sendMappedTaskError, sendTaskHttpError } from './send-task-error.js';
