import { schema, t, type SchemaType } from "@colyseus/schema";

export const MovementInput = schema(
  {
    moveX: t.int8<-1 | 0 | 1>().default(0),
    moveY: t.int8<-1 | 0 | 1>().default(0),
    attack: t.boolean().default(false),
  },
  "MovementInput",
);
export type MovementInput = SchemaType<typeof MovementInput>;

export interface MovementAxes {
  moveX: number;
  moveY: number;
}

export interface PlayerControls extends MovementAxes {
  attack: boolean;
}

export const IDLE_MOVEMENT_INPUT = {
  moveX: 0,
  moveY: 0,
  attack: false,
} as const satisfies PlayerControls;

