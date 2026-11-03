import type { Client, StepContext } from "colyseus";
import { Room } from "colyseus";
import { StateView } from "@colyseus/schema";

import {
  CHARACTER_IDS,
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
  PLAYER_SPAWNS,
  PLAYER_ACTIVITY,
  PlayerState,
  PLAYER_ROLE,
  RECONNECTION,
  ROOM_VISIBILITY,
  UNASSIGNED_CHARACTER_ID,
  applyMovementWithBarriers,
  LIBRARY_PLACEMENT_FAILED_MESSAGE,
  pickRandomHumanCharacter,
  pickInitialZombieCharacter,
  tileToWorld,
  getPuddleSpeedMultiplier,
  type RoomVisibility,
} from "@uos-survivors/shared";

import { generateRoomCodeCandidate, normalizeNickname } from "../config/playerIdentity.js";
import { CURRENT_MAP_HIDE_SPOT_CANDIDATES } from "../maps/hideSpotRegistry.js";
import { resolveZombieAttack } from "../systems/combatSystem.js";
import { FossilHideSystem } from "../systems/fossilHideSystem.js";
import { finishIfAllHumansInfected, infectHuman } from "../systems/infectionSystem.js";
import { SculptureDecoySystem } from "../systems/sculptureDecoySystem.js";
import { VomitSystem } from "../systems/vomitSystem.js";
import { GraduateTrackingSystem } from "../systems/graduateTrackingSystem.js";
import { LibraryBarrierSystem } from "../systems/libraryBarrierSystem.js";
import { LateDashSystem } from "../systems/lateDashSystem.js";
import { resetXmanDisguise, updateXmanDisguise, tryToggleXmanDisguise } from "../systems/xmanDisguiseSystem.js";
import {
  getPlayerSpeedMultiplier,
  resetSportsSprint,
  tryActivateSportsSprint,
  updateSportsSprint,
} from "../systems/sportsSprintSystem.js";

const INVITE_CODE_CHANNEL = "$uos-survivors-room-codes";

interface RoomOptions {
  nickname?: unknown;
  visibility?: RoomVisibility;
}

