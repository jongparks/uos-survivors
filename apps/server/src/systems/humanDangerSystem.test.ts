import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, DANGER_LEVEL as L, GAME_PHASE, GameState, PlayerState, PLAYER_ACTIVITY, PLAYER_ROLE, TILE_SIZE, type DangerUpdate } from "@uos-survivors/shared";
import { calculateHumanDanger, HumanDangerSystem } from "./humanDangerSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const human = new PlayerState(); state.players.set("human", human);
  const zombie = new PlayerState(); zombie.role = PLAYER_ROLE.zombie; state.players.set("zombie", zombie);
  return { state, human, zombie };
}

describe("인간 공통 위험 감지 v1.1", () => {
  it.each([[4.001, L.none], [4, L.warning], [2, L.warning], [1.999, L.danger], [0, L.danger]] as const)("handles distance %s tiles", (distance, level) => {
    const { state, human, zombie } = setup(); zombie.x = distance * TILE_SIZE;
    expect(calculateHumanDanger(state, human)).toBe(level);
  });
  it("uses Euclidean distance regardless of walls or camera", () => {
    const { state, human, zombie } = setup();
    human.x = 15.5 * TILE_SIZE; human.y = 8.5 * TILE_SIZE;
    zombie.x = 17.5 * TILE_SIZE; zombie.y = 8.5 * TILE_SIZE;
    expect(calculateHumanDanger(state, human)).toBe(L.warning);
    zombie.y += 4 * TILE_SIZE; expect(calculateHumanDanger(state, human)).toBe(L.none);
  });
  it("caps disguised X-Man at warning, but takes the maximum across every zombie", () => {
    const { state, human, zombie } = setup();
    zombie.characterId = CHARACTER_IDS.xmanZombie; zombie.isDisguised = true; zombie.x = TILE_SIZE;
    expect(calculateHumanDanger(state, human)).toBe(L.warning);
    const other = new PlayerState(); other.role = PLAYER_ROLE.zombie; other.x = 1.5 * TILE_SIZE; state.players.set("other", other);
    expect(calculateHumanDanger(state, human)).toBe(L.danger);
    other.x = 3 * TILE_SIZE; expect(calculateHumanDanger(state, human)).toBe(L.warning);
    zombie.isDisguised = false; expect(calculateHumanDanger(state, human)).toBe(L.danger);
  });
  it("turns off for hidden Fossil and non-humans, but ignores sprint states and decoys", () => {
    const { state, human, zombie } = setup(); human.characterId = CHARACTER_IDS.fossil; human.activity = PLAYER_ACTIVITY.hidden;
    expect(calculateHumanDanger(state, human)).toBe(L.none);
    human.activity = PLAYER_ACTIVITY.normal; expect(calculateHumanDanger(state, human)).toBe(L.danger);
    human.characterId = CHARACTER_IDS.sportsStudent; human.sprintState = "exhausted";
    expect(calculateHumanDanger(state, human)).toBe(L.danger);
    zombie.connected = false; expect(calculateHumanDanger(state, human)).toBe(L.none);
    human.role = PLAYER_ROLE.zombie; expect(calculateHumanDanger(state, human)).toBe(L.none);
  });
  it("samples movement at 100ms, only sends changed levels, and sends no identifying details", () => {
    const { state, human, zombie } = setup(); const system = new HumanDangerSystem();
    const sent: Array<[string, DangerUpdate]> = []; const send = (id: string, update: DangerUpdate) => sent.push([id, update]);
    zombie.x = 5 * TILE_SIZE; system.update(state, 1000, send);
    expect(sent).toEqual([["human", { level: L.none }]]);
    zombie.x = TILE_SIZE; system.update(state, 1099, send); expect(sent.length).toBe(1);
    system.update(state, 1100, send); expect(sent.at(-1)).toEqual(["human", { level: L.danger }]);
    system.update(state, 1200, send); expect(sent.length).toBe(2);
    expect(Object.keys(sent[1]![1])).toEqual(["level"]);
    human.role = PLAYER_ROLE.zombie; system.update(state, 1201, send); expect(sent.length).toBe(2);
  });
  it("recalculates immediately on disguise, infection and hide changes; restores on reconnect", () => {
    const { state, human, zombie } = setup(); const system = new HumanDangerSystem();
    const sent: DangerUpdate[] = []; const send = (_id: string, update: DangerUpdate) => sent.push(update);
    zombie.characterId = CHARACTER_IDS.xmanZombie; zombie.isDisguised = true;
    system.update(state, 1000, send); expect(sent.at(-1)?.level).toBe(L.warning);
    zombie.isDisguised = false; system.update(state, 1001, send); expect(sent.at(-1)?.level).toBe(L.danger);
    human.characterId = CHARACTER_IDS.fossil; human.activity = PLAYER_ACTIVITY.hidden;
    system.update(state, 1002, send); expect(sent.at(-1)?.level).toBe(L.none);
    human.activity = PLAYER_ACTIVITY.normal; system.update(state, 1003, send); expect(sent.at(-1)?.level).toBe(L.danger);
    const previous = sent.length; system.forget("human"); system.update(state, 1103, send); expect(sent.length).toBe(previous + 1);
    state.phase = GAME_PHASE.finished; system.update(state, 1104, send); expect(sent.at(-1)?.level).toBe(L.none);
  });
});
