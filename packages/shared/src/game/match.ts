export const ROUND_START_RULES = { briefingMs: 5_000, countdownMs: 5_000 } as const;

export const CAMPUS_MATCH_RULES = { durationMs: 420_000, exitsOpenAfterMs: 360_000, warningAfterMs: 345_000, escapeHoldMs: 1_000, openGateCount: 2 } as const;
export const PERSONAL_RESULT = { escaped: "ESCAPED", infected: "INFECTED", failed: "FAILED_TO_ESCAPE" } as const;
