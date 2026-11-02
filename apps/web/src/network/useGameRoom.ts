import { Callbacks, Client, type Room } from "@colyseus/sdk";
import {
  GAME_SERVER,
  ROOM_NAMES,
  type ConnectionState,
  type GameState,
} from "@uos-survivors/shared";
import { useCallback, useMemo, useRef, useState } from "react";

export type ConnectedGameRoom = Room<GameState>;

interface GameRoomConnection {
  endpoint: string;
  state: ConnectionState;
  room: ConnectedGameRoom | null;
  playerCount: number;
  error: string | null;
  createRoom: (nickname: string) => Promise<void>;
  joinRoom: (roomCode: string, nickname: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
}

function formatConnectionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "게임 서버 연결에 실패했습니다.";
}

export function useGameRoom(): GameRoomConnection {
  const endpoint = import.meta.env.VITE_GAME_SERVER_URL ?? GAME_SERVER.defaultUrl;
  const client = useMemo(() => new Client(endpoint), [endpoint]);
  const [state, setState] = useState<ConnectionState>("idle");
  const [room, setRoom] = useState<ConnectedGameRoom | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<ConnectedGameRoom | null>(null);
  const callbackDisposersRef = useRef<Array<() => void>>([]);

  const clearCallbacks = useCallback(() => {
    callbackDisposersRef.current.forEach((dispose) => dispose());
    callbackDisposersRef.current = [];
  }, []);

  const attachRoom = useCallback(
    (nextRoom: ConnectedGameRoom) => {
      clearCallbacks();
      roomRef.current = nextRoom;
      setRoom(nextRoom);
      setState("connected");
      setError(null);

      const callbacks = Callbacks.get(nextRoom);
      const updatePlayerCount = () => setPlayerCount(nextRoom.state.players?.size ?? 0);
      callbackDisposersRef.current = [
        callbacks.onAdd("players", updatePlayerCount),
        callbacks.onRemove("players", updatePlayerCount),
      ];
      updatePlayerCount();

      nextRoom.onLeave(() => {
        if (roomRef.current !== nextRoom) {
          return;
        }

        clearCallbacks();
        roomRef.current = null;
        setRoom(null);
        setPlayerCount(0);
        setState("disconnected");
      });
    },
    [clearCallbacks],
  );

  const connect = useCallback(
    async (connection: () => Promise<ConnectedGameRoom>) => {
      setState("connecting");
      setError(null);

      try {
        attachRoom(await connection());
      } catch (connectionError) {
        setState("error");
        setError(formatConnectionError(connectionError));
      }
    },
    [attachRoom],
  );

  const createRoom = useCallback(
    async (nickname: string) => {
      await connect(() => client.create<GameState>(ROOM_NAMES.game, { nickname }));
    },
    [client, connect],
  );

  const joinRoom = useCallback(
    async (roomCode: string, nickname: string) => {
      await connect(() =>
        client.joinById<GameState>(roomCode.trim().toUpperCase(), { nickname }),
      );
    },
    [client, connect],
  );

  const leaveRoom = useCallback(async () => {
    const activeRoom = roomRef.current;
    roomRef.current = null;
    clearCallbacks();
    setRoom(null);
    setPlayerCount(0);
    setState("idle");
    setError(null);

    if (activeRoom) {
      await activeRoom.leave();
    }
  }, [clearCallbacks]);

  return {
    endpoint,
    state,
    room,
    playerCount,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
  };
}

