import { CampusBackdrop, EmergencyBanner } from "./components/CampusAtmosphere";
import { LobbyPanel } from "./components/LobbyPanel";
import { MainScreen } from "./components/MainScreen";
import { GameCanvas } from "./game/GameCanvas";
import { MatchPanel } from "./game/MatchPanel";
import { MatchHud } from "./game/MatchHud";
import { useGameRoom } from "./network/useGameRoom";

const STATUS_LABELS = {
  idle: "입장 대기",
  connecting: "연결 중",
  connected: "연결됨",
  reconnecting: "재접속 중",
  disconnected: "연결 종료",
  error: "연결 실패",
} as const;

export function App() {
  const connection = useGameRoom();

  if (!connection.room) {
    return (
      <MainScreen connectionState={connection.state} connectionLabel={STATUS_LABELS[connection.state]}>
        <LobbyPanel
          connecting={connection.state === "connecting" || connection.state === "reconnecting"}
          error={connection.error}
          onCreateRoom={connection.createRoom}
          onJoinRoom={connection.joinRoom}
          onQuickJoin={connection.quickJoin}
        />
      </MainScreen>
    );
  }

  return (
    <main className="room-screen">
      <CampusBackdrop />
      <EmergencyBanner />
      <div className="app-shell">
        <header className="hero">
          <p className="eyebrow">SEOUL · CAMPUS SURVIVAL LOG</p>
          <h1>시대생존록</h1>
          <p className="subtitle">UOS: University of Survivors</p>
          <span className="room-mark">생존자 집결지 · SURVIVOR ASSEMBLY</span>
        </header>

        <MatchPanel room={connection.room} />
        <MatchHud room={connection.room} />
        <section className="game-frame" aria-label="Phaser multiplayer game">
          <GameCanvas room={connection.room} />
        </section>

        <section className="status-panel" aria-live="polite">
          <div>
            <span className={`status-dot status-${connection.state}`} />
            <strong>{STATUS_LABELS[connection.state]}</strong>
          </div>
          <dl>
            <div>
              <dt>초대 코드</dt>
              <dd className="invite-code">{connection.room.roomId}</dd>
            </div>
            <div>
              <dt>참가 인원</dt>
              <dd>{connection.playerCount} / 8</dd>
            </div>
            <div>
              <dt>공개 설정</dt>
              <dd>{connection.isPrivate ? "비공개" : "공개"}</dd>
            </div>
            <div>
              <dt>참가 번호</dt>
              <dd>{connection.room.sessionId}</dd>
            </div>
          </dl>
          <button className="leave-button" onClick={() => void connection.leaveRoom()}>
            방 나가기
          </button>
          {connection.error ? (
            <p className="error-message" role="alert">
              {connection.error}
            </p>
          ) : null}
        </section>
        <footer className="room-footer">ⓒ 시대생존록 팀 · 서울시립대학교를 배경으로 한 팬메이드 게임</footer>
      </div>
    </main>
  );
}

