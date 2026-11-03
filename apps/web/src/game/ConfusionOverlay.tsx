import { useEffect, useState } from "react";
import { GAME_PHASE, PHILOSOPHY_STUDENT_CONFIG, PLAYER_ROLE } from "@uos-survivors/shared";
import type { ConnectedGameRoom } from "../network/useGameRoom";

export function ConfusionOverlay({ room }: { room: ConnectedGameRoom }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const refresh = () => {
      const player = room.state.players?.get(room.sessionId);
      setRemaining(room.state.phase === GAME_PHASE.playing && player?.role === PLAYER_ROLE.zombie
        ? Math.max(0, player.confusionEndsAt - Date.now()) : 0);
    };
    refresh(); room.onStateChange(refresh);
    const timer = window.setInterval(refresh, 50);
    return () => { window.clearInterval(timer); room.onStateChange.remove(refresh); };
  }, [room]);
  if (remaining === 0) return null;
  return <div className="confusion-overlay" role="status">
    <strong>철학적 혼란 — {(remaining / 1000).toFixed(1)}초</strong>
    <span>이동 방향이 반대로 적용됩니다.</span>
    <span className="confusion-directions">↑ → ↓ / ↓ → ↑<br />← → → / → → ←</span>
    <progress aria-label="혼란 남은 시간" max={PHILOSOPHY_STUDENT_CONFIG.confusionDurationMs} value={remaining} />
  </div>;
}
