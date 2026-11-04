import type { Client, StepContext } from "colyseus";
import { Room } from "colyseus";
import { StateView } from "@colyseus/schema";

import {
  CHARACTER_IDS,
  DANGER_MESSAGES,
  ASSIGNMENT_MESSAGES,
  type AssignmentChallengeView,
  type EngineeringTrapState,
  GRADUATE_TRACKING_MESSAGE,
  COMBAT_RULES,
  FOSSIL_MESSAGES,
  GAME_LIMITS,
  GAME_PHASE,
  GameState,
  MATCH_WINNER,
  MovementInput,
  NETWORK_RATE,
  PLAYER_SPEED,
  PLAYER_BODY_SIZE,
  PLAYER_ACTIVITY,
  PlayerState,
  RoundResultState, DEFAULT_MAP_ID, getGameMap, validateGameMap,
  PLAYER_ROLE,
  RECONNECTION,
  ROOM_VISIBILITY,
  UNASSIGNED_CHARACTER_ID,
  applyMovementWithBarriers,
  LIBRARY_PLACEMENT_FAILED_MESSAGE,
  assignCharacters,
  MATCH_MESSAGES, ROUND_START_RULES,
  SPECIAL_ZOMBIE_CHARACTER_IDS,
  pickInitialZombieCharacter,
  getPuddleSpeedMultiplier,
  getConfusedMovement,
  type RoomVisibility,
} from "@uos-survivors/shared";

import { generateRoomCodeCandidate, normalizeNickname } from "../config/playerIdentity.js";
import { resolveZombieAttack } from "../systems/combatSystem.js";
import { FossilHideSystem } from "../systems/fossilHideSystem.js";
import { finishIfAllHumansInfected, infectHuman } from "../systems/infectionSystem.js";
import { SculptureDecoySystem } from "../systems/sculptureDecoySystem.js";
import { VomitSystem } from "../systems/vomitSystem.js";
import { GraduateTrackingSystem } from "../systems/graduateTrackingSystem.js";
import { LibraryBarrierSystem } from "../systems/libraryBarrierSystem.js";
import { LateDashSystem } from "../systems/lateDashSystem.js";
import { HumanDangerSystem, calculateHumanDanger } from "../systems/humanDangerSystem.js";
import { EngineeringTrapSystem, canSeeEngineeringTrap } from "../systems/engineeringTrapSystem.js";
import { ComputerRewindSystem } from "../systems/computerRewindSystem.js";
import { tryActivateSocraticMethod, updateConfusion, resetPhilosophyState } from "../systems/philosophyConfusionSystem.js";
import { MatchTimerGateSystem } from "../systems/matchTimerGateSystem.js";
import { ProfessorAssignmentSystem } from "../systems/professorAssignmentSystem.js";
import { resetXmanDisguise, updateXmanDisguise, tryToggleXmanDisguise } from "../systems/xmanDisguiseSystem.js";
import {
  getPlayerSpeedMultiplier,
  resetSportsSprint,
  tryActivateSportsSprint,
  updateSportsSprint,
} from "../systems/sportsSprintSystem.js";

const INVITE_CODE_CHANNEL = "$uos-survivors-room-codes";

interface RoomOptions {
  mapId?: string;
  nickname?: unknown;
  visibility?: RoomVisibility;
}

