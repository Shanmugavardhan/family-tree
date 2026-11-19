import { z } from 'zod';

const dateRegex = /^\d{4}(-\d{2}-\d{2})?$/;

export const GenderSchema = z.enum(['male', 'female', 'other', 'unknown']);

export const PersonSchema = z.object({
  id: z.string().uuid({ message: 'Person ID must be a valid RFC 4122 UUID' }),
  first_name: z.string().trim().min(1, { message: 'First name is required' }),
  middle_name: z.string().trim().nullable().default(null),
  last_name: z.string().trim().nullable().default(null),
  alias: z.string().trim().nullable().default(null),
  gender: GenderSchema,
  birth_date: z
    .string()
    .regex(dateRegex, { message: 'Birth date must be in YYYY-MM-DD format' })
    .nullable()
    .default(null),
  death_date: z
    .string()
    .regex(dateRegex, { message: 'Death date must be in YYYY-MM-DD format' })
    .nullable()
    .default(null),
  birth_place: z.string().trim().nullable().default(null),
  death_place: z.string().trim().nullable().default(null),
  profile_photo: z.string().trim().nullable().default(null),
  biography: z.string().default(''),
  is_living: z.boolean().default(true),
  is_archived: z.boolean().default(false),
  created_at: z.string().datetime({ message: 'created_at must be an ISO 8601 timestamp' }),
  updated_at: z.string().datetime({ message: 'updated_at must be an ISO 8601 timestamp' }),
  archived_at: z
    .string()
    .datetime({ message: 'archived_at must be an ISO 8601 timestamp' })
    .nullable()
    .default(null),
}).superRefine((val, ctx) => {
  // Living/Deceased consistency
  if (val.is_living && val.death_date !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A living person cannot have a death date',
      path: ['death_date'],
    });
  }

  // Archived consistency
  if (val.is_archived && val.archived_at === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An archived person must have an archived_at timestamp',
      path: ['archived_at'],
    });
  }
  if (!val.is_archived && val.archived_at !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An unarchived person cannot have an archived_at timestamp',
      path: ['archived_at'],
    });
  }
});

export const CreatePersonSchema = z.object({
  id: z.string().uuid().optional(),
  first_name: z.string().trim().min(1, { message: 'First name is required' }),
  middle_name: z.string().trim().nullable().optional().default(null),
  last_name: z.string().trim().nullable().optional().default(null),
  alias: z.string().trim().nullable().optional().default(null),
  gender: GenderSchema,
  birth_date: z.string().regex(dateRegex).nullable().optional().default(null),
  death_date: z.string().regex(dateRegex).nullable().optional().default(null),
  birth_place: z.string().trim().nullable().optional().default(null),
  death_place: z.string().trim().nullable().optional().default(null),
  profile_photo: z.string().trim().nullable().optional().default(null),
  biography: z.string().optional().default(''),
  is_living: z.boolean().optional().default(true),
  father_id: z.string().uuid().nullable().optional().default(null),
  mother_id: z.string().uuid().nullable().optional().default(null),
  spouse_id: z.string().uuid().nullable().optional().default(null),
}).superRefine((val, ctx) => {
  if (val.is_living && val.death_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A living person cannot have a death date',
      path: ['death_date'],
    });
  }
});

export const UpdatePersonSchema = z.object({
  first_name: z.string().trim().min(1).optional(),
  middle_name: z.string().trim().nullable().optional(),
  last_name: z.string().trim().nullable().optional(),
  alias: z.string().trim().nullable().optional(),
  gender: GenderSchema.optional(),
  birth_date: z.string().regex(dateRegex).nullable().optional(),
  death_date: z.string().regex(dateRegex).nullable().optional(),
  birth_place: z.string().trim().nullable().optional(),
  death_place: z.string().trim().nullable().optional(),
  profile_photo: z.string().trim().nullable().optional(),
  biography: z.string().optional(),
  is_living: z.boolean().optional(),
});

