import {
  CHARACTER_IDS,
  FOSSIL_CONFIG,
  PLAYER_ACTIVITY,
  PLAYER_ROLE,
  type FossilHideSpotView,
  type PlayerState,
} from "@uos-survivors/shared";

import type { HideSpotCandidate } from "../maps/hideSpotRegistry.js";

interface ActiveHideSpot extends HideSpotCandidate {
  consumed: boolean;
}

export type FossilInteractionResult = "entered" | "exited" | "rejected";

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];
    if (current !== undefined && swap !== undefined) {
      result[index] = swap;
      result[swapIndex] = current;
    }
  }
  return result;
}

export class FossilHideSystem {
  private readonly candidates: readonly HideSpotCandidate[];
  private readonly random: () => number;
  private readonly activeSpots = new Map<string, ActiveHideSpot>();

  constructor(candidates: readonly HideSpotCandidate[], random: () => number = Math.random) {
    this.candidates = candidates;
    this.random = random;
  }

  prepareForMatch(): void {
    this.activeSpots.clear();

    if (this.candidates.length === 0) {
      return;
    }

    if (this.candidates.length < FOSSIL_CONFIG.hideSpotCount) {
      throw new Error(
        `Map requires at least ${FOSSIL_CONFIG.hideSpotCount} Fossil hide spots; found ${this.candidates.length}`,
      );
    }

    const selected: HideSpotCandidate[] = [];
    const byZone = new Map<string, HideSpotCandidate[]>();
    for (const candidate of shuffled(this.candidates, this.random)) {
      const zone = byZone.get(candidate.zoneId) ?? [];
      zone.push(candidate);
      byZone.set(candidate.zoneId, zone);
    }

    for (const zone of shuffled(Array.from(byZone.values()), this.random)) {
      const candidate = zone[0];
      if (candidate) {
        selected.push(candidate);
      }
      if (selected.length === FOSSIL_CONFIG.hideSpotCount) {
        break;
      }
    }

    if (selected.length < FOSSIL_CONFIG.hideSpotCount) {
      const selectedIds = new Set(selected.map((spot) => spot.id));
      const remaining = shuffled(
        this.candidates.filter((candidate) => !selectedIds.has(candidate.id)),
        this.random,
      );
      selected.push(...remaining.slice(0, FOSSIL_CONFIG.hideSpotCount - selected.length));
    }

    for (const spot of selected) {
      this.activeSpots.set(spot.id, { ...spot, consumed: false });
    }
  }

  clear(): void {
    this.activeSpots.clear();
  }

  resetPlayer(player: PlayerState): void {
    player.activity = PLAYER_ACTIVITY.normal;
    player.activeHideSpotId = "";
    player.hideStartedAt = 0;
    player.hideEndsAt = 0;
  }

  interact(player: PlayerState, now: number): FossilInteractionResult {
    if (now < player.assignmentLockEndsAt) return "rejected";
    if (player.activity === PLAYER_ACTIVITY.hidden) {
      return this.exit(player) ? "exited" : "rejected";
    }

    if (
      player.characterId !== CHARACTER_IDS.fossil ||
      player.role !== PLAYER_ROLE.human ||
      !player.connected
    ) {
      return "rejected";
    }

    let closest: ActiveHideSpot | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const spot of this.activeSpots.values()) {
      if (spot.consumed) {
        continue;
      }
      const distance = Math.hypot(player.x - spot.x, player.y - spot.y);
      if (distance <= spot.interactionRadius && distance < closestDistance) {
        closest = spot;
        closestDistance = distance;
      }
    }

    if (!closest) {
      return "rejected";
    }

    closest.consumed = true;
    player.activity = PLAYER_ACTIVITY.hidden;
    player.activeHideSpotId = closest.id;
    player.hideStartedAt = now;
    player.hideEndsAt = now + FOSSIL_CONFIG.hideDurationMs;
    return "entered";
  }

  update(player: PlayerState, now: number): boolean {
    return player.activity === PLAYER_ACTIVITY.hidden && now >= player.hideEndsAt
      ? this.exit(player)
      : false;
  }

  exit(player: PlayerState): boolean {
    if (player.activity !== PLAYER_ACTIVITY.hidden) {
      return false;
    }

    const spot = this.activeSpots.get(player.activeHideSpotId);
    if (spot) {
      player.x = spot.exitX;
      player.y = spot.exitY;
    }
    this.resetPlayer(player);
    return true;
  }

  getAvailableSpotViews(): FossilHideSpotView[] {
    return Array.from(this.activeSpots.values())
      .filter((spot) => !spot.consumed)
      .map(({ id, x, y, interactionRadius }) => ({ id, x, y, interactionRadius }));
  }
}
