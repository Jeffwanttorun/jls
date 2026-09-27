import { existsSync, readdirSync } from "node:fs";

export function hasMarkdownFiles(base: string) {
  return existsSync(base) && readdirSync(base, { recursive: true }).some((file) => String(file).endsWith(".md"));
}
