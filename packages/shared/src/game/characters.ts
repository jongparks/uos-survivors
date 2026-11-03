import { CONTROL_BINDINGS } from "./controls.js";

export const CHARACTER_IDS = {
  fossil: "HUMAN_001",
  sportsStudent: "HUMAN_002",
  sculptureStudent: "HUMAN_003",
  drunkenZombie: "ZOMBIE_001",
  normalZombie: "ZOMBIE_000",
} as const;
export type CharacterId = (typeof CHARACTER_IDS)[keyof typeof CHARACTER_IDS];
export const UNASSIGNED_CHARACTER_ID = "";

export const HUMAN_CHARACTER_IDS = [
  CHARACTER_IDS.fossil,
  CHARACTER_IDS.sportsStudent,
  CHARACTER_IDS.sculptureStudent,
] as const satisfies readonly CharacterId[];

export function isCharacterId(value: unknown): value is CharacterId {
  return Object.values(CHARACTER_IDS).includes(value as CharacterId);
}

export function pickRandomHumanCharacter(randomValue: number): CharacterId {
  const normalized = Math.min(0.999_999, Math.max(0, randomValue));
  const index = Math.floor(normalized * HUMAN_CHARACTER_IDS.length);
  return HUMAN_CHARACTER_IDS[index] ?? CHARACTER_IDS.fossil;
}

export const SPECIAL_ZOMBIE_CHARACTER_IDS = [CHARACTER_IDS.drunkenZombie] as const;

export function pickInitialZombieCharacter(randomValue: number): CharacterId {
  const index = Math.floor(Math.min(0.999_999, Math.max(0, randomValue)) * SPECIAL_ZOMBIE_CHARACTER_IDS.length);
  return SPECIAL_ZOMBIE_CHARACTER_IDS[index] ?? CHARACTER_IDS.drunkenZombie;
}

export const NORMAL_ZOMBIE_CONFIG = {
  characterId: CHARACTER_IDS.normalZombie,
  characterName: "일반 좀비",
  team: "ZOMBIE",
  category: "NORMAL_ZOMBIE",
  selectableAsInitialZombie: false,
  spawnOnHumanInfection: true,
  movementSpeedMultiplier: 1.08,
  hasSpecialSkill: false,
  skillId: null,
  canUseBasicAttack: true,
  canInfectHumans: true,
} as const;

export function getCharacterSpeedMultiplier(characterId: string, role: string, sprintState: string): number {
  if (role === "zombie") return characterId === CHARACTER_IDS.normalZombie ? NORMAL_ZOMBIE_CONFIG.movementSpeedMultiplier : 1;
  return characterId === CHARACTER_IDS.sportsStudent ? getSportsSpeedMultiplier(sprintState) : 1;
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

export const SCULPTURE_STUDENT_CONFIG = {
  characterId: CHARACTER_IDS.sculptureStudent,
  characterName: "조각학도",
  characterNameEn: "Sculpture Student",
  skillId: "SCULPTURE_DECOY",
  skillName: "살아있는 조각상",
  decoyDurationMs: 5_000,
  movementRecordDurationMs: 5_000,
  decoySpeedMultiplier: 0.85,
  decoyMaxHits: 1,
  zombieStunDurationMs: 1_500,
  cooldownMs: 30_000,
  activationKey: CONTROL_BINDINGS.ability,
  maxActiveDecoys: 1,
  allowManualControl: false,
  allowObjectiveInteraction: false,
  allowItemInteraction: false,
  allowInfection: false,
} as const;

export interface FossilHideSpotView {
  id: string;
  x: number;
  y: number;
  interactionRadius: number;
}

export const DRUNKEN_ZOMBIE_CONFIG = {
  characterId: CHARACTER_IDS.drunkenZombie,
  skillId: "VOMIT_PROJECTILE",
  skillName: "숙취 폭발",
  castTimeMs: 500,
  cooldownMs: 30_000,
  projectileRangeTiles: 5,
  projectileSpeedTilesPerSecond: 8,
  projectileRadiusMultiplier: 0.25,
  puddleDurationMs: 4_000,
  puddleRadiusTiles: 1,
  puddleSpeedMultiplier: 0.75,
} as const;
