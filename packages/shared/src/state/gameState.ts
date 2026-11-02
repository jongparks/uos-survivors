import { schema, t, type SchemaType } from "@colyseus/schema";

import { GAME_PHASE, MATCH_WINNER, PLAYER_ROLE } from "../game/rules.js";

export const PlayerState = schema(
  {
    nickname: t.string().default(""),
    connected: t.boolean().default(true),
    role: t.string().default(PLAYER_ROLE.human),
    x: t.float32().default(0),
    y: t.float32().default(0),
    facingX: t.float32().default(1),
    facingY: t.float32().default(0),
    nextAttackAt: t.float64().default(0),
    attackLockedUntil: t.float64().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const GameState = schema(
  {
    roomCode: t.string().default(""),
    isPrivate: t.boolean().default(false),
    phase: t.string().default(GAME_PHASE.waiting),
    winner: t.string().default(MATCH_WINNER.none),
    initialZombieSessionId: t.string().default(""),
    players: t.map(PlayerState),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;

