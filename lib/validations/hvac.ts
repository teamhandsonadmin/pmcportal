import { z } from 'zod';

// Shared by every optional date field across these schemas — a native/hidden
// date input always submits '' (not an absent key) when left blank, so the
// literal('') escape hatch is required, not just .optional().nullable().
const optionalDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .optional()
  .nullable()
  .or(z.literal(''));

export const CreateTaskSchema = z.object({
  task_name: z
    .string()
    .min(3, 'Task name must be at least 3 characters')
    .max(200, 'Task name is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  planned_start_date: optionalDateField,
  due_date: optionalDateField,
  task_type_id: z.string().uuid('Invalid task type').optional().nullable().or(z.literal('')),
  assigned_to: z.string().uuid('Invalid user').optional().nullable().or(z.literal('')),
  work_id: z.string().uuid('Invalid work ID'),
  total_sft: z.coerce.number().min(0, 'Total SFT must be 0 or more').optional(),
});

// Planned dates only — actual dates (actualStartDate/actualEndDate) are
// deferred until the capture mechanism is decided; see the note on
// validateTaskDates() in lib/utils/working-days.ts.
export const UpdateTaskPlannedDatesSchema = z.object({
  planned_start_date: optionalDateField,
  due_date: optionalDateField,
});

export const TaskTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  default_duration_days: z.coerce.number().int().min(1, 'Must be at least 1 working day').max(365, 'That seems too long'),
});

export const UpdateTaskStatusSchema = z.object({
  status: z.enum(['draft', 'ready', 'in_progress', 'on_hold', 'completed']),
});

export const UpdateDependencySchema = z.object({
  status: z.enum(['YES', 'NO', 'ON_HOLD', 'PENDING', 'REVISIONS', 'PROCEED']),
  comment: z.string().max(500, 'Comment is too long').optional().nullable(),
});

export const CreateDependencyItemSchema = z.object({
  task_id: z.string().uuid(),
  category: z.enum(['architect', 'client', 'consultant', 'contractor', 'inspector', 'procurement']),
  item_label: z.string().min(3).max(300),
  is_mandatory: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export const AddCommentSchema = z.object({
  comment: z.string().min(1, 'Comment cannot be empty').max(1000),
});

export const AddHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  name: z.string().min(1).max(200),
  type: z.enum(['national_holiday', 'festival_holiday', 'regional_holiday', 'company_shutdown']),
  description: z.string().max(500).optional().nullable(),
});

export const AddTemplateItemSchema = z.object({
  category: z.enum(['architect', 'client', 'consultant', 'contractor', 'inspector', 'procurement']),
  label: z.string().min(2, 'Label must be at least 2 characters').max(200),
});

export const CreateWorkSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code must be 10 characters or less')
    .regex(/^[A-Za-z0-9]+$/, 'Code must be letters and numbers only')
    .transform((v) => v.toUpperCase()),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color hex').default('#6366F1'),
});

export const CreateSftEntrySchema = z.object({
  taskId: z.string().uuid(),
  entryDate: z.coerce.date(),
  sftCompleted: z.coerce.number().min(0, 'SFT completed must be 0 or more'),
  headcount: z.coerce.number().int().min(0, 'Headcount must be 0 or more').optional(),
  notes: z.string().max(1000, 'Notes are too long').optional(),
});

export const UpdateTaskTotalSftSchema = z.object({
  taskId: z.string().uuid(),
  totalSft: z.coerce.number().min(0, 'Total SFT must be 0 or more'),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateTaskStatusSchema>;
export type UpdateDepInput = z.infer<typeof UpdateDependencySchema>;
export type CreateWorkInput = z.infer<typeof CreateWorkSchema>;
export type CreateSftEntryInput = z.infer<typeof CreateSftEntrySchema>;
export type UpdateTaskTotalSftInput = z.infer<typeof UpdateTaskTotalSftSchema>;
