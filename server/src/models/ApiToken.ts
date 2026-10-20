// A personal API token for the command line and scripts. Only a SHA-256 hash of the token is stored, so a token can be shown once at creation and never again. Revoking sets `revokedAt`; a revoked token stops working immediately.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const apiTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // A label the user chose, e.g. "CI server".
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    // SHA-256 of the full token, hex. The token itself is never stored.
    tokenHash: { type: String, required: true, unique: true },
    // The first characters of the token, so the user can tell tokens apart in a list.
    prefix: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "api_tokens" },
);

export type ApiTokenDoc = InferSchemaType<typeof apiTokenSchema>;
export type ApiTokenModel = Model<ApiTokenDoc>;

const ApiToken: ApiTokenModel = (mongoose.models.ApiToken as ApiTokenModel | undefined) ?? mongoose.model<ApiTokenDoc>("ApiToken", apiTokenSchema);

export default ApiToken;
