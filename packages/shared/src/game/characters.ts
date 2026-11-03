import { CONTROL_BINDINGS } from "./controls.js";

export const CHARACTER_IDS = {
  fossil: "HUMAN_001",
  sportsStudent: "HUMAN_002",
  sculptureStudent: "HUMAN_003",
  engineeringStudent: "HUMAN_004",
  drunkenZombie: "ZOMBIE_001",
  normalZombie: "ZOMBIE_000",
  graduateZombie: "ZOMBIE_002",
  libraryNpc: "ZOMBIE_003",
  lateZombie: "ZOMBIE_004",
  xmanZombie: "ZOMBIE_005",
} as const;
export type CharacterId = (typeof CHARACTER_IDS)[keyof typeof CHARACTER_IDS];
export const UNASSIGNED_CHARACTER_ID = "";

export const HUMAN_CHARACTER_IDS = [
  CHARACTER_IDS.fossil,
  CHARACTER_IDS.sportsStudent,
  CHARACTER_IDS.sculptureStudent,
  CHARACTER_IDS.engineeringStudent,
] as const satisfies readonly CharacterId[];

export function isCharacterId(value: unknown): value is CharacterId {
  return Object.values(CHARACTER_IDS).includes(value as CharacterId);
}

export function pickRandomHumanCharacter(randomValue: number): CharacterId {
  const normalized = Math.min(0.999_999, Math.max(0, randomValue));
  const index = Math.floor(normalized * HUMAN_CHARACTER_IDS.length);
  return HUMAN_CHARACTER_IDS[index] ?? CHARACTER_IDS.fossil;
}

export const SPECIAL_ZOMBIE_CHARACTER_IDS = [CHARACTER_IDS.drunkenZombie, CHARACTER_IDS.graduateZombie, CHARACTER_IDS.libraryNpc, CHARACTER_IDS.lateZombie, CHARACTER_IDS.xmanZombie] as const;

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

export function getCharacterSpeedMultiplier(characterId: string, role: string, sprintState: string, isDisguised = false): number {
  if (role === "zombie" && characterId === CHARACTER_IDS.xmanZombie) return isDisguised ? 1 : 1.08;
  if (role === "zombie") return characterId === CHARACTER_IDS.normalZombie || characterId === CHARACTER_IDS.lateZombie ? NORMAL_ZOMBIE_CONFIG.movementSpeedMultiplier : 1;
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

export const ENGINEERING_TRAP_CONFIG = {
  characterId: CHARACTER_IDS.engineeringStudent, skillId: "ENGINEERING_TRAP", skillName: "밤샘 제작",
  castTimeMs: 500, activationDelayMs: 500, lifetimeMs: 20_000, cooldownMs: 30_000,
  rootDurationMs: 2_500, zombieVisibilityTiles: 1.5, maxActiveTraps: 1,
} as const;

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

export const GRADUATE_ZOMBIE_CONFIG = {
  characterId: CHARACTER_IDS.graduateZombie,
  skillId: "PROFESSOR_CALL",
  skillName: "교수님이 찾으신다",
  activationKey: "SHIFT",
  detectionDurationMs: 4_000,
  cooldownMs: 35_000,
  offscreenIndicatorDiameterPx: 24,
  offscreenIndicatorMarginPx: 20,
} as const;
export const GRADUATE_TRACKING_MESSAGE = "graduate:tracking";
export const LIBRARY_PLACEMENT_FAILED_MESSAGE = "library:placement-failed";
export const LATE_ZOMBIE_CONFIG = {
  characterId: CHARACTER_IDS.lateZombie, skillId: "LATE_DASH", skillName: "출석 마감", activationKey: "SHIFT",
  dashDistanceTiles: 3, dashDurationMs: 500, cooldownMs: 25_000, maxInfectionsPerDash: 1,
  allowDirectionChangeDuringDash: false, allowMoveInputDuringDash: false,
  stunOnWallCollision: false, exhaustionAfterDash: false,
} as const;

export const XMAN_ZOMBIE_CONFIG = {
  characterId: CHARACTER_IDS.xmanZombie, skillId: "FRESHMAN_DISGUISE", skillName: "새터 잠입", activationKey: "SHIFT",
  disguiseDurationMs: 10_000, cooldownMs: 40_000, disguisedSpeedMultiplier: 1, normalZombieSpeedMultiplier: 1.08,
  allowManualCancel: true, cancelOnAttack: true, attackOnCancel: true,
  attackDelayAfterManualCancelMs: 500, attackDelayAfterTimeoutMs: 500,
  basicAttackCooldownMs: 2_000, canCompleteObjectivesWhileDisguised: false,
  canUseHumanSkillsWhileDisguised: false, actualTeamWhileDisguised: "ZOMBIE",
} as const;

export function isHumanDisguise(characterId: string, role: string, isDisguised: boolean): boolean {
  return characterId === CHARACTER_IDS.xmanZombie && role === "zombie" && isDisguised;
}
export const LIBRARY_NPC_CONFIG = {
  characterId: CHARACTER_IDS.libraryNpc, skillId: "RESERVED_SEAT", skillName: "자리 맡아놨습니다",
  activationKey: "SHIFT", placementRangeTiles: 2, barrierWidthTiles: 2, barrierHeightTiles: 1,
  barrierDurationMs: 12_000, cooldownMs: 30_000, maxActiveBarriers: 1,
  blocksHumans: true, blocksZombies: false, damageHumans: false, destructible: false,
} as const;
export interface GraduateTrackingView {
  target: { id: string; x: number; y: number } | null;
  trackingEndsAt: number;
  cooldownEndsAt: number;
}
