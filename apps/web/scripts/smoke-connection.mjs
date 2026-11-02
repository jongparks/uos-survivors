import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Client } from "@colyseus/sdk";
import {
  CLIENT_MESSAGES,
  GAME_LIMITS,
  ROOM_NAMES,
  ROOM_VISIBILITY,
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
  const privateHostRoom = await new Client(endpoint).create(ROOM_NAMES.game, {
    nickname: "PrivateHost",
    visibility: ROOM_VISIBILITY.private,
  });
  rooms.push(privateHostRoom);

  if (!privateHostRoom.sessionId || !privateHostRoom.roomId) {
    throw new Error("Colyseus connection did not provide room identifiers");
  }

  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(privateHostRoom.roomId)) {
    throw new Error(`Invalid invite code: ${privateHostRoom.roomId}`);
  }

  await waitUntil(
    () => privateHostRoom.state.isPrivate,
    "Private room state was not synchronized",
  );

  const publicHostRoom = await new Client(endpoint).joinOrCreate(ROOM_NAMES.game, {
    nickname: "QuickHost",
    visibility: ROOM_VISIBILITY.public,
  });
  rooms.push(publicHostRoom);

  if (publicHostRoom.roomId === privateHostRoom.roomId || publicHostRoom.state.isPrivate) {
    throw new Error("Quick join matched an invite-only room");
  }

  const quickGuestRoom = await new Client(endpoint).joinOrCreate(ROOM_NAMES.game, {
    nickname: "QuickGuest",
    visibility: ROOM_VISIBILITY.public,
  });
  rooms.push(quickGuestRoom);

  if (quickGuestRoom.roomId !== publicHostRoom.roomId) {
    throw new Error("Quick join did not reuse the available public room");
  }

  const invitedPrivateGuest = await new Client(endpoint).joinById(privateHostRoom.roomId, {
    nickname: "InvitedGuest",
  });
  rooms.push(invitedPrivateGuest);

  if (invitedPrivateGuest.roomId !== privateHostRoom.roomId) {
    throw new Error("Invite code did not join the private room");
  }

  const guestRooms = await Promise.all(
    Array.from({ length: GAME_LIMITS.maxPlayersPerRoom - 2 }, (_, index) =>
      new Client(endpoint).joinById(publicHostRoom.roomId, {
        nickname: `Guest${index + 1}`,
      }),
    ),
  );
  rooms.push(...guestRooms);

  await waitUntil(
    () => publicHostRoom.state.players.size === GAME_LIMITS.maxPlayersPerRoom,
    "Eight connected players were not synchronized",
  );
  await waitUntil(
    () => privateHostRoom.state.players.size === 2,
    "Private invite-code players were not synchronized",
  );

  const hostPlayer = publicHostRoom.state.players.get(publicHostRoom.sessionId);
  if (!hostPlayer) {
    throw new Error("Host player was not present in synchronized state");
  }

  const initialX = hostPlayer.x;
  for (let tick = 0; tick < 10; tick += 1) {
    publicHostRoom.send(CLIENT_MESSAGES.movement, {
      up: false,
      down: false,
      left: false,
      right: true,
    });
    await delay(35);
  }
  publicHostRoom.send(CLIENT_MESSAGES.movement, {
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
    `Matchmaking smoke test passed: public=${publicHostRoom.roomId} (${publicHostRoom.state.players.size}), private=${privateHostRoom.roomId} (${privateHostRoom.state.players.size})`,
  );
} finally {
  await Promise.allSettled(rooms.map((room) => room.leave()));
  server.kill();
}

