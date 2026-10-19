// A project is a workspace that owns folders and icons. It replaces the old "bundle" as the unit users organize, share and build from.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PROJECT_PURPOSES = ["sprite", "font"] as const;
export const PROJECT_VISIBILITIES = ["public", "private"] as const;

export const projectSchema = new Schema(
  {
    // The user who created the project. Only the owner (or an admin) can change it.
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    // Lower-case prefix used for generated icon ids and CSS classes, e.g. "feather".
    prefix: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]{1,20}$/,
      default: "icon",
    },
    // Accent colour shown on the project card, as #rrggbb.
    color: {
      type: String,
      match: /^#[0-9a-fA-F]{6}$/,
      default: "#3b82f6",
    },
    // Chosen at creation and fixed afterwards: decides whether the Sprite or Font tab is shown.
    purpose: {
      type: String,
      enum: PROJECT_PURPOSES,
      default: "sprite",
    },
    // Public projects can be viewed (and icons copied out) by any signed-in user; only the owner or an admin can change them.
    visibility: {
      type: String,
      enum: PROJECT_VISIBILITIES,
      default: "private",
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "projects",
  },
);

// "My projects" list, newest activity first.
projectSchema.index({ ownerId: 1, updatedAt: -1 });
// Public project discovery and global icon search scope.
projectSchema.index({ visibility: 1, isArchived: 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;
export type ProjectModel = Model<ProjectDoc>;

const Project: ProjectModel =
  (mongoose.models.Project as ProjectModel | undefined) ??
  mongoose.model<ProjectDoc>("Project", projectSchema);

export default Project;
