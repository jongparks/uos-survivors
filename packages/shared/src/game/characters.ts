import { CONTROL_BINDINGS } from "./controls.js";

export const CHARACTER_IDS = {
  fossil: "HUMAN_001",
  sportsStudent: "HUMAN_002",
} as const;
export type CharacterId = (typeof CHARACTER_IDS)[keyof typeof CHARACTER_IDS];
export const UNASSIGNED_CHARACTER_ID = "";

export const HUMAN_CHARACTER_IDS = [
  CHARACTER_IDS.fossil,
  CHARACTER_IDS.sportsStudent,
] as const satisfies readonly CharacterId[];

export function isCharacterId(value: unknown): value is CharacterId {
  return Object.values(CHARACTER_IDS).includes(value as CharacterId);
}

export function pickRandomHumanCharacter(randomValue: number): CharacterId {
  const normalized = Math.min(0.999_999, Math.max(0, randomValue));
  const index = Math.floor(normalized * HUMAN_CHARACTER_IDS.length);
  return HUMAN_CHARACTER_IDS[index] ?? CHARACTER_IDS.fossil;
}

export const PLAYER_ACTIVITY = {
  normal: "normal",
  hidden: "hidden",
} as const;
export type PlayerActivity = (typeof PLAYER_ACTIVITY)[keyof typeof PLAYER_ACTIVITY];

export const FOSSIL_CONFIG = {
  characterId: CHARACTER_IDS.fossil,
  characterName: "화석",
  characterNameEn: "Fossil",
  skillId: "FOSSIL_HIDE",
  skillName: "비밀 은신처",
  hideDurationMs: 20_000,
  hideSpotCount: 5,
  hideSpotMaxUses: 1,
  interactionKey: CONTROL_BINDINGS.interaction,
  allowEarlyExit: true,
  consumeSpotOnEnter: true,
} as const;

export const FOSSIL_MESSAGES = {
  requestHideSpots: "fossil:request-hide-spots",
  hideSpots: "fossil:hide-spots",
} as const;

export const SPRINT_STATE = {
  ready: "ready",
  sprinting: "sprinting",
  exhausted: "exhausted",
  cooldown: "cooldown",
} as const;
export type SprintState = (typeof SPRINT_STATE)[keyof typeof SPRINT_STATE];

export const SPORTS_STUDENT_CONFIG = {
  characterId: CHARACTER_IDS.sportsStudent,
  characterName: "스과생",
  characterNameEn: "Sports Science Student",
  skillId: "SPORTS_SPRINT",
  skillName: "전력 질주",
  sprintDurationMs: 6_000,
  sprintSpeedMultiplier: 1.4,
  exhaustionDurationMs: 2_000,
  exhaustionSpeedMultiplier: 0.65,
  cooldownMs: 25_000,
  activationKey: CONTROL_BINDINGS.ability,
  allowCancel: false,
} as const;

export function getSportsSpeedMultiplier(sprintState: string): number {
  if (sprintState === SPRINT_STATE.sprinting) {
    return SPORTS_STUDENT_CONFIG.sprintSpeedMultiplier;
  }
  if (sprintState === SPRINT_STATE.exhausted) {
    return SPORTS_STUDENT_CONFIG.exhaustionSpeedMultiplier;
  }
  return 1;
}

export interface FossilHideSpotView {
  id: string;
  x: number;
  y: number;
  interactionRadius: number;
}
