import { Client, type Room } from "@colyseus/sdk";
import {
  GAME_SERVER,
  ROOM_NAMES,
  type ConnectionState,
  type WelcomeMessage,
} from "@uos-survivors/shared";
import { useEffect, useState } from "react";

interface ServerConnection {
  state: ConnectionState;
  endpoint: string;
  details: WelcomeMessage | null;
  error: string | null;
}

export function useServerConnection(): ServerConnection {
  const endpoint = import.meta.env.VITE_GAME_SERVER_URL ?? GAME_SERVER.defaultUrl;
  const [state, setState] = useState<ConnectionState>("connecting");
  const [details, setDetails] = useState<WelcomeMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let room: Room | null = null;

    const connect = async () => {
      try {
        const client = new Client(endpoint);
        room = await client.joinOrCreate(ROOM_NAMES.bootstrap);

        room.onLeave(() => {
          if (active) {
            setState("disconnected");
          }
        });

        if (active) {
          setDetails({ roomId: room.roomId, sessionId: room.sessionId });
          setState("connected");
        }
      } catch (connectionError) {
        if (active) {
          setState("error");
          setError(
            connectionError instanceof Error
              ? connectionError.message
              : "Unknown connection error",
          );
        }
      }
    };

    void connect();

    return () => {
      active = false;
      if (room) {
        void room.leave();
      }
    };
  }, [endpoint]);

  return { state, endpoint, details, error };
}

