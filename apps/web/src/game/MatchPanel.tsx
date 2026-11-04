import { useEffect, useState } from "react";
import { COMBAT_RULES, GAME_PHASE, MATCH_MESSAGES } from "@uos-survivors/shared";
import type { ConnectedGameRoom } from "../network/useGameRoom";

export function MatchPanel({ room }: { room: ConnectedGameRoom }) {
  const [snapshot, setSnapshot] = useState({ phase: "", host: "", count: 0, error: "" });
  useEffect(() => {
    const refresh = () => setSnapshot(previous => {
      const next = { phase: room.state.phase ?? "",
        host: room.state.hostSessionId ?? "", count: [...(room.state.players?.values() ?? [])].filter(p => p.connected).length,
        error: room.state.startError ?? "" };
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
    refresh(); room.onStateChange(refresh);
    return () => room.onStateChange.remove(refresh);
  }, [room]);
  if (snapshot.phase === GAME_PHASE.waiting) {
    const host = snapshot.host === room.sessionId;
    return <section className="match-panel" aria-label="게임 시작 대기">
      <p className="document-kicker">SURVIVOR ASSEMBLY · 집결 현황</p>
      <h2>생존자 집결 중</h2>
      <strong>참가자 {snapshot.count} / 8명 · 최소 4명</strong>
      <p>게임 시작 시 진영과 캐릭터가 무작위로 배정됩니다.</p>
      {host ? <button disabled={snapshot.count < COMBAT_RULES.minimumPlayersToStart} onClick={() => room.send(MATCH_MESSAGES.start)}>현재 {snapshot.count}명으로 시작</button>
        : <p>방장이 게임을 시작하기를 기다리는 중입니다.</p>}
      {snapshot.error ? <p className="form-error" role="alert">{snapshot.error}</p> : null}
    </section>;
  }
  return null;
}
