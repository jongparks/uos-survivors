import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Client } from "@colyseus/sdk";
import {
  CLIENT_MESSAGES,
  GAME_LIMITS,
  ROOM_NAMES,
} from "@uos-survivors/shared";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(webDirectory, "../../..");
const serverEntry = path.join(repositoryRoot, "apps/server/dist/index.js");
const endpoint = "http://localhost:2568";

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

async function waitUntil(predicate, message) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) {
      return;
    }
    await delay(50);
  }

  throw new Error(message);
}

const rooms = [];
try {
  await waitForHealth();
  const hostRoom = await new Client(endpoint).create(ROOM_NAMES.game, {
    nickname: "Host",
  });
  rooms.push(hostRoom);

  if (!hostRoom.sessionId || !hostRoom.roomId) {
    throw new Error("Colyseus connection did not provide room identifiers");
  }

  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(hostRoom.roomId)) {
    throw new Error(`Invalid invite code: ${hostRoom.roomId}`);
  }

  const guestRooms = await Promise.all(
    Array.from({ length: GAME_LIMITS.maxPlayersPerRoom - 1 }, (_, index) =>
      new Client(endpoint).joinById(hostRoom.roomId, {
        nickname: `Guest${index + 1}`,
      }),
    ),
  );
  rooms.push(...guestRooms);

  await waitUntil(
    () => hostRoom.state.players.size === GAME_LIMITS.maxPlayersPerRoom,
    "Eight connected players were not synchronized",
  );

  const hostPlayer = hostRoom.state.players.get(hostRoom.sessionId);
  if (!hostPlayer) {
    throw new Error("Host player was not present in synchronized state");
  }

  const initialX = hostPlayer.x;
  for (let tick = 0; tick < 10; tick += 1) {
    hostRoom.send(CLIENT_MESSAGES.movement, {
      up: false,
      down: false,
      left: false,
      right: true,
    });
    await delay(35);
  }
  hostRoom.send(CLIENT_MESSAGES.movement, {
    up: false,
    down: false,
    left: false,
    right: false,
  });

  await waitUntil(
    () => hostPlayer.x > initialX,
    "Server-authoritative movement was not synchronized",
  );

  console.log(
    `Multiplayer smoke test passed: room=${hostRoom.roomId}, players=${hostRoom.state.players.size}`,
  );
} finally {
  await Promise.allSettled(rooms.map((room) => room.leave()));
  server.kill();
}

