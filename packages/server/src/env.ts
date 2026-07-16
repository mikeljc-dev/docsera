import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadEnv(): void {
  config({ path: resolve(REPO_ROOT, ".env") });
}
