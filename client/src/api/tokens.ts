// API tokens: list, create (the secret is returned once) and revoke. These need a signed-in browser session.
import { http } from "./http";
import type { ApiTokenItem, ApiTokenList, CreatedApiToken } from "./types";

export async function listTokens(): Promise<ApiTokenList> {
  const { data } = await http.get<ApiTokenList>("/api/tokens");
  return data;
}

export async function createToken(name: string): Promise<CreatedApiToken> {
  const { data } = await http.post<CreatedApiToken>("/api/tokens", { name });
  return data;
}

export async function revokeToken(tokenId: string): Promise<ApiTokenItem> {
  const { data } = await http.delete<ApiTokenItem>(`/api/tokens/${encodeURIComponent(tokenId)}`);
  return data;
}
