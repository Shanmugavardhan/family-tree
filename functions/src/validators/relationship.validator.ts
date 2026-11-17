import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const RelationshipTypeSchema = z.enum(['parent', 'spouse']);
export const ParentTypeSchema = z.enum(['biological', 'adoptive', 'step', 'legal']).nullable();

export const RelationshipSchema = z.object({
  id: z.string().uuid({ message: 'Relationship ID must be a valid RFC 4122 UUID' }),
  person_id: z.string().uuid({ message: 'person_id must be a valid UUID' }),
  related_person_id: z.string().uuid({ message: 'related_person_id must be a valid UUID' }),
  relationship_type: RelationshipTypeSchema,
  parent_type: ParentTypeSchema.default(null),
  start_date: z.string().regex(dateRegex, { message: 'start_date must be in YYYY-MM-DD format' }).nullable().default(null),
  end_date: z.string().regex(dateRegex, { message: 'end_date must be in YYYY-MM-DD format' }).nullable().default(null),
  notes: z.string().nullable().default(null),
  created_at: z.string().datetime({ message: 'created_at must be an ISO 8601 timestamp' }),
}).superRefine((val, ctx) => {
  // Rule: No self relations
  if (val.person_id === val.related_person_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A person cannot have a relationship with themselves',
      path: ['related_person_id'],
    });
  }

  // Rule: parent_type constraints
  if (val.relationship_type === 'parent' && val.parent_type === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Parent relationships must specify a parent_type',
      path: ['parent_type'],
    });
  }

  if (val.relationship_type === 'spouse' && val.parent_type !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Spouse relationships cannot have a parent_type',
      path: ['parent_type'],
    });
  }
});

export const CreateRelationshipSchema = z.object({
  id: z.undefined({ message: 'Client-supplied ID is not allowed during relationship creation.' }).optional(),
  person_id: z.string().uuid({ message: 'person_id must be a valid UUID' }),
  related_person_id: z.string().uuid({ message: 'related_person_id must be a valid UUID' }),
  relationship_type: RelationshipTypeSchema,
  parent_type: ParentTypeSchema.optional().default(null),
  start_date: z.string().regex(dateRegex, { message: 'start_date must be in YYYY-MM-DD format' }).nullable().optional().default(null),
  end_date: z.string().regex(dateRegex, { message: 'end_date must be in YYYY-MM-DD format' }).nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
}).superRefine((val, ctx) => {
  if (val.person_id === val.related_person_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A person cannot have a relationship with themselves',
      path: ['related_person_id'],
    });
  }

  if (val.relationship_type === 'parent') {
    if (!val.parent_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent relationships must specify a parent_type (biological, adoptive, step, legal)',
        path: ['parent_type'],
      });
    }
  }

  if (val.relationship_type === 'spouse') {
    if (val.parent_type !== null && val.parent_type !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Spouse relationships cannot have a parent_type',
        path: ['parent_type'],
      });
    }
  }
});

export const UpdateRelationshipSchema = z.object({
  parent_type: ParentTypeSchema.optional(),
  start_date: z.string().regex(dateRegex, { message: 'start_date must be in YYYY-MM-DD format' }).nullable().optional(),
  end_date: z.string().regex(dateRegex, { message: 'end_date must be in YYYY-MM-DD format' }).nullable().optional(),
  notes: z.string().nullable().optional(),
});
