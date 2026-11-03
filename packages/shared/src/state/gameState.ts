import { schema, t, type SchemaType } from "@colyseus/schema";

import {
  PLAYER_ACTIVITY,
  SPRINT_STATE,
  UNASSIGNED_CHARACTER_ID,
} from "../game/characters.js";
import { GAME_PHASE, MATCH_WINNER, PLAYER_ROLE } from "../game/rules.js";

export const PlayerState = schema(
  {
    nickname: t.string().default(""),
    connected: t.boolean().default(true),
    role: t.string().default(PLAYER_ROLE.human),
    characterId: t.string().default(UNASSIGNED_CHARACTER_ID),
    activity: t.string().default(PLAYER_ACTIVITY.normal),
    activeHideSpotId: t.string().default(""),
    hideStartedAt: t.float64().default(0),
    hideEndsAt: t.float64().default(0),
    sprintState: t.string().default(SPRINT_STATE.ready),
    skillStartedAt: t.float64().default(0),
    sprintEndsAt: t.float64().default(0),
    exhaustionEndsAt: t.float64().default(0),
    cooldownEndsAt: t.float64().default(0),
    activeDecoyId: t.string().default(""),
    decoyCooldownEndsAt: t.float64().default(0),
    x: t.float32().default(0),
    y: t.float32().default(0),
    facingX: t.float32().default(1),
    facingY: t.float32().default(0),
    nextAttackAt: t.float64().default(0),
    attackLockedUntil: t.float64().default(0),
    stunnedUntil: t.float64().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const SculptureDecoyState = schema(
  {
    ownerSessionId: t.string().default(""),
    nickname: t.string().default(""),
    x: t.float32().default(0),
    y: t.float32().default(0),
    createdAt: t.float64().default(0),
    expiresAt: t.float64().default(0),
    currentReplayTimeMs: t.float32().default(0),
  },
  "SculptureDecoyState",
);
export type SculptureDecoyState = SchemaType<typeof SculptureDecoyState>;

export const GameState = schema(
  {
    roomCode: t.string().default(""),
    isPrivate: t.boolean().default(false),
    phase: t.string().default(GAME_PHASE.waiting),
    winner: t.string().default(MATCH_WINNER.none),
    mapConfigError: t.string().default(""),
    initialZombieSessionId: t.string().default(""),
    players: t.map(PlayerState).view(),
    decoys: t.map(SculptureDecoyState),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;

