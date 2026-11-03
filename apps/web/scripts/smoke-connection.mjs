import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Client } from "@colyseus/sdk";
import {
  COMBAT_RULES,
  GAME_PHASE,
  GAME_LIMITS,
  HUMAN_CHARACTER_IDS,
  MATCH_WINNER,
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_ROLE,
  ROOM_NAMES,
  ROOM_VISIBILITY,
  CHARACTER_IDS,
  SPECIAL_ZOMBIE_CHARACTER_IDS,
  GRADUATE_TRACKING_MESSAGE,
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
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

  if (
    publicHostRoom.state.players.get(publicHostRoom.sessionId)?.role !== PLAYER_ROLE.zombie ||
    publicHostRoom.state.players.get(quickGuestRoom.sessionId)?.role !== PLAYER_ROLE.human
  ) {
    throw new Error("Initial zombie and human roles were not assigned");
  }

  if (
    !SPECIAL_ZOMBIE_CHARACTER_IDS.includes(publicHostRoom.state.players.get(publicHostRoom.sessionId)?.characterId) ||
    Array.from(publicHostRoom.state.players.values()).some(
      (player) =>
        player.role === PLAYER_ROLE.human &&
        !HUMAN_CHARACTER_IDS.includes(player.characterId),
    )
  ) {
    throw new Error("Human characters were not assigned from the server random pool");
  }

  const hostPlayer = publicHostRoom.state.players.get(publicHostRoom.sessionId);
  if (!hostPlayer) {
    throw new Error("Host player was not present in synchronized state");
  }

  const hostInput = publicHostRoom.input({ type: MovementInput, mode: "reliable" });
  if (hostInput.tickRate !== NETWORK_RATE.simulationHz) {
    throw new Error(`Unexpected advertised input rate: ${hostInput.tickRate}`);
  }

  const beforeSanitizedInput = hostPlayer.x;
  const beforeSanitizedInputY = hostPlayer.y;
  hostInput.data.moveX = 127;
  hostInput.data.moveY = 1;
  hostInput.send();

  await waitUntil(
    () => hostPlayer.x > beforeSanitizedInput && hostPlayer.y > beforeSanitizedInputY,
    "Sanitized movement input was not processed",
  );

  const maxSingleStepDistance = PLAYER_SPEED / NETWORK_RATE.simulationHz + 0.5;
  const sanitizedDeltaX = hostPlayer.x - beforeSanitizedInput;
  const sanitizedDeltaY = hostPlayer.y - beforeSanitizedInputY;
  if (
    Math.hypot(sanitizedDeltaX, sanitizedDeltaY) > maxSingleStepDistance ||
    Math.abs(sanitizedDeltaX - sanitizedDeltaY) > 0.5
  ) {
    throw new Error("Out-of-range movement input bypassed server sanitization");
  }

  const inputSequences = [];
  const initialX = hostPlayer.x;
  for (let tick = 0; tick < 10; tick += 1) {
    hostInput.data.moveX = 1;
    hostInput.data.moveY = 0;
    inputSequences.push(hostInput.send());
    await delay(35);
  }
  hostInput.data.moveX = 0;
  hostInput.data.moveY = 0;
  inputSequences.push(hostInput.send());

  await waitUntil(
    () => hostPlayer.x > initialX,
    "Server-authoritative movement was not synchronized",
  );

  if (inputSequences.some((sequence, index) => sequence <= (inputSequences[index - 1] ?? 0))) {
    throw new Error("Input sequences were not strictly increasing");
  }

  await waitUntil(
    () => hostInput.lastProcessed >= hostInput.sentCount,
    "Server did not acknowledge all sequenced inputs",
  );
  const acknowledgedInputs = hostInput.lastProcessed;

  const privateInput = privateHostRoom.input({ type: MovementInput, mode: "reliable" });
  for (let tick = 0; tick < 5; tick += 1) {
    privateInput.data.moveX = 1;
    privateInput.data.moveY = 0;
    privateInput.data.useSkill = false;
    privateInput.send();
    await delay(35);
  }

  const infectionStartedAt = Date.now();
  let tracking;
  let guestTrackingPackets = 0;
  privateHostRoom.onMessage(GRADUATE_TRACKING_MESSAGE, view => { tracking = view; });
  invitedPrivateGuest.onMessage(GRADUATE_TRACKING_MESSAGE, () => { guestTrackingPackets++; });
  privateInput.data.moveX = 0;
  privateInput.data.useSkill = true;
  privateInput.send();
  await delay(35);
  privateInput.data.useSkill = false;
  privateInput.send();

  if (privateHostRoom.state.players.get(privateHostRoom.sessionId)?.characterId === CHARACTER_IDS.graduateZombie) {
    await waitUntil(() => tracking?.target?.id === invitedPrivateGuest.sessionId, "Graduate did not privately track the nearest human");
    if (guestTrackingPackets !== 0) throw new Error("Tracking leaked to another client");
    privateInput.data.interact = true; privateInput.send();
  }

  const infectedPrivateGuest = privateHostRoom.state.players.get(invitedPrivateGuest.sessionId);
  await waitUntil(
    () => infectedPrivateGuest?.role === PLAYER_ROLE.zombie,
    "Vomit projectile did not infect the human after its cast",
  );

  if (
    !infectedPrivateGuest ||
    infectedPrivateGuest.characterId !== CHARACTER_IDS.normalZombie ||
    infectedPrivateGuest.attackLockedUntil <
      infectionStartedAt + COMBAT_RULES.infectionAttackLockMs - 250 ||
    privateHostRoom.state.phase !== GAME_PHASE.finished ||
    privateHostRoom.state.winner !== MATCH_WINNER.zombie
  ) {
    throw new Error("Infection lock or all-infected victory state was invalid");
  }

  // Verify Space is basic attack even for a special zombie, independent of Shift.
  const attackHost = await new Client(endpoint).create(ROOM_NAMES.game, { nickname: "AttackHost", visibility: ROOM_VISIBILITY.private });
  rooms.push(attackHost);
  const attackGuest = await new Client(endpoint).joinById(attackHost.roomId, { nickname: "AttackGuest" });
  rooms.push(attackGuest);
  await waitUntil(() => attackHost.state.phase === GAME_PHASE.playing, "Attack test room did not start");
  const attackInput = attackHost.input({ type: MovementInput, mode: "reliable" });
  for (let tick = 0; tick < 5; tick++) {
    attackInput.data.moveX = 1; attackInput.send(); await delay(35);
  }
  attackInput.data.moveX = 0; attackInput.data.interact = true; attackInput.send();
  await waitUntil(() => attackHost.state.players.get(attackGuest.sessionId)?.characterId === CHARACTER_IDS.normalZombie, "Space basic attack did not convert the human into a normal zombie");
  if (attackHost.state.players.get(attackHost.sessionId)?.vomitCooldownEndsAt !== 0) throw new Error("Space triggered the special skill");

  const publicSessionId = publicHostRoom.sessionId;
  let dropped = false;
  let reconnected = false;
  publicHostRoom.reconnection.minUptime = 0;
  publicHostRoom.onDrop(() => {
    dropped = true;
  });
  publicHostRoom.onReconnect(() => {
    reconnected = true;
  });
  void publicHostRoom.leave(false);

  await waitUntil(() => dropped, "Automatic reconnection did not detect the drop");
  await waitUntil(() => reconnected, "Automatic reconnection did not restore the room");

  if (
    publicHostRoom.sessionId !== publicSessionId ||
    publicHostRoom.state.players.size !== GAME_LIMITS.maxPlayersPerRoom
  ) {
    throw new Error("Automatic reconnection duplicated or removed a player");
  }

  const privateSessionId = privateHostRoom.sessionId;
  const privateReconnectionToken = privateHostRoom.reconnectionToken;
  privateHostRoom.reconnection.enabled = false;
  await privateHostRoom.leave(false);

  await waitUntil(
    () => invitedPrivateGuest.state.players.get(privateSessionId)?.connected === false,
    "Dropped private player was not marked disconnected",
  );

  const resumedPrivateRoom = await new Client(endpoint).reconnect(privateReconnectionToken);
  rooms.push(resumedPrivateRoom);
  await waitUntil(
    () => invitedPrivateGuest.state.players.get(privateSessionId)?.connected === true,
    "Manually reconnected private player was not restored",
  );

  if (
    resumedPrivateRoom.sessionId !== privateSessionId ||
    resumedPrivateRoom.state.players.size !== 2
  ) {
    throw new Error("Manual reconnection duplicated or removed a player");
  }

  console.log(
    `Phase 5 foundation smoke test passed: public=${publicHostRoom.roomId} (${publicHostRoom.state.players.size}), private=${resumedPrivateRoom.roomId} (${resumedPrivateRoom.state.players.size}), ack=${acknowledgedInputs}, infectionLock=${COMBAT_RULES.infectionAttackLockMs}ms`,
  );
} finally {
  await Promise.allSettled(rooms.map((room) => room.leave()));
  server.kill();
}

