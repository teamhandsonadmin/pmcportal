import { z } from 'zod';

export const AddTaskDependencySchema = z
  .object({
    taskId: z.string().uuid(),
    dependsOnTaskId: z.string().uuid(),
  })
  .refine((data) => data.taskId !== data.dependsOnTaskId, {
    message: 'A task cannot depend on itself',
    path: ['dependsOnTaskId'],
  });

export type AddTaskDependencyInput = z.infer<typeof AddTaskDependencySchema>;
