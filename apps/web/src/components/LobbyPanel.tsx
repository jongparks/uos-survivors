import { GAME_LIMITS } from "@uos-survivors/shared";
import { useState, type FormEvent } from "react";

interface LobbyPanelProps {
  connecting: boolean;
  error: string | null;
  onCreateRoom: (nickname: string) => Promise<void>;
  onJoinRoom: (roomCode: string, nickname: string) => Promise<void>;
}

export function LobbyPanel({
  connecting,
  error,
  onCreateRoom,
  onJoinRoom,
}: LobbyPanelProps) {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
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
      await onCreateRoom(normalizedNickname);
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
        <p>방을 만들거나 친구에게 받은 초대 코드로 같은 캠퍼스에 입장합니다.</p>
      </div>

      <form className="lobby-form" onSubmit={handleCreate}>
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

        <button className="primary-button" disabled={connecting} type="submit">
          {connecting ? "서버 연결 중…" : "새 방 만들기"}
        </button>

        {validationError || error ? (
          <p className="form-error" role="alert">
            {validationError ?? error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

