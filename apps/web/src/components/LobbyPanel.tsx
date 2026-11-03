import {
  GAME_LIMITS,
  GAME_MAPS,
  DEFAULT_MAP_ID,
  ROOM_VISIBILITY,
  type RoomVisibility,
} from "@uos-survivors/shared";
import { useRef, useState, type FormEvent } from "react";

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
  const nicknameInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
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
      nicknameInput.current?.focus();
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
      codeInput.current?.focus();
      return;
    }

    await onJoinRoom(normalizedCode, normalizedNickname);
  };

  return (
    <section className="card" aria-labelledby="card-title">
      <div className="card-head">
        <div>
          <h2 id="card-title">생존자 등록증</h2>
          <p>SURVIVOR REGISTRATION · No. 2026-UOS</p>
        </div>
        <div className="stamp" aria-hidden="true">감염<br />미확인<span>UOS 보건실</span></div>
      </div>
      <form onSubmit={handleCreate} noValidate aria-busy={connecting}>
        <div className="field">
          <label className="lbl" htmlFor="map">맵</label>
          <div className="select-wrap">
            <select id="map" value={mapId} onChange={event => setMapId(event.target.value)} disabled={connecting}>
              {Object.values(GAME_MAPS).map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
              <option disabled>정보기술관 내부 (준비 중)</option>
            </select>
            <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true"><path d="M2 2 L8 8 L14 2" fill="none" stroke="#1B1A17" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </div>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="nick">닉네임</label>
          <input id="nick" ref={nicknameInput} type="text" autoComplete="nickname"
            maxLength={GAME_LIMITS.nicknameMaxLength} minLength={GAME_LIMITS.nicknameMinLength}
            disabled={connecting} onChange={event => setNickname(event.target.value)}
            placeholder="예: 청량리생존자" value={nickname} />
        </div>
        <fieldset className="mode" disabled={connecting}>
          <legend className="lbl">방 공개 설정</legend>
          <label className="opt"><input type="radio" name="visibility" value={ROOM_VISIBILITY.public}
            checked={visibility === ROOM_VISIBILITY.public} onChange={() => setVisibility(ROOM_VISIBILITY.public)} />
            <b>공개방</b><small>빠른 참여로 입장 가능</small></label>
          <label className="opt"><input type="radio" name="visibility" value={ROOM_VISIBILITY.private}
            checked={visibility === ROOM_VISIBILITY.private} onChange={() => setVisibility(ROOM_VISIBILITY.private)} />
            <b>비공개방</b><small>초대 코드로만 입장</small></label>
        </fieldset>
        <div className="field">
          <label className="lbl" htmlFor="code">초대 코드</label>
          <div className="code-row">
            <input id="code" ref={codeInput} type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false}
              maxLength={GAME_LIMITS.roomCodeLength} disabled={connecting}
              onChange={event => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ABC234" value={roomCode} />
            <button className="btn-ink" disabled={connecting} onClick={() => void handleJoin()} type="button">코드로 입장</button>
          </div>
        </div>
        <p className="msg" role="alert">{validationError ?? error ?? ""}</p>
        <div className="actions">
          <button className="btn-main" disabled={connecting} onClick={() => void handleQuickJoin()} type="button">
            {connecting ? "서버 연결 중…" : "빠른 참여"}
          </button>
          <button className="btn-line" disabled={connecting} type="submit">
            {visibility === ROOM_VISIBILITY.private ? "비공개 방 만들기" : "공개 방 만들기"}
          </button>
        </div>
      </form>
      <svg className="print" width="70" height="86" viewBox="0 0 70 86" aria-hidden="true">
        <g fill="none" stroke="#7C1913" strokeWidth="3"><ellipse cx="35" cy="43" rx="30" ry="38" /><ellipse cx="35" cy="43" rx="22" ry="29" /><ellipse cx="35" cy="45" rx="14" ry="19" /><ellipse cx="35" cy="47" rx="6" ry="9" /></g>
      </svg>
    </section>
  );
}
