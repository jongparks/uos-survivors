export const CLIENT_MESSAGES = {
  movement: "player:movement",
} as const;

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const IDLE_MOVEMENT_INPUT: Readonly<MovementInput> = {
  up: false,
  down: false,
  left: false,
  right: false,
};

export function parseMovementInput(value: unknown): MovementInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MovementInput>;
  const fields: Array<keyof MovementInput> = ["up", "down", "left", "right"];

  if (fields.some((field) => typeof candidate[field] !== "boolean")) {
    return null;
  }

  return {
    up: candidate.up as boolean,
    down: candidate.down as boolean,
    left: candidate.left as boolean,
    right: candidate.right as boolean,
  };
}

