import { spawn } from "node:child_process";
import { createServer } from "node:net";

function run(args: string[], cwd: string, quiet = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { cwd, stdio: quiet ? "ignore" : "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`\`docker ${args.join(" ")}\` exited with code ${code}`));
    });
  });
}

export async function dockerComposeAvailable(): Promise<boolean> {
  try {
    await run(["compose", "version"], process.cwd(), true);
    return true;
  } catch {
    return false;
  }
}

export function composeUp(dir: string): Promise<void> {
  return run(["compose", "up", "-d"], dir);
}

export function composeDown(dir: string): Promise<void> {
  return run(["compose", "down"], dir);
}

export async function waitForHealth(url: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const body = (await res.json()) as { status?: string; version?: string };
        if (body.status === "ok") return body.version ?? "unknown";
      }
    } catch {
      // aún arrancando (migraciones, pull de la imagen…): seguir esperando
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `The server did not answer at ${url} within ${Math.round(timeoutMs / 1000)}s. ` +
      "Check the logs with `docker compose logs server`.",
  );
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    // Sin host: escucha en el wildcard (v4+v6), que es donde publicará Docker.
    // Probar solo 127.0.0.1 daba por libre un puerto ya ocupado por otro
    // contenedor.
    srv.listen(port, () => srv.close(() => resolve(true)));
  });
}

// Si el puerto preferido está ocupado (p.ej. otro server en 3000), busca el
// siguiente libre en vez de fallar: una pregunta menos en el wizard.
export async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await portFree(port)) return port;
  }
  throw new Error(`No free port found between ${preferred} and ${preferred + 19}.`);
}
