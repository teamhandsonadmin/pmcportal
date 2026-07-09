import { z } from 'zod';

export const UpdateProjectLocationSchema = z.object({
  projectId: z.string().uuid(),
  siteLatitude: z.coerce.number().min(-90).max(90),
  siteLongitude: z.coerce.number().min(-180).max(180),
});

export type UpdateProjectLocationInput = z.infer<typeof UpdateProjectLocationSchema>;
