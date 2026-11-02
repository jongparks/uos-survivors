import { Room } from "colyseus";

import { GAME_LIMITS } from "@uos-survivors/shared";

export class BootstrapRoom extends Room {
  maxClients = GAME_LIMITS.maxPlayersPerRoom;
}

