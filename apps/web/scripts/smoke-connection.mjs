import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "@colyseus/sdk";
import {
  CHARACTER_IDS, DANGER_MESSAGES, GAME_PHASE, GRADUATE_TRACKING_MESSAGE,
  LIBRARY_PLACEMENT_FAILED_MESSAGE, MATCH_MESSAGES, MovementInput, NETWORK_RATE,
  PLAYER_SPEED, PLAYER_ROLE, ROOM_NAMES, ROOM_VISIBILITY, validateAssignments,
  ASSIGNMENT_MESSAGES,
  DEFAULT_MAP_ID, getGameMap,
  TEST_MAP_WIDTH, TEST_MAP_HEIGHT, TILE_INDEX, TILE_SIZE, getTestMapTile, tileToWorld,
} from "@uos-survivors/shared";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const endpoint = "http://localhost:2568";
const server = spawn(process.execPath, [path.join(repositoryRoot, "apps/server/dist/index.js")], {
  cwd: repositoryRoot, env: { ...process.env, PORT: "2568", NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });
async function waitUntil(predicate, message, attempts = 100) {
  for (let i = 0; i < attempts; i++) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error(message + "\n" + serverOutput.slice(-1200));
}
const rooms = [];
function track(room) {
  rooms.push(room);
  room.onMessage(GRADUATE_TRACKING_MESSAGE, () => {});
  room.onMessage(LIBRARY_PLACEMENT_FAILED_MESSAGE, () => {});
  room.onMessage(DANGER_MESSAGES.update, () => {});
  return room;
}
function verify(room, count) {
  const players = [...room.state.players.entries()];
  const assignments = new Map(players.map(([id, p]) => [id, p.characterId]));
  if (!validateAssignments(players.map(([id]) => id), assignments) ||
      room.state.matchParticipantCount !== count ||
      players.filter(([, p]) => p.role === PLAYER_ROLE.zombie).length !== 1 ||
      room.state.players.get(room.state.initialZombieSessionId)?.role !== PLAYER_ROLE.zombie) {
    throw new Error("Invalid randomized match distribution at " + count + " participants");
  }
}
try {
  await waitUntil(async () => {
    try { return (await fetch(endpoint + "/health")).ok; } catch { return false; }
  }, "Server failed to start", 240);
  const privateHost = track(await new Client(endpoint).create(ROOM_NAMES.game, {
    nickname: "PrivateHost", visibility: ROOM_VISIBILITY.private, mapId: "MAP_TEST",
  }));
  const campusHost = track(await new Client(endpoint).joinOrCreate(ROOM_NAMES.game, {
    nickname: "CampusHost", visibility: ROOM_VISIBILITY.public, mapId: DEFAULT_MAP_ID,
  }));
  const campusGuest = track(await new Client(endpoint).joinOrCreate(ROOM_NAMES.game, {
    nickname: "CampusGuest", visibility: ROOM_VISIBILITY.public, mapId: DEFAULT_MAP_ID,
  }));
  if (campusGuest.roomId !== campusHost.roomId) throw new Error("Campus quick join did not match the selected map");
  for (let i = 0; i < 2; i++) track(await new Client(endpoint).joinById(campusHost.roomId, { nickname: "Campus" + i }));
  campusHost.send(MATCH_MESSAGES.start);
  await waitUntil(() => campusHost.state.phase === GAME_PHASE.playing, "Campus match did not start");
  verify(campusHost, 4);
  if (campusHost.state.mapId !== DEFAULT_MAP_ID || getGameMap(campusHost.state.mapId).tileSize !== 32 ||
    campusHost.state.matchEndsAt - campusHost.state.matchStartedAt !== 420000 ||
    [...campusHost.state.gates.values()].some(g => g.status !== "LOCKED")) throw new Error("Campus map/timer/secret gate state mismatch");
  const publicHost = track(await new Client(endpoint).joinOrCreate(ROOM_NAMES.game, {
    nickname: "PublicHost", visibility: ROOM_VISIBILITY.public, mapId: "MAP_TEST",
  }));
  if (publicHost.roomId === campusHost.roomId) throw new Error("Quick join mixed different maps");
  if (privateHost.roomId === publicHost.roomId) throw new Error("Quick join entered a private room");
  const publicGuest = track(await new Client(endpoint).joinOrCreate(ROOM_NAMES.game, {
    nickname: "PublicGuest", visibility: ROOM_VISIBILITY.public, mapId: "MAP_TEST",
  }));
  if (publicGuest.roomId !== publicHost.roomId) throw new Error("Quick join did not reuse waiting public room");
  for (let i = 0; i < 6; i++) {
    track(await new Client(endpoint).joinById(publicHost.roomId, { nickname: "Public" + i }));
  }
  await waitUntil(() => publicHost.state.players.size === 8, "Public room did not synchronize eight players");
  if (publicHost.state.phase !== GAME_PHASE.waiting) throw new Error("Room started before host confirmation");
  publicGuest.send(MATCH_MESSAGES.start);
  await delay(100);
  if (publicHost.state.phase !== GAME_PHASE.waiting) throw new Error("Non-host started the match");
  publicHost.send(MATCH_MESSAGES.start);
  await waitUntil(() => publicHost.state.phase === GAME_PHASE.playing, "Host could not start an eight-player match");
  verify(publicHost, 8);
  const originalPublic = new Map([...publicHost.state.players].map(([id, p]) => [id, p.characterId]));
  publicHost.send(MATCH_MESSAGES.start);
  await delay(100);
  if ([...originalPublic].some(([id, c]) => publicHost.state.players.get(id)?.characterId !== c)) {
    throw new Error("Repeated start rerolled assignments");
  }
  let rejectedFull = false;
  try { track(await new Client(endpoint).joinById(publicHost.roomId, { nickname: "Overflow" })); }
  catch { rejectedFull = true; }
  if (!rejectedFull) throw new Error("Room accepted a ninth player");

  for (let i = 0; i < 2; i++) track(await new Client(endpoint).joinById(privateHost.roomId, { nickname: "Private" + i }));
  privateHost.send(MATCH_MESSAGES.start);
  await delay(100);
  if (privateHost.state.phase !== GAME_PHASE.waiting) throw new Error("Match started with fewer than four participants");
  track(await new Client(endpoint).joinById(privateHost.roomId, { nickname: "PrivateFourth" }));
  privateHost.send(MATCH_MESSAGES.start);
  await waitUntil(() => privateHost.state.phase === GAME_PHASE.playing, "Private four-player match failed to start");
  verify(privateHost, 4);
  const originalPrivate = new Map([...privateHost.state.players].map(([id, p]) => [id, p.characterId]));
  const lateJoin = track(await new Client(endpoint).joinById(privateHost.roomId, { nickname: "LateJoin", characterId: CHARACTER_IDS.xmanZombie, role: PLAYER_ROLE.zombie }));
  await waitUntil(() => privateHost.state.players.size === 5, "Mid-match join did not synchronize");
  if (privateHost.state.players.get(lateJoin.sessionId)?.characterId !== CHARACTER_IDS.normalHuman ||
      privateHost.state.matchParticipantCount !== 4 ||
      [...originalPrivate].some(([id, c]) => privateHost.state.players.get(id)?.characterId !== c)) {
    throw new Error("Mid-match join changed initial assignments");
  }
  await waitUntil(() => lateJoin.state.players.has(lateJoin.sessionId), "Late join player missing");
  const own = lateJoin.state.players.get(lateJoin.sessionId);
  const input = lateJoin.input({ type: MovementInput, mode: "reliable" });
  const x = own.x, y = own.y;
  input.data.moveX = 127; input.data.moveY = 1; input.send();
  await waitUntil(() => own.x > x && own.y > y, "Movement was not processed");
  if (Math.hypot(own.x - x, own.y - y) > PLAYER_SPEED / NETWORK_RATE.simulationHz + 0.5 ||
      Math.abs((own.x - x) - (own.y - y)) > 0.5) throw new Error("Input sanitization or diagonal normalization failed");
  input.data.moveX = 0; input.data.moveY = 0; input.data.useSkill = true; input.send();
  await delay(100);
  if (own.characterId !== CHARACTER_IDS.normalHuman || own.rewindCooldownEndsAt || own.trapCooldownEndsAt ||
      own.philosophyCooldownEndsAt || own.cooldownEndsAt || own.activeDecoyId) throw new Error("Normal human activated a special ability");

  let lastDanger;
  lateJoin.onMessage(DANGER_MESSAGES.update, update => { lastDanger = update; });
  lateJoin.send(DANGER_MESSAGES.subscribe);
  await waitUntil(() => lastDanger, "Human danger state did not synchronize");
  if (Object.keys(lastDanger).join(",") !== "level") throw new Error("Danger message exposed identifying information");

  let dropped = false, resumed = false;
  lateJoin.reconnection.minUptime = 0;
  lateJoin.onDrop(() => { dropped = true; });
  lateJoin.onReconnect(() => { resumed = true; });
  const session = lateJoin.sessionId;
  void lateJoin.leave(false);
  await waitUntil(() => dropped && resumed, "Automatic reconnect failed");
  if (lateJoin.sessionId !== session || lateJoin.state.players.get(session)?.characterId !== CHARACTER_IDS.normalHuman) {
    throw new Error("Reconnect changed session or character");
  }
  lateJoin.reconnection.enabled = false;
  const token = lateJoin.reconnectionToken;
  await lateJoin.leave(false);
  const restored = track(await new Client(endpoint).reconnect(token));
  await waitUntil(() => restored.state.players?.has(session), "Manual reconnect state missing");
  if (restored.sessionId !== session || restored.state.players.size !== 5) throw new Error("Manual reconnect duplicated players");
  // Keep an end-to-end basic infection check even though the initial zombie is random.
  const zombieId = privateHost.state.initialZombieSessionId;
  const zombieRoom = rooms.find(room => room.roomId === privateHost.roomId && room.sessionId === zombieId);
  const attacker = privateHost.state.players.get(zombieId);
  const victim = privateHost.state.players.get(session);
  const start = { x: Math.floor(attacker.x / TILE_SIZE), y: Math.floor(attacker.y / TILE_SIZE) };
  const goal = { x: Math.floor(victim.x / TILE_SIZE), y: Math.floor(victim.y / TILE_SIZE) };
  const key = p => p.y * TEST_MAP_WIDTH + p.x;
  const queue = [start], parents = new Map([[key(start), null]]);
  for (let index = 0; index < queue.length && !parents.has(key(goal)); index++) {
    const p = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: p.x + dx, y: p.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= TEST_MAP_WIDTH || next.y >= TEST_MAP_HEIGHT ||
          getTestMapTile(next.x, next.y) !== TILE_INDEX.floor || parents.has(key(next))) continue;
      parents.set(key(next), p); queue.push(next);
    }
  }
  if (!parents.has(key(goal))) throw new Error("Infection test could not find a map route");
  const route = [];
  for (let point = goal; point; point = parents.get(key(point))) route.unshift(point);
  const attackInput = zombieRoom.input({ type: MovementInput, mode: "reliable" });
  let nearVictim = false;
  for (const point of route) {
    for (let step = 0; step < 80; step++) {
      if (Math.hypot(attacker.x - victim.x, attacker.y - victim.y) <= 50) { nearVictim = true; break; }
      const dx = tileToWorld(point.x) - attacker.x, dy = tileToWorld(point.y) - attacker.y;
      if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) break;
      attackInput.data.moveX = Math.abs(dx) > 4 ? Math.sign(dx) : 0;
      attackInput.data.moveY = Math.abs(dy) > 4 ? Math.sign(dy) : 0;
      attackInput.send();
      await waitUntil(() => attackInput.lastProcessed >= attackInput.sentCount, "Movement route input was not acknowledged");
    }
    if (nearVictim) break;
  }
  if (!nearVictim) throw new Error("Zombie did not reach the infection test target");
  if (attacker.characterId === CHARACTER_IDS.professor) {
    const missionUpdates = [];
    let leakedAnswers = 0;
    restored.onMessage(ASSIGNMENT_MESSAGES.state, view => { missionUpdates.push(view); });
    for (const observer of rooms.filter(room => room.roomId === privateHost.roomId && room.sessionId !== session)) {
      observer.onMessage(ASSIGNMENT_MESSAGES.state, view => { if (view.sequence.length) leakedAnswers++; });
    }
    restored.send(ASSIGNMENT_MESSAGES.subscribe);
    attackInput.data.moveX = 0; attackInput.data.moveY = 0;
    attackInput.data.useSkill = true; attackInput.send();
    await waitUntil(() => missionUpdates.some(view => view.event === "started"), "Professor mission did not reach its target");
    const challenge = missionUpdates.find(view => view.event === "started");
    const before = { x: victim.x, y: victim.y };
    const lockedInput = restored.input({ type: MovementInput, mode: "reliable" });
    lockedInput.data.moveX = 1; lockedInput.data.useSkill = true; lockedInput.data.interact = true; lockedInput.send();
    await delay(100);
    if (victim.x !== before.x || victim.y !== before.y) throw new Error("Mission lock allowed ordinary movement");
    for (const direction of challenge.sequence) restored.send(ASSIGNMENT_MESSAGES.input, { id: challenge.id, direction });
    await waitUntil(() => missionUpdates.some(view => view.event === "completed"), "Server did not validate mission completion");
    if (leakedAnswers || attacker.attackLockedUntil <= Date.now()) throw new Error("Mission privacy or professor attack penalty failed");
    lockedInput.data.moveX = 0; lockedInput.data.useSkill = false; lockedInput.data.interact = false; lockedInput.send();
    await waitUntil(() => Date.now() >= attacker.attackLockedUntil, "Professor attack lock never expired");
    attackInput.data.useSkill = false;
  }
  attackInput.data.moveX = Math.sign(victim.x - attacker.x);
  attackInput.data.moveY = Math.sign(victim.y - attacker.y);
  attackInput.data.interact = true; attackInput.send();
  await waitUntil(() => victim.characterId === CHARACTER_IDS.normalZombie, "Space attack failed to infect normal human");
  if (restored.sessionId !== session || privateHost.state.matchParticipantCount !== 4 ||
      [...originalPrivate].some(([id, c]) => privateHost.state.players.get(id)?.characterId !== c)) {
    throw new Error("Infection changed membership or rerolled initial assignments");
  }
  console.log("Assignment/network smoke passed: public=8, private=4, lateJoin=HUMAN_000, host-only start, unique specials, unchanged assignments, movement and reconnect");
} finally {
  await Promise.allSettled(rooms.map(room => room.leave()));
  server.kill();
}

