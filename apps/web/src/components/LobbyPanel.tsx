import {
  GAME_LIMITS,
  GAME_MAPS,
  DEFAULT_MAP_ID,
  ROOM_VISIBILITY,
  type RoomVisibility,
} from "@uos-survivors/shared";
import { useState, type FormEvent } from "react";

interface LobbyPanelProps {
  connecting: boolean;
  error: string | null;
  onCreateRoom: (nickname: string, visibility: RoomVisibility, mapId?: string) => Promise<void>;
  onJoinRoom: (roomCode: string, nickname: string) => Promise<void>;
  onQuickJoin: (nickname: string, mapId?: string) => Promise<void>;
}

export function LobbyPanel({
  connecting,
  error,
  onCreateRoom,
  onJoinRoom,
  onQuickJoin,
}: LobbyPanelProps) {
  const [nickname, setNickname] = useState("");
  const [mapId, setMapId] = useState(DEFAULT_MAP_ID);
  const [roomCode, setRoomCode] = useState("");
  const [visibility, setVisibility] = useState<RoomVisibility>(ROOM_VISIBILITY.public);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateNickname = (): string | null => {
    const normalized = nickname.trim().replace(/\s+/g, " ");
    const length = [...normalized].length;

    if (
      length < GAME_LIMITS.nicknameMinLength ||
      length > GAME_LIMITS.nicknameMaxLength
    ) {
      setValidationError(
        `닉네임은 ${GAME_LIMITS.nicknameMinLength}~${GAME_LIMITS.nicknameMaxLength}자로 입력해 주세요.`,
      );
      return null;
    }

    setValidationError(null);
    return normalized;
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedNickname = validateNickname();

    if (normalizedNickname) {
      await onCreateRoom(normalizedNickname, visibility, mapId);
    }
  };

  const handleQuickJoin = async () => {
    const normalizedNickname = validateNickname();

    if (normalizedNickname) {
      await onQuickJoin(normalizedNickname, mapId);
    }
  };

  const handleJoin = async () => {
    const normalizedNickname = validateNickname();
    const normalizedCode = roomCode.trim().toUpperCase();

    if (!normalizedNickname) {
      return;
    }

    if (!new RegExp(`^[A-Z2-9]{${GAME_LIMITS.roomCodeLength}}$`).test(normalizedCode)) {
      setValidationError(`${GAME_LIMITS.roomCodeLength}자리 초대 코드를 확인해 주세요.`);
      return;
    }

    await onJoinRoom(normalizedCode, normalizedNickname);
  };

  return (
    <section className="lobby-panel" aria-labelledby="lobby-title">
      <div className="lobby-copy">
        <p className="panel-kicker">MULTIPLAYER TEST LOBBY</p>
        <h2 id="lobby-title">생존 기록을 시작하세요</h2>
        <p>공개방에 빠르게 합류하거나 비공개방을 만들어 초대 코드로 친구를 부르세요.</p>
      </div>

      <form className="lobby-form" onSubmit={handleCreate}>
        <label><span>맵</span><select value={mapId} onChange={event => setMapId(event.target.value)} disabled={connecting}>
          {Object.values(GAME_MAPS).map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
        </select></label>
        <label>
          <span>닉네임</span>
          <input
            autoComplete="nickname"
            maxLength={GAME_LIMITS.nicknameMaxLength}
            minLength={GAME_LIMITS.nicknameMinLength}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="예: 청량리생존자"
            value={nickname}
          />
        </label>

        <fieldset className="visibility-picker">
          <legend>방 공개 설정</legend>
          <button
            aria-pressed={visibility === ROOM_VISIBILITY.public}
            onClick={() => setVisibility(ROOM_VISIBILITY.public)}
            type="button"
          >
            <strong>공개방</strong>
            <small>빠른 참여로 입장 가능</small>
          </button>
          <button
            aria-pressed={visibility === ROOM_VISIBILITY.private}
            onClick={() => setVisibility(ROOM_VISIBILITY.private)}
            type="button"
          >
            <strong>비공개방</strong>
            <small>초대 코드로만 입장</small>
          </button>
        </fieldset>

        <div className="room-code-row">
          <label>
            <span>초대 코드</span>
            <input
              autoCapitalize="characters"
              maxLength={GAME_LIMITS.roomCodeLength}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="ABC234"
              value={roomCode}
            />
          </label>
          <button disabled={connecting} onClick={() => void handleJoin()} type="button">
            코드로 입장
          </button>
        </div>

        <div className="lobby-actions">
          <button
            className="primary-button"
            disabled={connecting}
            onClick={() => void handleQuickJoin()}
            type="button"
          >
            {connecting ? "서버 연결 중…" : "빠른 참여"}
          </button>
          <button className="create-button" disabled={connecting} type="submit">
            {visibility === ROOM_VISIBILITY.private ? "비공개 방 만들기" : "공개 방 만들기"}
          </button>
        </div>

        {validationError || error ? (
          <p className="form-error" role="alert">
            {validationError ?? error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