export class GameRoom extends Room<{ state: GameState; input: MovementInput }> {
  state = new GameState();
  maxClients = GAME_LIMITS.maxPlayersPerRoom;
  patchRate = 1000 / NETWORK_RATE.stateSyncHz;
  maxMessagesPerSecond = 60;
  private readonly fossilHideSystem = new FossilHideSystem(CURRENT_MAP_HIDE_SPOT_CANDIDATES);
  private readonly sculptureDecoySystem = new SculptureDecoySystem();
  private readonly vomitSystem = new VomitSystem();
  private readonly graduateTrackingSystem = new GraduateTrackingSystem();
  private readonly libraryBarrierSystem = new LibraryBarrierSystem();
  private readonly lateDashSystem = new LateDashSystem();
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
    this.roomId = await this.generateRoomCode();
    this.state.roomCode = this.roomId;
    this.state.isPrivate = options.visibility === ROOM_VISIBILITY.private;
    await this.setPrivate(this.state.isPrivate);
    this.onMessage(FOSSIL_MESSAGES.requestHideSpots, (client) => {
      this.hideSpotSubscribers.add(client.sessionId);
      this.sendHideSpots(client);
    });
    this.setFixedTimestep((context) => this.simulate(context), NETWORK_RATE.simulationHz);
  }

  onJoin(client: Client, options: RoomOptions): void {
    const player = new PlayerState();
    const spawn = PLAYER_SPAWNS[this.state.players.size % PLAYER_SPAWNS.length] ?? PLAYER_SPAWNS[0];

    player.nickname = normalizeNickname(options.nickname) ?? `생존자${this.state.players.size + 1}`;
    player.connected = true;
    player.role = PLAYER_ROLE.human;
    if (this.state.phase === GAME_PHASE.playing) {
      player.characterId = pickRandomHumanCharacter(Math.random());
    }
    player.x = tileToWorld(spawn.tileX);
    player.y = tileToWorld(spawn.tileY);
    this.state.players.set(client.sessionId, player);
    this.addPlayerToClientViews(client, player);
    this.tryStartMatch();
  }

  onDrop(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = false;
    }

    this.allowReconnection(client, RECONNECTION.windowSeconds);
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = true;
    }

    this.syncClientView(client);
  }

  onLeave(client: Client): void {
    client.view?.dispose();
    this.interactionHeld.delete(client.sessionId);
    this.skillHeld.delete(client.sessionId);
    this.vomitSystem.cancel(client.sessionId);
    this.graduateTrackingSystem.remove(client.sessionId);
    this.lateDashSystem.cancel(client.sessionId);
    this.hideSpotSubscribers.delete(client.sessionId);
    this.sculptureDecoySystem.removeOwner(this.state, client.sessionId);
    this.state.players.delete(client.sessionId);

    if (this.state.players.size < COMBAT_RULES.minimumPlayersToStart) {
      this.resetToWaiting();
      return;
    }

    if (
      this.state.phase === GAME_PHASE.playing &&
      !Array.from(this.state.players.values()).some(
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
    this.libraryBarrierSystem.update(this.state, now);

    this.state.players.forEach((player, sessionId) => {
      const inputChannel = this.inputs.get(sessionId);
      const input = inputChannel.next();
      const interactionPressed = input.interact && !this.interactionHeld.get(sessionId);
      const skillPressed = input.useSkill && !this.skillHeld.get(sessionId);
      this.interactionHeld.set(sessionId, input.interact);
      this.skillHeld.set(sessionId, input.useSkill);

      updateSportsSprint(player, now);
      updateXmanDisguise(player, now);

      if (this.fossilHideSystem.update(player, now)) {
        this.setPlayerVisibleToOthers(sessionId, player, true);
      }

      if (this.state.phase === GAME_PHASE.finished) {
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

      if (interactionPressed && this.fossilHideSystem.interact(player, now) === "entered") {
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
        tryToggleXmanDisguise(this.state, sessionId, now);
        if (player.characterId === CHARACTER_IDS.libraryNpc && !this.libraryBarrierSystem.tryActivate(this.state, sessionId, now)) {
          this.clients.find(client => client.sessionId === sessionId)?.send(LIBRARY_PLACEMENT_FAILED_MESSAGE);
        }
      }

      const dashMoved = this.lateDashSystem.updatePlayer(this.state, sessionId, now, id => {
        this.sculptureDecoySystem.removeOwner(this.state, id);
        if (infectHuman(this.state, id, now)) finishIfAllHumansInfected(this.state);
      }, (id, attacker) => this.sculptureDecoySystem.hitDecoy(this.state, id, attacker, now));

      if (!dashMoved && !player.vomitCastEndsAt && (input.moveX !== 0 || input.moveY !== 0)) {
        const magnitude = Math.hypot(input.moveX, input.moveY);
        player.facingX = input.moveX / magnitude;
        player.facingY = input.moveY / magnitude;
      }

      if (!dashMoved) applyMovementWithBarriers(
        player,
        input,
        PLAYER_SPEED * getPlayerSpeedMultiplier(player) * getPuddleSpeedMultiplier(this.state, player, now),
        context.dt,
        player.role, this.state.bookBarriers.values(), now,
      );

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
  }

  private tryStartMatch(): void {
    if (
      this.state.phase !== GAME_PHASE.waiting ||
      this.state.players.size < COMBAT_RULES.minimumPlayersToStart
    ) {
      return;
    }

    const initialZombie = this.state.players.entries().next().value;
    if (!initialZombie) {
      return;
    }

    try {
      this.fossilHideSystem.prepareForMatch();
      this.state.mapConfigError = "";
    } catch (error) {
      this.state.mapConfigError = error instanceof Error ? error.message : "Invalid map hide spot configuration";
      return;
    }

    const [sessionId, player] = initialZombie;
    this.sculptureDecoySystem.clear(this.state);
    this.vomitSystem.clear(this.state);
    this.graduateTrackingSystem.clear();
    this.libraryBarrierSystem.clear(this.state);
    this.lateDashSystem.clear(this.state);
    this.state.players.forEach((candidate, candidateSessionId) => {
      resetSportsSprint(candidate);
      resetXmanDisguise(candidate);
      this.fossilHideSystem.resetPlayer(candidate);
      this.sculptureDecoySystem.resetPlayer(candidate);
      candidate.role =
        candidateSessionId === sessionId ? PLAYER_ROLE.zombie : PLAYER_ROLE.human;
      candidate.characterId =
        candidateSessionId === sessionId
          ? pickInitialZombieCharacter(Math.random())
          : pickRandomHumanCharacter(Math.random());
    });
    player.role = PLAYER_ROLE.zombie;
    player.attackLockedUntil = 0;
    player.nextAttackAt = 0;
    player.lastBasicAttackAt = 0;
    this.state.initialZombieSessionId = sessionId;
    this.state.winner = MATCH_WINNER.none;
    this.state.phase = GAME_PHASE.playing;
  }

  private resetToWaiting(): void {
    this.state.phase = GAME_PHASE.waiting;
    this.state.winner = MATCH_WINNER.none;
    this.state.initialZombieSessionId = "";
    this.state.mapConfigError = "";
    this.fossilHideSystem.clear();
    this.lateDashSystem.clear(this.state);
    this.libraryBarrierSystem.clear(this.state);
    this.graduateTrackingSystem.clear();
    this.vomitSystem.clear(this.state);
    this.sculptureDecoySystem.clear(this.state);
    this.state.players.forEach((player) => {
      this.fossilHideSystem.resetPlayer(player);
      resetSportsSprint(player);
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

  private syncClientView(client: Client): void {
    client.view?.dispose();
    client.view = new StateView();
    this.state.players.forEach((player, sessionId) => {
      if (player.activity !== PLAYER_ACTIVITY.hidden || sessionId === client.sessionId) {
        client.view?.add(player);
      }
    });
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

