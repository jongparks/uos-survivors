import { GameCanvas } from "./game/GameCanvas";
import { useServerConnection } from "./network/useServerConnection";

const STATUS_LABELS = {
  idle: "대기",
  connecting: "연결 중",
  connected: "연결됨",
  disconnected: "연결 종료",
  error: "연결 실패",
} as const;

export function App() {
  const connection = useServerConnection();

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">SEOUL · CAMPUS SURVIVAL LOG</p>
        <h1>시대생존록</h1>
        <p className="subtitle">UOS: University of Survivors</p>
      </header>

      <section className="game-frame" aria-label="Phaser movement test">
        <GameCanvas />
      </section>

      <section className="status-panel" aria-live="polite">
        <div>
          <span className={`status-dot status-${connection.state}`} />
          <strong>{STATUS_LABELS[connection.state]}</strong>
        </div>
        <dl>
          <div>
            <dt>SERVER</dt>
            <dd>{connection.endpoint}</dd>
          </div>
          <div>
            <dt>ROOM</dt>
            <dd>{connection.details?.roomId ?? "—"}</dd>
          </div>
          <div>
            <dt>SESSION</dt>
            <dd>{connection.details?.sessionId ?? "—"}</dd>
          </div>
        </dl>
        {connection.error ? <p className="error-message">{connection.error}</p> : null}
      </section>
    </main>
  );
}

