import { schema, t, type SchemaType } from "@colyseus/schema";

export const CHAT_MESSAGES = { send: "chat:send", bubble: "chat:bubble" } as const;
export const CHAT_RULES = { maxLength: 80, cooldownMs: 750, displayMs: 4_000 } as const;

export interface ChatBubbleMessage {
  sessionId: string;
  text: string;
}

export const MovementInput = schema(
  {
    moveX: t.int8<-1 | 0 | 1>().default(0),
    moveY: t.int8<-1 | 0 | 1>().default(0),
    interact: t.boolean().default(false),
    useSkill: t.boolean().default(false),
  },
  "MovementInput",
);
export type MovementInput = SchemaType<typeof MovementInput>;

export interface MovementAxes {
  moveX: number;
  moveY: number;
}

export interface PlayerControls extends MovementAxes {
  interact: boolean;
  useSkill: boolean;
}

export const IDLE_MOVEMENT_INPUT = {
  moveX: 0,
  moveY: 0,
  interact: false,
  useSkill: false,
} as const satisfies PlayerControls;

