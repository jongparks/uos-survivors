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
    lastBasicAttackAt: t.float64().default(0),
    barrierCooldownEndsAt: t.float64().default(0),
    isDisguised: t.boolean().default(false),
    disguiseEndsAt: t.float64().default(0),
    disguiseCooldownEndsAt: t.float64().default(0),
    dashStartedAt: t.float64().default(0),
    dashEndsAt: t.float64().default(0),
    dashCooldownEndsAt: t.float64().default(0),
    dashStartX: t.float32().default(0),
    dashStartY: t.float32().default(0),
    dashDirectionX: t.float32().default(0),
    dashDirectionY: t.float32().default(0),
    attackLockedUntil: t.float64().default(0),
    stunnedUntil: t.float64().default(0),
    rootedUntil: t.float64().default(0),
    confusionEndsAt: t.float64().default(0),
    philosophyCooldownEndsAt: t.float64().default(0),
    assignmentLockEndsAt: t.float64().default(0),
    professorCooldownEndsAt: t.float64().default(0),
    trapCastEndsAt: t.float64().default(0),
    trapCooldownEndsAt: t.float64().default(0),
    rewindCooldownEndsAt: t.float64().default(0),
    lastRewindAt: t.float64().default(0),
    rewindFromX: t.float32().default(0),
    rewindFromY: t.float32().default(0),
    vomitCastEndsAt: t.float64().default(0),
    vomitCooldownEndsAt: t.float64().default(0),
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

export const VomitProjectileState = schema({
  ownerSessionId: t.string(), x: t.float32(), y: t.float32(),
  directionX: t.float32(), directionY: t.float32(), remainingRange: t.float32(),
}, "VomitProjectileState");
export const VomitPuddleState = schema({
  ownerSessionId: t.string(), x: t.float32(), y: t.float32(),
  radius: t.float32(), createdAt: t.float64(), expiresAt: t.float64(),
}, "VomitPuddleState");

export const BookBarrierState = schema({
  ownerSessionId: t.string(), x: t.float32(), y: t.float32(), width: t.float32(), height: t.float32(),
  createdAt: t.float64(), expiresAt: t.float64(),
}, "BookBarrierState");

export const EngineeringTrapState = schema({
  ownerSessionId: t.string(), x: t.float32(), y: t.float32(),
  createdAt: t.float64(), activatesAt: t.float64(), expiresAt: t.float64(),
}, "EngineeringTrapState");
export type EngineeringTrapState = SchemaType<typeof EngineeringTrapState>;

export const GameState = schema(
  {
    roomCode: t.string().default(""),
    hostSessionId: t.string().default(""),
    matchStartedAt: t.float64().default(0),
    matchParticipantCount: t.uint8().default(0),
    startError: t.string().default(""),
    isPrivate: t.boolean().default(false),
    phase: t.string().default(GAME_PHASE.waiting),
    winner: t.string().default(MATCH_WINNER.none),
    mapConfigError: t.string().default(""),
    initialZombieSessionId: t.string().default(""),
    players: t.map(PlayerState).view(),
    decoys: t.map(SculptureDecoyState),
    vomitProjectiles: t.map(VomitProjectileState),
    vomitPuddles: t.map(VomitPuddleState),
    bookBarriers: t.map(BookBarrierState),
    engineeringTraps: t.map(EngineeringTrapState).view(),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;

