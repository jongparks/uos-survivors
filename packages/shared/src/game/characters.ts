export const CHARACTER_IDS = {
  fossil: "HUMAN_001",
} as const;
export type CharacterId = (typeof CHARACTER_IDS)[keyof typeof CHARACTER_IDS];

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
  interactionKey: "E",
  allowEarlyExit: true,
  consumeSpotOnEnter: true,
} as const;

export const FOSSIL_MESSAGES = {
  requestHideSpots: "fossil:request-hide-spots",
  hideSpots: "fossil:hide-spots",
} as const;

export interface FossilHideSpotView {
  id: string;
  x: number;
  y: number;
  interactionRadius: number;
}
