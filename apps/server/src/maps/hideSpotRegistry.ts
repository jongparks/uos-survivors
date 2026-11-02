export interface HideSpotCandidate {
  id: string;
  zoneId: string;
  x: number;
  y: number;
  exitX: number;
  exitY: number;
  interactionRadius: number;
}

// The production map is not designed yet. Register map-authored candidates here later.
// An empty list intentionally disables Fossil's skill without blocking the test map.
export const CURRENT_MAP_HIDE_SPOT_CANDIDATES: readonly HideSpotCandidate[] = [];
