// Create, list and revoke a user's API tokens. The token itself is returned once, at creation, and cannot be shown again.
import { Types } from "mongoose";
import { MAX_ACTIVE_TOKENS_PER_USER, TOKEN_DISPLAY_LENGTH, generateToken, hashToken } from "../lib/apiToken.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import ApiToken, { type ApiTokenDoc } from "../models/ApiToken.js";

type Row = Pick<ApiTokenDoc, "name" | "prefix" | "lastUsedAt" | "revokedAt"> & { _id: Types.ObjectId; createdAt: Date };

export function serializeToken(token: Row) {
  return {
    id: String(token._id),
    name: token.name,
    prefix: token.prefix,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt ?? null,
    revokedAt: token.revokedAt ?? null,
  };
}

export async function listTokens(userId: Types.ObjectId) {
  const rows = await ApiToken.find({ userId }).sort({ createdAt: -1 }).lean();
  return { tokens: rows.map((row) => serializeToken(row as Row)), maxActive: MAX_ACTIVE_TOKENS_PER_USER };
}

export async function createToken(userId: Types.ObjectId, name: string) {
  const active = await ApiToken.countDocuments({ userId, revokedAt: null });
  if (active >= MAX_ACTIVE_TOKENS_PER_USER) throw new ConflictError(`You can have ${MAX_ACTIVE_TOKENS_PER_USER} active tokens at most. Revoke one first.`);
  const token = generateToken();
  const row = await ApiToken.create({ userId, name, tokenHash: hashToken(token), prefix: token.slice(0, TOKEN_DISPLAY_LENGTH) });
  return { ...serializeToken(row as unknown as Row), token };
}

// Revoking is permanent and immediate. Revoking a token that is already revoked is not an error.
export async function revokeToken(userId: Types.ObjectId, tokenId: Types.ObjectId) {
  const row = await ApiToken.findOne({ _id: tokenId, userId });
  if (!row) throw new NotFoundError("Token not found.");
  if (!row.revokedAt) {
    row.revokedAt = new Date();
    await row.save();
  }
  return serializeToken(row as unknown as Row);
}
