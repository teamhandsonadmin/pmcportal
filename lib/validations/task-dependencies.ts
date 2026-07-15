import { z } from 'zod';

export const DependencyTypeSchema = z.enum(['FS', 'SS', 'FF', 'SF']);

export const AddTaskDependencySchema = z
  .object({
    taskId: z.string().uuid(),
    dependsOnTaskId: z.string().uuid(),
    type: DependencyTypeSchema.optional().default('FS'),
  })
  .refine((data) => data.taskId !== data.dependsOnTaskId, {
    message: 'A task cannot depend on itself',
    path: ['dependsOnTaskId'],
  });

export type AddTaskDependencyInput = z.infer<typeof AddTaskDependencySchema>;

export const UpdateDependencyTypeSchema = z.object({
  dependencyId: z.string().uuid(),
  type: DependencyTypeSchema,
});
