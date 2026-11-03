import { describe, expect, it } from "vitest";
import { CHARACTER_IDS as C, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, getCharacterSpeedMultiplier } from "@uos-survivors/shared";
import { calculateHumanDanger } from "./humanDangerSystem.js";
import { infectHuman } from "./infectionSystem.js";
import { tryActivateSportsSprint } from "./sportsSprintSystem.js";
import { tryActivateSocraticMethod } from "./philosophyConfusionSystem.js";
import { EngineeringTrapSystem } from "./engineeringTrapSystem.js";
import { SculptureDecoySystem } from "./sculptureDecoySystem.js";
import { ComputerRewindSystem } from "./computerRewindSystem.js";

describe("시대생", () => {
  it("uses normal speed and common danger sense, but cannot activate a human skill", () => {
    const state = new GameState(); state.phase = GAME_PHASE.playing;
    const human = new PlayerState(); human.characterId = C.normalHuman; state.players.set("human", human);
    const zombie = new PlayerState(); zombie.role = PLAYER_ROLE.zombie; state.players.set("zombie", zombie);
    expect(getCharacterSpeedMultiplier(human.characterId, human.role, human.sprintState)).toBe(1);
    expect(calculateHumanDanger(state, human)).toBe("DANGER");
    expect(tryActivateSportsSprint(human, 1000)).toBe(false);
    expect(tryActivateSocraticMethod(state, "human", 1000)).toBeNull();
    expect(new EngineeringTrapSystem().tryActivate(state, "human", 1000)).toBe(false);
    expect(new SculptureDecoySystem().tryActivate(state, "human", 1000)).toBeNull();
    expect(new ComputerRewindSystem().tryActivate(state, "human", 1000)).toBe(false);
    expect(infectHuman(state, "human", 1000)).toBe(true);
    expect(state.players.get("human")).toBe(human); expect(human.characterId).toBe(C.normalZombie);
    expect(calculateHumanDanger(state, human)).toBe("NONE");
  });
});
