import { z } from 'zod';

export const UpdateProjectLocationSchema = z.object({
  projectId: z.string().uuid(),
  siteLatitude: z.coerce.number().min(-90).max(90),
  siteLongitude: z.coerce.number().min(-180).max(180),
  // Null means "no geofence configured" — distinct from any numeric radius,
  // including 0. Empty-string form input must be converted to null by the
  // caller before parsing (z.null() only matches an exact null, not '').
  siteRadiusMeters: z
    .union([
      z.coerce.number().int().min(5, 'Radius must be at least 5 meters').max(5000, 'Radius must be at most 5000 meters'),
      z.null(),
    ])
    .optional(),
});

export type UpdateProjectLocationInput = z.infer<typeof UpdateProjectLocationSchema>;

// Mirrors UpdateTaskTotalSftSchema's rule (0 or more) — this is the
// project-wide target, a separate field from any individual task's totalSft.
export const UpdateProjectTotalSftSchema = z.object({
  projectId: z.string().uuid(),
  totalSft: z.coerce.number().min(0, 'Total SFT must be 0 or more'),
});

export type UpdateProjectTotalSftInput = z.infer<typeof UpdateProjectTotalSftSchema>;

// Mirrors CreateProjectSchema's field rules — same basic-info fields, editable after creation.
export const UpdateProjectInfoSchema = z.object({
  projectId: z.string().uuid(),
  name:     z.string().min(2).max(200),
  address:  z.string().max(500).optional().nullable(),
  area:     z.string().max(50).optional().nullable(),
  budget:   z.string().max(100).optional().nullable(),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
});

export type UpdateProjectInfoInput = z.infer<typeof UpdateProjectInfoSchema>;