export class GameRoom extends Room<{ state: GameState; input: MovementInput }> {
  state = new GameState();
  maxClients = GAME_LIMITS.maxPlayersPerRoom;
  patchRate = 1000 / NETWORK_RATE.stateSyncHz;
  maxMessagesPerSecond = 60;
  private fossilHideSystem = new FossilHideSystem([]);
  private readonly matchTimerGateSystem = new MatchTimerGateSystem();
  private finishedCleanupDone = false;
  private readonly sculptureDecoySystem = new SculptureDecoySystem();
  private readonly vomitSystem = new VomitSystem();
  private readonly graduateTrackingSystem = new GraduateTrackingSystem();
  private readonly libraryBarrierSystem = new LibraryBarrierSystem();
  private readonly lateDashSystem = new LateDashSystem();
  private readonly humanDangerSystem = new HumanDangerSystem();
  private readonly engineeringTrapSystem = new EngineeringTrapSystem();
  private readonly computerRewindSystem = new ComputerRewindSystem();
  private readonly professorAssignmentSystem = new ProfessorAssignmentSystem();
  private readonly assignmentSubscribers = new Set<string>();
  private readonly sendAssignment = (id: string, view: AssignmentChallengeView): void => {
    if (this.assignmentSubscribers.has(id)) this.clients.find(c => c.sessionId === id)?.send(ASSIGNMENT_MESSAGES.state, view);
  };
  private readonly visibleTraps = new Map<string, Set<EngineeringTrapState>>();
  private readonly dangerSubscribers = new Set<string>();
  private readonly interactionHeld = new Map<string, boolean>();
  private readonly skillHeld = new Map<string, boolean>();
  private readonly hideSpotSubscribers = new Set<string>();

  inputs = this.defineInput(MovementInput, {
    bufferMaxSize: NETWORK_RATE.inputBufferMaxSize,
    sanitize: {
      moveX: [-1, 1],
      moveY: [-1, 1],
    },
    idle: () => true,
  });

  async onCreate(options: RoomOptions): Promise<void> {
    const map = getGameMap(options.mapId ?? DEFAULT_MAP_ID);
    const errors = validateGameMap(map); if (errors.length) throw new Error(errors.join('; '));
    this.state.mapId = map.id; this.fossilHideSystem = new FossilHideSystem(map.hideSpots);
    this.matchTimerGateSystem.initializeGates(this.state);
    this.roomId = await this.generateRoomCode();
    this.state.roomCode = this.roomId;
    this.state.isPrivate = options.visibility === ROOM_VISIBILITY.private;
    await this.setPrivate(this.state.isPrivate);
    this.onMessage(ASSIGNMENT_MESSAGES.subscribe, client => {
      this.assignmentSubscribers.add(client.sessionId);
      this.professorAssignmentSystem.update(this.state, Date.now(), this.sendAssignment);
      this.professorAssignmentSystem.sync(client.sessionId, this.sendAssignment);
    });
    this.onMessage(ASSIGNMENT_MESSAGES.input, (client, payload: unknown) => {
      this.professorAssignmentSystem.input(this.state, client.sessionId, payload, Date.now(), this.sendAssignment);
    });
    this.onMessage(MATCH_MESSAGES.start, client => {
      if (client.sessionId === this.state.hostSessionId) this.tryStartMatch();
    });
    this.onMessage(DANGER_MESSAGES.subscribe, client => {
      this.dangerSubscribers.add(client.sessionId);
      const human = this.state.players.get(client.sessionId);
      if (human?.role === PLAYER_ROLE.human) client.send(DANGER_MESSAGES.update, { level: calculateHumanDanger(this.state, human) });
    });
    this.onMessage(FOSSIL_MESSAGES.requestHideSpots, (client) => {
      this.hideSpotSubscribers.add(client.sessionId);
      this.sendHideSpots(client);
    });
    this.setFixedTimestep((context) => this.simulate(context), NETWORK_RATE.simulationHz);
  }

  onJoin(client: Client, options: RoomOptions): void {
    const player = new PlayerState();
    const map = getGameMap(this.state.mapId);
    const spawn = map.spawns.find(p => [...this.state.players.values()].every(other => other.escaped || Math.abs(p.x - other.x) >= PLAYER_BODY_SIZE || Math.abs(p.y - other.y) >= PLAYER_BODY_SIZE)) ?? map.spawns[this.state.players.size % map.spawns.length]!;

    player.nickname = normalizeNickname(options.nickname) ?? `생존자${this.state.players.size + 1}`;
    player.connected = true;
    player.role = PLAYER_ROLE.human;
    if (this.state.phase === GAME_PHASE.playing || this.state.phase === GAME_PHASE.preparing) {
      player.characterId = CHARACTER_IDS.normalHuman;
    }
    player.x = spawn.x; player.y = spawn.y;
    this.state.players.set(client.sessionId, player);
    if (this.state.phase === GAME_PHASE.playing || this.state.phase === GAME_PHASE.preparing) {
      const result = new RoundResultState(); result.nickname = player.nickname; result.startedAsHuman = true;
      this.state.roundResults.set(client.sessionId, result);
    }
    this.addPlayerToClientViews(client, player);
    this.updateHost();
    this.computerRewindSystem.record(this.state, client.sessionId, Date.now());
  }

