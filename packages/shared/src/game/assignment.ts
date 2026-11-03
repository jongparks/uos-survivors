import { CHARACTER_IDS, SPECIAL_HUMAN_CHARACTER_IDS, SPECIAL_ZOMBIE_CHARACTER_IDS, type CharacterId } from "./characters.js";

export const MATCH_MESSAGES = { start: "match:start" } as const;
export const MATCH_DISTRIBUTIONS: Readonly<Record<number, { normalHuman: number; specialHuman: number }>> = {
  4: { normalHuman: 1, specialHuman: 2 }, 5: { normalHuman: 2, specialHuman: 2 },
  6: { normalHuman: 2, specialHuman: 3 }, 7: { normalHuman: 2, specialHuman: 4 },
  8: { normalHuman: 3, specialHuman: 4 },
};

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("Invalid random roll");
    const j = Math.floor(roll * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function validateAssignments(ids: readonly string[], assignments: ReadonlyMap<string, CharacterId>): boolean {
  const distribution = MATCH_DISTRIBUTIONS[ids.length];
  if (!distribution || new Set(ids).size !== ids.length || assignments.size !== ids.length || ids.some(id => !assignments.has(id))) return false;
  const characters = [...assignments.values()];
  const specials = characters.filter(id => SPECIAL_HUMAN_CHARACTER_IDS.includes(id as typeof SPECIAL_HUMAN_CHARACTER_IDS[number]));
  return characters.filter(id => SPECIAL_ZOMBIE_CHARACTER_IDS.includes(id as typeof SPECIAL_ZOMBIE_CHARACTER_IDS[number])).length === 1 &&
    characters.filter(id => id === CHARACTER_IDS.normalHuman).length === distribution.normalHuman &&
    specials.length === distribution.specialHuman && new Set(specials).size === specials.length;
}

export function assignCharacters(ids: readonly string[], random: () => number = Math.random): Map<string, CharacterId> {
  const distribution = MATCH_DISTRIBUTIONS[ids.length];
  if (!distribution || new Set(ids).size !== ids.length) throw new Error("게임 참가 인원은 서로 다른 4~8명이어야 합니다.");
  const players = shuffle(ids, random), humans = shuffle(SPECIAL_HUMAN_CHARACTER_IDS, random), zombies = shuffle(SPECIAL_ZOMBIE_CHARACTER_IDS, random);
  const result = new Map<string, CharacterId>();
  result.set(players[0]!, zombies[0]!);
  players.slice(1).forEach((id, index) => result.set(id, index < distribution.specialHuman ? humans[index]! : CHARACTER_IDS.normalHuman));
  if (!validateAssignments(ids, result)) throw new Error("캐릭터 배정 검증에 실패했습니다.");
  return result;
}
