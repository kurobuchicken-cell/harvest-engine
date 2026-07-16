import { createHash } from "node:crypto";

export function computeHash(normalized: string | Buffer): string {
  const buf = typeof normalized === "string" ? Buffer.from(normalized, "utf-8") : normalized;
  return createHash("sha256").update(buf).digest("hex");
}
