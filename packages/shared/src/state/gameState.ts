import { schema, t, type SchemaType } from "@colyseus/schema";

import { CHARACTER_IDS, PLAYER_ACTIVITY } from "../game/characters.js";
import { GAME_PHASE, MATCH_WINNER, PLAYER_ROLE } from "../game/rules.js";

export const PlayerState = schema(
  {
    nickname: t.string().default(""),
    connected: t.boolean().default(true),
    role: t.string().default(PLAYER_ROLE.human),
    characterId: t.string().default(CHARACTER_IDS.fossil),
    activity: t.string().default(PLAYER_ACTIVITY.normal),
    activeHideSpotId: t.string().default(""),
    hideStartedAt: t.float64().default(0),
    hideEndsAt: t.float64().default(0),
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
    mapConfigError: t.string().default(""),
    initialZombieSessionId: t.string().default(""),
    players: t.map(PlayerState).view(),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;

