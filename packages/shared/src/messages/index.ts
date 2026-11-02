import { schema, t, type SchemaType } from "@colyseus/schema";

export const MovementInput = schema(
  {
    moveX: t.int8<-1 | 0 | 1>().default(0),
    moveY: t.int8<-1 | 0 | 1>().default(0),
  },
  "MovementInput",
);
export type MovementInput = SchemaType<typeof MovementInput>;

export interface MovementAxes {
  moveX: number;
  moveY: number;
}

export const IDLE_MOVEMENT_INPUT = {
  moveX: 0,
  moveY: 0,
} as const satisfies MovementAxes;

