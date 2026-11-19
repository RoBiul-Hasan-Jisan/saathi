import { randomBytes, randomUUID } from "node:crypto";

export const newId = () => randomUUID();
// 9 random bytes = 12 URL-safe characters. This is the secret inside the QR code.
export const newToken = () => randomBytes(9).toString("base64url");
export const TOKEN_RE = /^[A-Za-z0-9_-]{12}$/;
