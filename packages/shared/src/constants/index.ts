export const GAME_SERVER = {
  defaultUrl: "http://localhost:2567",
  port: 2567,
} as const;

export const ROOM_NAMES = {
  game: "game",
} as const;

export const ROOM_VISIBILITY = {
  public: "public",
  private: "private",
} as const;

export type RoomVisibility = (typeof ROOM_VISIBILITY)[keyof typeof ROOM_VISIBILITY];

export const GAME_LIMITS = {
  maxPlayersPerRoom: 8,
  nicknameMinLength: 2,
  nicknameMaxLength: 16,
  roomCodeLength: 6,
} as const;

export const NETWORK_RATE = {
  simulationHz: 30,
  stateSyncHz: 20,
  inputBufferMaxSize: 64,
  interpolationDelayMs: 100,
  correctionSmoothMs: 65,
} as const;

export const RECONNECTION = {
  windowSeconds: 15,
  maxRetries: 10,
  minUptimeMs: 0,
  maxDelayMs: 1_000,
} as const;