  onDrop(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = false;
    }
    this.updateHost();

    this.allowReconnection(client, RECONNECTION.windowSeconds);
  }

  onReconnect(client: Client): void {
    this.humanDangerSystem.forget(client.sessionId);
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = true;
    }
    this.updateHost();

    this.syncClientView(client);
  }

  onLeave(client: Client): void {
    const leaving = this.state.players.get(client.sessionId), leavingResult = this.state.roundResults.get(client.sessionId);
    if (leaving?.role === PLAYER_ROLE.human && !leaving.escaped && leavingResult && !leavingResult.result) leavingResult.result = 'FAILED_TO_ESCAPE';
    this.matchTimerGateSystem.cancel(client.sessionId, leaving);
    this.assignmentSubscribers.delete(client.sessionId);
    this.engineeringTrapSystem.removeOwner(this.state, client.sessionId);
    this.computerRewindSystem.remove(client.sessionId);
    this.visibleTraps.delete(client.sessionId);
    this.dangerSubscribers.delete(client.sessionId);
    this.humanDangerSystem.forget(client.sessionId);
    client.view?.dispose();
    this.interactionHeld.delete(client.sessionId);
    this.skillHeld.delete(client.sessionId);
    this.vomitSystem.cancel(client.sessionId);
    this.graduateTrackingSystem.remove(client.sessionId);
    this.lateDashSystem.cancel(client.sessionId);
    this.hideSpotSubscribers.delete(client.sessionId);
    this.sculptureDecoySystem.removeOwner(this.state, client.sessionId);
    this.state.players.delete(client.sessionId);
    this.updateHost();

    if (this.state.players.size === 0 || (this.state.phase === GAME_PHASE.waiting && this.state.players.size < 2)) {
      this.resetToWaiting();
      return;
    }

    if (
      this.state.phase === GAME_PHASE.playing &&
      this.state.escapedCount === 0 && !Array.from(this.state.players.values()).some(
        (player) => player.role === PLAYER_ROLE.zombie,
      )
    ) {
      const replacement = this.state.players.entries().next().value;
      if (replacement) {
        const [sessionId, player] = replacement;
        this.fossilHideSystem.exit(player);
        this.sculptureDecoySystem.removeOwner(this.state, sessionId);
        this.sculptureDecoySystem.resetPlayer(player);
        resetSportsSprint(player);
        player.role = PLAYER_ROLE.zombie;
        player.characterId = pickInitialZombieCharacter(Math.random());
        player.attackLockedUntil = 0;
        player.nextAttackAt = 0;
        player.lastBasicAttackAt = 0;
        player.stunnedUntil = 0;
        this.state.initialZombieSessionId = sessionId;
        this.setPlayerVisibleToOthers(sessionId, player, true);
      }
    }

    finishIfAllHumansInfected(this.state);
  }

  async onDispose(): Promise<void> {
    await this.presence.srem(INVITE_CODE_CHANNEL, this.roomId);
  }

  private simulate(context: StepContext): void {
    const now = Date.now();
    if (this.state.phase === GAME_PHASE.preparing && now >= this.state.roundStartsAt) {
      const participants = [...this.state.players.values()].filter(player => player.connected);
      if (participants.length < COMBAT_RULES.minimumPlayersToStart || !participants.some(player => player.role === PLAYER_ROLE.zombie)) {
        this.resetToWaiting();
        this.state.startError = "참가자 연결 상태를 확인한 뒤 다시 시작해 주세요.";
      } else {
        this.state.phase = GAME_PHASE.playing;
        this.matchTimerGateSystem.start(this.state, now);
      }
    }
    this.matchTimerGateSystem.update(this.state, now);
    if (this.state.phase === GAME_PHASE.finished && !this.finishedCleanupDone) {
      this.finishedCleanupDone = true;
      this.sculptureDecoySystem.clear(this.state);
      this.vomitSystem.clear(this.state);
      this.graduateTrackingSystem.clear();
      this.libraryBarrierSystem.clear(this.state);
      this.lateDashSystem.clear(this.state);
      this.engineeringTrapSystem.clear(this.state);
      this.computerRewindSystem.clear(this.state);
      this.professorAssignmentSystem.clear(this.state, this.sendAssignment);
    }
    this.professorAssignmentSystem.update(this.state, now, this.sendAssignment);
    this.libraryBarrierSystem.update(this.state, now);
    this.engineeringTrapSystem.update(this.state, now);

    this.state.players.forEach((player, sessionId) => {
      const inputChannel = this.inputs.get(sessionId);
      const input = inputChannel.next();
      const interactionPressed = input.interact && !this.interactionHeld.get(sessionId);
      const skillPressed = input.useSkill && !this.skillHeld.get(sessionId);
      this.interactionHeld.set(sessionId, input.interact);
      this.skillHeld.set(sessionId, input.useSkill);

      if (this.state.phase === GAME_PHASE.preparing) return;

      updateSportsSprint(player, now);
      updateXmanDisguise(player, now);
      updateConfusion(player, now);
      this.computerRewindSystem.record(this.state, sessionId, now);
      this.engineeringTrapSystem.checkPlayer(this.state, player, now);

      if (this.fossilHideSystem.update(player, now)) {
        this.setPlayerVisibleToOthers(sessionId, player, true);
      }

      if (this.state.phase === GAME_PHASE.finished || player.escaped) {
        return;
      }

      if (player.activity === PLAYER_ACTIVITY.hidden) {
        if (interactionPressed && this.fossilHideSystem.interact(player, now) === "exited") {
          this.setPlayerVisibleToOthers(sessionId, player, true);
        }
        return;
      }

      if (now < player.stunnedUntil) {
        this.vomitSystem.cancel(sessionId, player);
        this.lateDashSystem.cancel(sessionId, player);
        return;
      }

      if (player.stunnedUntil !== 0) {
        player.stunnedUntil = 0;
      }

      this.sculptureDecoySystem.recordMovement(sessionId, player, input, now);
      if (now < player.assignmentLockEndsAt) return;

      if (interactionPressed && !this.matchTimerGateSystem.nearbyOpenGate(this.state, player) && this.fossilHideSystem.interact(player, now) === "entered") {
        this.setPlayerVisibleToOthers(sessionId, player, false);
        this.sendHideSpotsToEligibleClients();
        return;
      }

      if (skillPressed) {
        tryActivateSportsSprint(player, now);
        this.sculptureDecoySystem.tryActivate(this.state, sessionId, now);
        this.vomitSystem.tryActivate(this.state, sessionId, now);
        this.graduateTrackingSystem.tryActivate(this.state, sessionId, now);
        this.lateDashSystem.tryActivate(this.state, sessionId, now);
        this.engineeringTrapSystem.tryActivate(this.state, sessionId, now);
        if (this.computerRewindSystem.tryActivate(this.state, sessionId, now)) this.humanDangerSystem.invalidate();
        tryActivateSocraticMethod(this.state, sessionId, now);
        this.professorAssignmentSystem.tryActivate(this.state, sessionId, now, this.sendAssignment);
        tryToggleXmanDisguise(this.state, sessionId, now);
        if (player.characterId === CHARACTER_IDS.libraryNpc && !this.libraryBarrierSystem.tryActivate(this.state, sessionId, now)) {
          this.clients.find(client => client.sessionId === sessionId)?.send(LIBRARY_PLACEMENT_FAILED_MESSAGE);
        }
      }

      const movementStart = { x: player.x, y: player.y };
      const movementInput = getConfusedMovement(player, input, now);
      const dashMoved = this.lateDashSystem.updatePlayer(this.state, sessionId, now, id => {
        this.sculptureDecoySystem.removeOwner(this.state, id);
        if (infectHuman(this.state, id, now)) finishIfAllHumansInfected(this.state);
      }, (id, attacker) => this.sculptureDecoySystem.hitDecoy(this.state, id, attacker, now));

      if (!dashMoved && !player.vomitCastEndsAt && (movementInput.moveX !== 0 || movementInput.moveY !== 0)) {
        const magnitude = Math.hypot(movementInput.moveX, movementInput.moveY);
        player.facingX = movementInput.moveX / magnitude;
        player.facingY = movementInput.moveY / magnitude;
      }

      if (!dashMoved) applyMovementWithBarriers(
        player,
        movementInput,
        now < player.rootedUntil || player.trapCastEndsAt > now ? 0 : PLAYER_SPEED * getPlayerSpeedMultiplier(player) * getPuddleSpeedMultiplier(this.state, player, now),
        context.dt,
        player.role, this.state.bookBarriers.values(), now, getGameMap(this.state.mapId),
      );
      this.engineeringTrapSystem.checkPlayer(this.state, player, now, dashMoved ? player : movementStart);
      if (this.matchTimerGateSystem.interact(this.state, sessionId, input.interact, now)) {
        this.fossilHideSystem.exit(player); this.sculptureDecoySystem.removeOwner(this.state, sessionId);
        this.engineeringTrapSystem.removeOwner(this.state, sessionId); this.setPlayerVisibleToOthers(sessionId, player, false); this.humanDangerSystem.invalidate();
      }

      if (interactionPressed && player.role === PLAYER_ROLE.zombie) {
        const target = resolveZombieAttack(this.state, sessionId, now);
        if (target?.type === "decoy") {
          this.sculptureDecoySystem.hitDecoy(this.state, target.id, player, now);
        } else if (target?.type === "human") {
          this.sculptureDecoySystem.removeOwner(this.state, target.id);
          if (infectHuman(this.state, target.id, now)) {
            finishIfAllHumansInfected(this.state);
          }
        }
      }
    });

    this.sculptureDecoySystem.update(this.state, now, context.dt);
    this.vomitSystem.update(this.state, now, context.dt, (id) => {
      this.sculptureDecoySystem.removeOwner(this.state, id);
      if (infectHuman(this.state, id, now)) finishIfAllHumansInfected(this.state);
    }, (id, owner) => this.sculptureDecoySystem.hitDecoy(this.state, id, owner, now));
    // Private messages only: tracking targets never enter shared room/player state.
    this.state.players.forEach((player, id) => {
      if (player.characterId === CHARACTER_IDS.graduateZombie) this.graduateTrackingSystem.view(this.state, id, now);
    });
    this.clients.forEach(client => {
      if (this.state.players.get(client.sessionId)?.characterId === CHARACTER_IDS.graduateZombie) {
        const view = this.graduateTrackingSystem.view(this.state, client.sessionId, now);
        if (view.cooldownEndsAt > 0) client.send(GRADUATE_TRACKING_MESSAGE, view);
      }
    });
    this.libraryBarrierSystem.update(this.state, now);
    if (this.state.phase === GAME_PHASE.finished) this.lateDashSystem.clear(this.state);
    if (this.state.phase === GAME_PHASE.finished) this.state.players.forEach(resetXmanDisguise);
    if (this.state.phase === GAME_PHASE.finished) this.state.players.forEach(resetPhilosophyState);
    this.engineeringTrapSystem.update(this.state, now);
    this.clients.forEach(client => this.syncTrapView(client));
    this.professorAssignmentSystem.update(this.state, now, this.sendAssignment);
    this.matchTimerGateSystem.update(this.state, now);
    this.humanDangerSystem.update(this.state, now, (id, update) => {
      if (this.dangerSubscribers.has(id)) this.clients.find(client => client.sessionId === id)?.send(DANGER_MESSAGES.update, update);
    });
  }

  private tryStartMatch(): void {
    const participants = [...this.state.players.entries()].filter(([, player]) => player.connected);
    if (
      this.state.phase !== GAME_PHASE.waiting ||
      participants.length < COMBAT_RULES.minimumPlayersToStart || participants.length > GAME_LIMITS.maxPlayersPerRoom
    ) {
      if (this.state.phase === GAME_PHASE.waiting) this.state.startError = "게임 시작에는 4~8명의 참가자가 필요합니다.";
      return;
    }

    let assignments: ReturnType<typeof assignCharacters>;
    try {
      assignments = assignCharacters(participants.map(([id]) => id));
      this.fossilHideSystem.prepareForMatch();
      this.state.mapConfigError = "";
      this.state.startError = "";
    } catch (error) {
      this.state.startError = error instanceof Error ? error.message : "캐릭터 배정 또는 맵 설정을 확인해 주세요.";
      return;
    }

    const sessionId = [...assignments.entries()].find(([, character]) => SPECIAL_ZOMBIE_CHARACTER_IDS.includes(character as typeof SPECIAL_ZOMBIE_CHARACTER_IDS[number]))![0];
    const player = this.state.players.get(sessionId)!;
    this.sculptureDecoySystem.clear(this.state);
    this.vomitSystem.clear(this.state);
    this.graduateTrackingSystem.clear();
    this.libraryBarrierSystem.clear(this.state);
    this.lateDashSystem.clear(this.state);
    this.engineeringTrapSystem.clear(this.state);
    this.computerRewindSystem.clear(this.state);
    this.professorAssignmentSystem.clear(this.state, this.sendAssignment);
    let spawnIndex = 0;
    this.state.players.forEach((candidate, candidateSessionId) => {
      const spawn = getGameMap(this.state.mapId).spawns[spawnIndex++ % getGameMap(this.state.mapId).spawns.length]!;
      candidate.x = spawn.x; candidate.y = spawn.y;
      resetSportsSprint(candidate);
      resetPhilosophyState(candidate);
      resetXmanDisguise(candidate);
      this.fossilHideSystem.resetPlayer(candidate);
      this.sculptureDecoySystem.resetPlayer(candidate);
      candidate.role =
        candidateSessionId === sessionId ? PLAYER_ROLE.zombie : PLAYER_ROLE.human;
      candidate.characterId = assignments.get(candidateSessionId) ?? CHARACTER_IDS.normalHuman;
      candidate.attackLockedUntil = 0; candidate.nextAttackAt = 0; candidate.lastBasicAttackAt = 0; candidate.stunnedUntil = 0;
    });
    player.role = PLAYER_ROLE.zombie;
    player.attackLockedUntil = 0;
    player.nextAttackAt = 0;
    player.lastBasicAttackAt = 0;
    this.state.initialZombieSessionId = sessionId;
    this.state.winner = MATCH_WINNER.none;
    this.state.phase = GAME_PHASE.preparing;
    this.state.roundStartsAt = Date.now() + ROUND_START_RULES.briefingMs + ROUND_START_RULES.countdownMs;
    this.finishedCleanupDone = false;
    this.state.roundResults.clear();
    this.state.players.forEach((p, id) => {
      const result = new RoundResultState(); result.nickname = p.nickname; result.startedAsHuman = p.role === PLAYER_ROLE.human; this.state.roundResults.set(id, result);
    });
    this.state.matchParticipantCount = participants.length;
    this.state.players.forEach((_candidate, id) => this.computerRewindSystem.record(this.state, id, Date.now()));
  }

  private resetToWaiting(): void {
    this.matchTimerGateSystem.reset(this.state); this.matchTimerGateSystem.initializeGates(this.state); this.state.roundResults.clear();
    this.state.phase = GAME_PHASE.waiting;
    this.state.winner = MATCH_WINNER.none;
    this.state.initialZombieSessionId = "";
    this.state.mapConfigError = "";
    this.state.startError = "";
    this.state.matchStartedAt = 0;
    this.state.roundStartsAt = 0;
    this.state.matchParticipantCount = 0;
    this.fossilHideSystem.clear();
    this.professorAssignmentSystem.clear(this.state, this.sendAssignment);
    this.computerRewindSystem.clear(this.state);
    this.engineeringTrapSystem.clear(this.state);
    this.lateDashSystem.clear(this.state);
    this.libraryBarrierSystem.clear(this.state);
    this.graduateTrackingSystem.clear();
    this.vomitSystem.clear(this.state);
    this.sculptureDecoySystem.clear(this.state);
    this.state.players.forEach((player) => {
      this.fossilHideSystem.resetPlayer(player);
      resetSportsSprint(player);
      resetPhilosophyState(player);
      resetXmanDisguise(player);
      this.sculptureDecoySystem.resetPlayer(player);
      player.role = PLAYER_ROLE.human;
      player.characterId = UNASSIGNED_CHARACTER_ID;
      player.attackLockedUntil = 0;
      player.nextAttackAt = 0;
      player.lastBasicAttackAt = 0;
      player.stunnedUntil = 0;
    });
    this.state.players.forEach((player, sessionId) => {
      this.setPlayerVisibleToOthers(sessionId, player, true);
    });
  }

  private addPlayerToClientViews(joiningClient: Client, joiningPlayer: PlayerState): void {
    this.clients.forEach((client) => {
      if (client.sessionId === joiningClient.sessionId) {
        this.syncClientView(client);
      } else if (client.view) {
        client.view.add(joiningPlayer);
      } else {
        this.syncClientView(client);
      }
    });

    if (!joiningClient.view) {
      this.syncClientView(joiningClient);
    }
  }

  private updateHost(): void {
    this.state.hostSessionId = [...this.state.players.entries()].find(([, p]) => p.connected)?.[0] ?? "";
  }

  private syncClientView(client: Client): void {
    client.view?.dispose();
    client.view = new StateView();
    this.state.players.forEach((player, sessionId) => {
      if ((!player.escaped && player.activity !== PLAYER_ACTIVITY.hidden) || sessionId === client.sessionId) {
        client.view?.add(player);
      }
    });
    this.syncTrapView(client);
  }

  private syncTrapView(client: Client): void {
    const viewer = this.state.players.get(client.sessionId);
    if (!viewer || !client.view) return;
    const next = new Set<EngineeringTrapState>();
    this.state.engineeringTraps.forEach(trap => {
      if (canSeeEngineeringTrap(viewer, trap, getGameMap(this.state.mapId).tileSize)) { client.view?.add(trap); next.add(trap); }
    });
    for (const trap of this.visibleTraps.get(client.sessionId) ?? []) {
      if (!next.has(trap)) client.view.remove(trap);
    }
    this.visibleTraps.set(client.sessionId, next);
  }

  private setPlayerVisibleToOthers(
    sessionId: string,
    player: PlayerState,
    visible: boolean,
  ): void {
    this.clients.forEach((client) => {
      if (!client.view) {
        this.syncClientView(client);
        return;
      }
      if (client.sessionId === sessionId || visible) {
        client.view.add(player);
      } else {
        client.view.remove(player);
      }
    });
  }

  private sendHideSpots(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (
      player?.characterId === CHARACTER_IDS.fossil &&
      player.role === PLAYER_ROLE.human
    ) {
      client.send(FOSSIL_MESSAGES.hideSpots, this.fossilHideSystem.getAvailableSpotViews());
    } else {
      client.send(FOSSIL_MESSAGES.hideSpots, []);
    }
  }

  private sendHideSpotsToEligibleClients(): void {
    this.clients.forEach((client) => {
      if (this.hideSpotSubscribers.has(client.sessionId)) {
        this.sendHideSpots(client);
      }
    });
  }

  private async generateRoomCode(): Promise<string> {
    const existingCodes = await this.presence.smembers(INVITE_CODE_CHANNEL);
    let code = generateRoomCodeCandidate();

    while (existingCodes.includes(code)) {
      code = generateRoomCodeCandidate();
    }

    await this.presence.sadd(INVITE_CODE_CHANNEL, code);
    return code;
  }
}

