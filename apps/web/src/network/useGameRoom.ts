import { Callbacks, Client, type Room } from "@colyseus/sdk";
import {
  GAME_SERVER,
  DEFAULT_MAP_ID,
  RECONNECTION,
  ROOM_NAMES,
  ROOM_VISIBILITY,
  type ConnectionState,
  type GameState,
  type RoomVisibility,
} from "@uos-survivors/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ConnectedGameRoom = Room<GameState>;

const RECONNECTION_STORAGE_PREFIX = "uos-survivors:reconnection:";

interface GameRoomConnection {
  endpoint: string;
  state: ConnectionState;
  room: ConnectedGameRoom | null;
  playerCount: number;
  isPrivate: boolean;
  error: string | null;
  createRoom: (nickname: string, visibility: RoomVisibility, mapId?: string) => Promise<void>;
  quickJoin: (nickname: string, mapId?: string) => Promise<void>;
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
  const reconnectionStorageKey = `${RECONNECTION_STORAGE_PREFIX}${endpoint}`;
  const client = useMemo(() => new Client(endpoint), [endpoint]);
  const [state, setState] = useState<ConnectionState>("idle");
  const [room, setRoom] = useState<ConnectedGameRoom | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<ConnectedGameRoom | null>(null);
  const callbackDisposersRef = useRef<Array<() => void>>([]);
  const resumeAttemptedRef = useRef(false);

  const clearCallbacks = useCallback(() => {
    callbackDisposersRef.current.forEach((dispose) => dispose());
    callbackDisposersRef.current = [];
  }, []);

  const attachRoom = useCallback(
    (nextRoom: ConnectedGameRoom) => {
      clearCallbacks();
      roomRef.current = nextRoom;
      nextRoom.reconnection.maxRetries = RECONNECTION.maxRetries;
      nextRoom.reconnection.minUptime = RECONNECTION.minUptimeMs;
      nextRoom.reconnection.maxDelay = RECONNECTION.maxDelayMs;
      sessionStorage.setItem(reconnectionStorageKey, nextRoom.reconnectionToken);
      setRoom(nextRoom);
      setState("connected");
      setError(null);

      const callbacks = Callbacks.get(nextRoom);
      const updatePlayerCount = () => setPlayerCount(nextRoom.state.players?.size ?? 0);
      const updatePrivacy = () => setIsPrivate(nextRoom.state.isPrivate ?? false);
      callbackDisposersRef.current = [
        callbacks.onAdd("players", updatePlayerCount),
        callbacks.onRemove("players", updatePlayerCount),
        callbacks.onChange(nextRoom.state, updatePrivacy),
      ];
      updatePlayerCount();
      updatePrivacy();

      nextRoom.onDrop(() => {
        if (roomRef.current === nextRoom) {
          setState("reconnecting");
        }
      });

      nextRoom.onReconnect(() => {
        if (roomRef.current !== nextRoom) {
          return;
        }

        sessionStorage.setItem(reconnectionStorageKey, nextRoom.reconnectionToken);
        setState("connected");
        setError(null);
      });

      nextRoom.onLeave(() => {
        if (roomRef.current !== nextRoom) {
          return;
        }

        clearCallbacks();
        sessionStorage.removeItem(reconnectionStorageKey);
        roomRef.current = null;
        setRoom(null);
        setPlayerCount(0);
        setIsPrivate(false);
        setState("disconnected");
      });
    },
    [clearCallbacks, reconnectionStorageKey],
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
    async (nickname: string, visibility: RoomVisibility, mapId = DEFAULT_MAP_ID) => {
      await connect(() =>
        client.create<GameState>(ROOM_NAMES.game, { nickname, visibility, mapId }),
      );
    },
    [client, connect],
  );

  const quickJoin = useCallback(
    async (nickname: string, mapId = DEFAULT_MAP_ID) => {
      await connect(() =>
        client.joinOrCreate<GameState>(ROOM_NAMES.game, {
          nickname,
          mapId,
          visibility: ROOM_VISIBILITY.public,
        }),
      );
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

  useEffect(() => {
    if (resumeAttemptedRef.current) {
      return;
    }

    resumeAttemptedRef.current = true;
    const reconnectionToken = sessionStorage.getItem(reconnectionStorageKey);

    if (!reconnectionToken) {
      return;
    }

    setState("connecting");
    void client
      .reconnect<GameState>(reconnectionToken)
      .then(attachRoom)
      .catch(() => {
        sessionStorage.removeItem(reconnectionStorageKey);
        setState("idle");
        setError("이전 게임 세션이 만료되었습니다. 다시 방에 입장해 주세요.");
      });
  }, [attachRoom, client, reconnectionStorageKey]);

  const leaveRoom = useCallback(async () => {
    const activeRoom = roomRef.current;
    roomRef.current = null;
    clearCallbacks();
    setRoom(null);
    setPlayerCount(0);
    setIsPrivate(false);
    setState("idle");
    setError(null);
    sessionStorage.removeItem(reconnectionStorageKey);

    if (activeRoom) {
      await activeRoom.leave();
    }
  }, [clearCallbacks, reconnectionStorageKey]);

  return {
    endpoint,
    state,
    room,
    playerCount,
    isPrivate,
    error,
    createRoom,
    quickJoin,
    joinRoom,
    leaveRoom,
  };
}

