import "dotenv/config";

import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME_SERVER, ROOM_NAMES } from "@uos-survivors/shared";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "./rooms/GameRoom.js";

const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : GAME_SERVER.port;

const server = defineServer({
  rooms: {
    [ROOM_NAMES.game]: defineRoom(GameRoom),
  },
  transport: new WebSocketTransport(),
  express: (app) => {
    app.get("/health", (_request, response) => {
      response.json({
        service: "uos-survivors-server",
        status: "ok",
      });
    });
  },
});

server
  .listen(port)
  .then(() => {
    console.log(`UOS Survivors server listening on http://localhost:${port}`);
  })
  .catch((error: unknown) => {
    console.error("Failed to start UOS Survivors server", error);
    process.exitCode = 1;
  });

