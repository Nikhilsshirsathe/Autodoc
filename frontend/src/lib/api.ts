/**
 * Central API base URL.
 * Reads from NEXT_PUBLIC_API_URL at runtime.
 * Trailing slashes are stripped to prevent double-slash URLs.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
