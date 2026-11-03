import { describe, expect, it } from "vitest";
import { CAMPUS_MATCH_RULES as C, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, RoundResultState } from "@uos-survivors/shared";
import { MatchTimerGateSystem } from "./matchTimerGateSystem.js";
import { infectHuman, finishIfAllHumansInfected } from "./infectionSystem.js";
import { resolveZombieAttack } from "./combatSystem.js";

function setup() {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  for (const id of ["a", "b", "z"]) {
    const p = new PlayerState(); p.role = id === "z" ? PLAYER_ROLE.zombie : PLAYER_ROLE.human; p.x = id === "a" ? 100 : 1200; p.y = 300;
    state.players.set(id, p); const result = new RoundResultState(); result.nickname = id; result.startedAsHuman = id !== "z"; state.roundResults.set(id, result);
  }
  const system = new MatchTimerGateSystem(); system.start(state, 1000, () => 0);
  return { state, system, a: state.players.get("a")!, b: state.players.get("b")!, z: state.players.get("z")! };
}
function atOpenGate(f: ReturnType<typeof setup>) {
  const now = 1000 + C.exitsOpenAfterMs; f.system.update(f.state, now);
  const gate = [...f.state.gates.values()].find(g => g.status === "OPEN")!;
  f.a.x = gate.x; f.a.y = gate.y; return now;
}

describe("seven-minute survival and escape", () => {
  it("does not expose selected gates before six minutes and warns at 5:45", () => {
    const { state, system } = setup();
    expect([...state.gates.values()].every(g => g.status === "LOCKED")).toBe(true);
    system.update(state, 1000 + C.warningAfterMs - 1); expect(state.exitWarning).toBe(false);
    system.update(state, 1000 + C.warningAfterMs); expect(state.exitWarning).toBe(true);
    expect([...state.gates.values()].filter(g => g.status === "OPEN")).toHaveLength(0);
    system.update(state, 1000 + C.exitsOpenAfterMs);
    expect([...state.gates.values()].filter(g => g.status === "OPEN")).toHaveLength(2);
    expect(state.roundStage).toBe("ESCAPE");
  });
  it("requires a full one-second hold and secures human victory without ending while humans remain", () => {
    const f = setup(), now = atOpenGate(f);
    expect(f.system.interact(f.state, "a", true, now)).toBe(false);
    expect(f.system.interact(f.state, "a", true, now + 999)).toBe(false);
    expect(f.system.interact(f.state, "a", true, now + 1000)).toBe(true);
    expect(f.state.escapedCount).toBe(1); expect(f.state.winner).toBe("human"); expect(f.state.phase).toBe(GAME_PHASE.playing);
    expect(f.a.personalResult).toBe("ESCAPED"); expect(f.state.roundResults.get("a")?.result).toBe("ESCAPED");
    expect(infectHuman(f.state, "a", now + 1001)).toBe(false);
    f.z.x = f.a.x - 30; f.z.y = f.a.y;
    expect(resolveZombieAttack(f.state, "z", now + 1002)).toBeNull();
  });
  it.each(["movement", "release", "infection", "assignment"])("cancels escape on %s", reason => {
    const f = setup(), now = atOpenGate(f); f.system.interact(f.state, "a", true, now);
    if (reason === "movement") f.a.x++;
    if (reason === "infection") infectHuman(f.state, "a", now + 500);
    if (reason === "assignment") f.a.assignmentLockEndsAt = now + 2000;
    f.system.interact(f.state, "a", reason !== "release", now + 500);
    expect(f.a.escaped).toBe(false); expect(f.a.escapeStartedAt).toBe(0); expect(f.state.escapedCount).toBe(0);
  });
  it("closes all exits at seven minutes and refuses a hold finishing at the deadline", () => {
    const f = setup(); atOpenGate(f);
    f.system.interact(f.state, "a", true, f.state.matchEndsAt - 1000);
    expect(f.system.interact(f.state, "a", true, f.state.matchEndsAt)).toBe(false);
    f.system.update(f.state, f.state.matchEndsAt);
    expect(f.state.phase).toBe(GAME_PHASE.finished); expect(f.state.winner).toBe("zombie");
    expect([...f.state.gates.values()].every(g => g.status === "CLOSED")).toBe(true);
    expect(f.a.personalResult).toBe("FAILED_TO_ESCAPE");
  });
  it("keeps escaped victory when remaining humans are infected or when time expires", () => {
    const f = setup(), now = atOpenGate(f); f.system.interact(f.state, "a", true, now); f.system.interact(f.state, "a", true, now + 1000);
    infectHuman(f.state, "b", now + 1100); expect(finishIfAllHumansInfected(f.state)).toBe(true);
    expect(f.state.winner).toBe("human"); expect(f.b.personalResult).toBe("INFECTED");
    expect(f.state.roundResults.get("a")?.result).toBe("ESCAPED");
  });
  it("gives zombie victory when every human is infected with no escapes", () => {
    const { state } = setup(); infectHuman(state, "a", 2000); infectHuman(state, "b", 2100);
    expect(finishIfAllHumansInfected(state)).toBe(true); expect(state.winner).toBe("zombie");
  });
  it("allows humans only and never channels at locked gates", () => {
    const f = setup(); const gate = [...f.state.gates.values()][0]!; f.a.x = gate.x; f.a.y = gate.y;
    expect(f.system.interact(f.state, "a", true, 2000)).toBe(false);
    atOpenGate(f); f.z.x = f.a.x; f.z.y = f.a.y;
    expect(f.system.interact(f.state, "z", true, 361000)).toBe(false);
  });
});
