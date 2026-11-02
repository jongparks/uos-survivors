import { GAME_LIMITS } from "@uos-survivors/shared";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const nickname = value.trim().replace(/\s+/g, " ");
  const length = [...nickname].length;

  if (length < GAME_LIMITS.nicknameMinLength || length > GAME_LIMITS.nicknameMaxLength) {
    return null;
  }

  return nickname;
}

export function generateRoomCodeCandidate(random: () => number = Math.random): string {
  let code = "";

  for (let index = 0; index < GAME_LIMITS.roomCodeLength; index += 1) {
    const alphabetIndex = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[alphabetIndex] ?? ROOM_CODE_ALPHABET[0];
  }

  return code;
}

