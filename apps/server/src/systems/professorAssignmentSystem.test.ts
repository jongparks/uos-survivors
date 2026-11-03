import { describe, expect, it } from "vitest";
import {
  CHARACTER_IDS as C, GAME_PHASE, GameState, PlayerState, PLAYER_ROLE, PLAYER_ACTIVITY,
  SculptureDecoyState, type AssignmentChallengeView,
} from "@uos-survivors/shared";
import { ProfessorAssignmentSystem } from "./professorAssignmentSystem.js";
import { resolveZombieAttack } from "./combatSystem.js";
import { infectHuman } from "./infectionSystem.js";
import { tryActivateSportsSprint, updateSportsSprint } from "./sportsSprintSystem.js";
import { EngineeringTrapSystem } from "./engineeringTrapSystem.js";
import { ComputerRewindSystem } from "./computerRewindSystem.js";
import { tryActivateSocraticMethod } from "./philosophyConfusionSystem.js";
import { SculptureDecoySystem } from "./sculptureDecoySystem.js";
import { FossilHideSystem } from "./fossilHideSystem.js";

function setup(random = () => 0) {
  const state = new GameState(); state.phase = GAME_PHASE.playing;
  const professor = new PlayerState(); Object.assign(professor, { role: PLAYER_ROLE.zombie, characterId: C.professor, x: 120, y: 120 }); state.players.set("professor", professor);
  const human = new PlayerState(); Object.assign(human, { characterId: C.normalHuman, x: 180, y: 120 }); state.players.set("human", human);
  const sent: Array<{ target: string; view: AssignmentChallengeView }> = [];
  const send = (target: string, view: AssignmentChallengeView) => sent.push({ target, view });
  return { state, professor, human, sent, send, system: new ProfessorAssignmentSystem(random) };
}

