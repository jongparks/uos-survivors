import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    nickname: t.string().default(""),
    x: t.float32().default(0),
    y: t.float32().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const GameState = schema(
  {
    roomCode: t.string().default(""),
    players: t.map(PlayerState),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;

