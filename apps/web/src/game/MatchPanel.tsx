import { useEffect, useState } from "react";
import { CHARACTER_IDS, CHARACTER_PROFILES, COMBAT_RULES, GAME_PHASE, MATCH_MESSAGES } from "@uos-survivors/shared";
import type { ConnectedGameRoom } from "../network/useGameRoom";

export function MatchPanel({ room }: { room: ConnectedGameRoom }) {
  const [snapshot, setSnapshot] = useState({ phase: "", character: "", host: "", count: 0, started: 0, error: "" });
  const [acknowledged, setAcknowledged] = useState("");
  useEffect(() => {
    const refresh = () => setSnapshot(previous => {
      const next = { phase: room.state.phase ?? "", character: room.state.players?.get(room.sessionId)?.characterId ?? "",
        host: room.state.hostSessionId ?? "", count: [...(room.state.players?.values() ?? [])].filter(p => p.connected).length,
        started: room.state.matchStartedAt ?? 0, error: room.state.startError ?? "" };
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
    refresh(); room.onStateChange(refresh);
    return () => room.onStateChange.remove(refresh);
  }, [room]);
  if (snapshot.phase === GAME_PHASE.waiting) {
    const host = snapshot.host === room.sessionId;
    return <section className="match-panel" aria-label="게임 시작 대기">
      <strong>참가자 {snapshot.count} / 8명 · 최소 4명</strong>
      <p>게임 시작 시 진영과 캐릭터가 무작위로 배정됩니다.</p>
      {host ? <button disabled={snapshot.count < COMBAT_RULES.minimumPlayersToStart} onClick={() => room.send(MATCH_MESSAGES.start)}>현재 {snapshot.count}명으로 시작</button>
        : <p>방장이 게임을 시작하기를 기다리는 중입니다.</p>}
      {snapshot.error ? <p role="alert">{snapshot.error}</p> : null}
    </section>;
  }
  const key = `${room.sessionId}:${snapshot.started}`;
  const profile = CHARACTER_PROFILES[snapshot.character];
  if (snapshot.phase !== GAME_PHASE.playing || !profile || acknowledged === key) return null;
  const human = profile.team === "HUMAN";
  return <section className="match-panel character-intro" aria-label="내 캐릭터 소개">
    <strong>{human ? "인간" : "좀비"} · {profile.name}</strong>
    <p>{profile.ability ? `고유 능력: ${profile.ability}` : "고유 능력 없음"}</p>
    <p>{profile.description}</p>
    <p>방향키: 이동 · Space: {human ? "상호작용" : "기본공격 (쿨타임 2초)"}
      {profile.ability && snapshot.character !== CHARACTER_IDS.fossil ? " · Shift: 고유 능력" : ""}</p>
    <button onClick={() => setAcknowledged(key)}>확인</button>
  </section>;
}