describe("교수님 과제 제출하세요", () => {
  it.each([0, 0.4, 0.999])("generates 2–4 arrows including repeated keys and sends the answer only to its target: %s", roll => {
    const { state, professor, human, sent, send, system } = setup(() => roll);
    expect(system.tryActivate(state, "professor", 1000, send)).toBe(true);
    expect(sent[0]!.target).toBe("human"); expect(sent[0]!.view.sequence.length).toBe(2 + Math.floor(roll * 3));
    expect(new Set(sent[0]!.view.sequence).size).toBe(1);
    expect(human.assignmentLockEndsAt).toBe(4000); expect(professor.attackLockedUntil).toBe(2000); expect(professor.professorCooldownEndsAt).toBe(41000);
    expect(system.tryActivate(state, "professor", 1001, send)).toBe(false);
  });
  it("selects nearest eligible human, skips hidden/locked humans and ignores decoys", () => {
    const { state, human, system, send, sent } = setup(); human.activity = PLAYER_ACTIVITY.hidden;
    const locked = new PlayerState(); Object.assign(locked, { x: 130, y: 120, assignmentLockEndsAt: 5000 }); state.players.set("locked", locked);
    const eligible = new PlayerState(); eligible.x = 200; eligible.y = 120; state.players.set("eligible", eligible);
    state.decoys.set("decoy", new SculptureDecoyState());
    expect(system.tryActivate(state, "professor", 1000, send)).toBe(true); expect(sent[0]!.target).toBe("eligible");
  });
  it("does not consume cooldown if no valid human is within range", () => {
    const { state, human, professor, system, send } = setup(); human.x = 313;
    expect(system.tryActivate(state, "professor", 1000, send)).toBe(false); expect(professor.professorCooldownEndsAt).toBe(0);
    human.x = 312; expect(system.tryActivate(state, "professor", 1000, send)).toBe(true);
  });
  it("resets progress on wrong input and immediately releases on successful completion", () => {
    const { state, human, professor, system, send, sent } = setup(); system.tryActivate(state, "professor", 1000, send);
    const id = sent[0]!.view.id;
    system.input(state, "human", { id, direction: "UP" }, 1100, send); expect(sent.at(-1)!.view.progressIndex).toBe(1);
    system.input(state, "human", { id, direction: "RIGHT" }, 1150, send); expect(sent.at(-1)!.view.event).toBe("failed"); expect(sent.at(-1)!.view.progressIndex).toBe(0);
    system.input(state, "human", { id, direction: "UP" }, 1200, send);
    system.input(state, "human", { id, direction: "UP" }, 1250, send);
    expect(human.assignmentLockEndsAt).toBe(0); expect(sent.at(-1)!.view.event).toBe("completed");
    expect(professor.attackLockedUntil).toBe(2000); expect(professor.professorCooldownEndsAt).toBe(41000);
  });
  it("rejects another player's inputs, invalid directions, forged completion and stale mission IDs", () => {
    const { state, human, system, send, sent } = setup(); system.tryActivate(state, "professor", 1000, send); const id = sent[0]!.view.id;
    for (const [target, payload] of [["professor", { id, direction: "UP" }], ["human", { id: "old", direction: "UP" }], ["human", { id, completed: true }], ["human", { id, direction: "INVALID" }]] as const) system.input(state, target, payload, 1100, send);
    expect(sent.length).toBe(1); expect(human.assignmentLockEndsAt).toBe(4000);
  });
  it("expires after three seconds even if a key arrives exactly at timeout", () => {
    const { state, human, system, send, sent } = setup(); system.tryActivate(state, "professor", 1000, send);
    system.input(state, "human", { id: sent[0]!.view.id, direction: "UP" }, 4000, send);
    expect(human.assignmentLockEndsAt).toBe(0); expect(sent.at(-1)!.view.event).toBe("expired");
  });
  it("locks only the professor's attack, keeps previous attack cooldown, and permits other zombies", () => {
    const { state, professor, system, send } = setup(); professor.nextAttackAt = 3000; system.tryActivate(state, "professor", 1000, send);
    expect(resolveZombieAttack(state, "professor", 1999)).toBeNull(); expect(resolveZombieAttack(state, "professor", 2000)).toBeNull();
    const other = new PlayerState(); Object.assign(other, { role: PLAYER_ROLE.zombie, x: 120, y: 120 }); state.players.set("other", other);
    expect(resolveZombieAttack(state, "other", 1100)).toEqual({ type: "human", id: "human" });
    expect(resolveZombieAttack(state, "professor", 3000)).toEqual({ type: "human", id: "human" });
  });
  it.each(["infection", "disconnect", "match-end"])("cancels on %s", cause => {
    const { state, human, system, send, sent } = setup(); system.tryActivate(state, "professor", 1000, send);
    if (cause === "infection") infectHuman(state, "human", 1200);
    if (cause === "disconnect") human.connected = false;
    if (cause === "match-end") state.phase = GAME_PHASE.finished;
    system.update(state, 1200, send); expect(human.assignmentLockEndsAt).toBe(0); expect(sent.at(-1)!.view.event).toBe("cancelled");
  });
  it("keeps sprint timers running and refuses every human skill while locked", () => {
    const { state, human, system, send } = setup(); system.tryActivate(state, "professor", 1000, send);
    human.characterId = C.sportsStudent; human.sprintState = "sprinting"; human.sprintEndsAt = 1200; human.exhaustionEndsAt = 3200; human.cooldownEndsAt = 26000;
    updateSportsSprint(human, 1300); expect(human.sprintState).toBe("exhausted"); expect(tryActivateSportsSprint(human, 1300)).toBe(false);
    human.characterId = C.engineeringStudent; expect(new EngineeringTrapSystem().tryActivate(state, "human", 1300)).toBe(false);
    human.characterId = C.sculptureStudent; expect(new SculptureDecoySystem().tryActivate(state, "human", 1300)).toBeNull();
    human.characterId = C.philosophyStudent; expect(tryActivateSocraticMethod(state, "human", 1300)).toBeNull();
    human.characterId = C.computerStudent; expect(new ComputerRewindSystem().tryActivate(state, "human", 1300)).toBe(false);
    human.characterId = C.fossil; expect(new FossilHideSystem([]).interact(human, 1300)).toBe("rejected");
  });
  it("restores mission progress only to its owner during synchronization", () => {
    const { state, system, send, sent } = setup(); system.tryActivate(state, "professor", 1000, send);
    const id = sent[0]!.view.id; system.input(state, "human", { id, direction: "UP" }, 1100, send);
    system.sync("human", send); expect(sent.at(-1)!.view.progressIndex).toBe(1);
    system.sync("professor", send); expect(sent.at(-1)!.view.sequence).toEqual([]);
  });
});
