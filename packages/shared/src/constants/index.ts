export const GAME_SERVER = {
  defaultUrl: "http://localhost:2567",
  port: 2567,
} as const;

export const ROOM_NAMES = {
  game: "game",
} as const;

export const GAME_LIMITS = {
  maxPlayersPerRoom: 8,
  nicknameMinLength: 2,
  nicknameMaxLength: 16,
  roomCodeLength: 6,
} as const;

export const NETWORK_RATE = {
  simulationHz: 30,
  stateSyncHz: 20,
  inputTimeoutMs: 250,
} as const;

