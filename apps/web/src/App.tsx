import { LobbyPanel } from "./components/LobbyPanel";
import { GameCanvas } from "./game/GameCanvas";
import { useGameRoom } from "./network/useGameRoom";

const STATUS_LABELS = {
  idle: "대기",
  connecting: "연결 중",
  connected: "연결됨",
  reconnecting: "재접속 중",
  disconnected: "연결 종료",
  error: "연결 실패",
} as const;

export function App() {
  const connection = useGameRoom();

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">SEOUL · CAMPUS SURVIVAL LOG</p>
        <h1>시대생존록</h1>
        <p className="subtitle">UOS: University of Survivors</p>
      </header>

      {connection.room ? (
        <>
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
                <dt>INVITE CODE</dt>
                <dd className="invite-code">{connection.room.roomId}</dd>
              </div>
              <div>
                <dt>PLAYERS</dt>
                <dd>{connection.playerCount} / 8</dd>
              </div>
              <div>
                <dt>ACCESS</dt>
                <dd>{connection.isPrivate ? "PRIVATE" : "PUBLIC"}</dd>
              </div>
              <div>
                <dt>SESSION</dt>
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
        </>
      ) : (
        <LobbyPanel
          connecting={connection.state === "connecting"}
          error={connection.error}
          onCreateRoom={connection.createRoom}
          onJoinRoom={connection.joinRoom}
          onQuickJoin={connection.quickJoin}
        />
      )}
    </main>
  );
}

