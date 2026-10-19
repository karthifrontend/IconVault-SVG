// Request body schemas (zod) for projects, folders and icons. A failed parse throws a ZodError, which the error handler turns into a 400. Unknown keys are rejected so a typo or a forbidden field (such as changing a project's purpose) never passes silently.
import { z } from "zod";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "must be a valid id");

const projectName = z.string().trim().min(1, "is required").max(100);
const description = z.string().trim().max(500);
const prefix = z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{1,20}$/, "use 1-20 letters, digits, - or _");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must look like #3b82f6");
const tag = z.string().trim().toLowerCase().min(1).max(40);
const tags = z.array(tag).max(50);
const codepoint = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{4,6}$/, "must be 4-6 hex digits")
  .transform((value) => value.toUpperCase());
const nullableId = objectId.nullable();

export const PURPOSES = ["sprite", "font"] as const;
export const VISIBILITIES = ["public", "private"] as const;
export const DUPLICATE_STRATEGIES = ["rename", "replace", "skip"] as const;

export const createProjectSchema = z
  .object({
    name: projectName,
    description: description.default(""),
    prefix: prefix.default("icon"),
    color: color.default("#3b82f6"),
    purpose: z.enum(PURPOSES).default("sprite"),
    visibility: z.enum(VISIBILITIES).default("private"),
  })
  .strict();

// Purpose is deliberately absent: it cannot change after creation.
export const updateProjectSchema = z
  .object({
    name: projectName,
    description,
    prefix,
    color,
    visibility: z.enum(VISIBILITIES),
    isArchived: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "provide at least one field to change");

export const createFolderSchema = z
  .object({
    name: projectName,
    parentId: nullableId.default(null),
  })
  .strict();

export const renameFolderSchema = z.object({ name: projectName }).strict();

export const moveFolderSchema = z
  .object({
    parentId: nullableId,
    orderIndex: z.number().int().min(0).optional(),
  })
  .strict();

export const updateIconSchema = z
  .object({
    name: projectName,
    folderId: nullableId,
    tags,
    codepoint: codepoint.nullable(),
    rawSvg: z.string().min(1).max(1_000_000),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "provide at least one field to change");

const iconIds = z.array(objectId).min(1, "select at least one icon").max(500, "at most 500 icons at a time");

export const batchMoveSchema = z.object({ iconIds, folderId: nullableId }).strict();
export const batchTagSchema = z
  .object({ iconIds, tags: tags.min(1), mode: z.enum(["add", "remove", "set"]).default("add") })
  .strict();
export const batchDeleteSchema = z.object({ iconIds, permanent: z.boolean().default(false) }).strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateIconInput = z.infer<typeof updateIconSchema>;
