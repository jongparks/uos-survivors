import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Client } from "@colyseus/sdk";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(webDirectory, "../../..");
const serverEntry = path.join(repositoryRoot, "apps/server/dist/index.js");
const endpoint = "http://127.0.0.1:2568";

const server = spawn(process.execPath, [serverEntry], {
  cwd: repositoryRoot,
  env: { ...process.env, PORT: "2568", NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${endpoint}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The process may still be starting.
    }
    await delay(100);
  }

  throw new Error(`Server did not become healthy.\n${serverOutput}`);
}

try {
  await waitForHealth();
  const client = new Client(endpoint);
  const room = await client.joinOrCreate("bootstrap");

  if (!room.sessionId || !room.roomId) {
    throw new Error("Colyseus connection did not provide room identifiers");
  }

  console.log(`Connection smoke test passed: room=${room.roomId}`);
  await room.leave();
} finally {
  server.kill();
}

