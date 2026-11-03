export const DANGER_LEVEL = { none: "NONE", warning: "WARNING", danger: "DANGER" } as const;
export type DangerLevel = (typeof DANGER_LEVEL)[keyof typeof DANGER_LEVEL];
export const HUMAN_DANGER_CONFIG = {
  systemId: "HUMAN_PASSIVE_001", version: "1.1", maxRangeTiles: 4, dangerRangeTiles: 2,
  intervalMs: 100, warningOpacity: 0.18, dangerOpacity: 0.42, pulseCycleMs: 800, transitionMs: 200,
} as const;
export const DANGER_MESSAGES = { subscribe: "danger:subscribe", update: "danger:update" } as const;
export interface DangerUpdate { level: DangerLevel }
