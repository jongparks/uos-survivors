import { useEffect, useState } from "react";
import { GAME_PHASE, getGameMap } from "@uos-survivors/shared";
import type { ConnectedGameRoom } from "../network/useGameRoom";
import { CAMPUS_BUILDING_APPEARANCE } from "./rendering/campusAppearance";

const results: Record<string, string> = { ESCAPED: "탈출", INFECTED: "감염", FAILED_TO_ESCAPE: "탈출 실패" };
export function MatchHud({ room }: { room: ConnectedGameRoom }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick(n => n + 1);
    const timer = window.setInterval(refresh, 250); room.onStateChange(refresh);
    return () => { window.clearInterval(timer); room.onStateChange.remove(refresh); };
  }, [room]);
  const state = room.state;
  if (state.phase === GAME_PHASE.waiting || !state.matchEndsAt) return null;
  const remaining = Math.max(0, Math.ceil((state.matchEndsAt - Date.now()) / 1000));
  const gates = [...(state.gates?.values() ?? [])].filter(g => g.status === "OPEN");
  const escaped = state.players?.get(room.sessionId)?.escaped;
  const map = getGameMap(state.mapId);
  const player = state.players?.get(room.sessionId);
  return <section className="match-panel round-hud" aria-label="경기 진행 및 결과">
    <p className="document-kicker">{state.phase === GAME_PHASE.finished ? "INCIDENT REPORT · 최종 기록" : "CAMPUS BULLETIN · 생존 상황"}</p>
    {state.phase === GAME_PHASE.finished ? <>
      <strong>{state.winner === "human" ? "인간 진영 승리" : "좀비 진영 승리"}</strong>
      {state.lobbyReturnsAt > 0 && <p>대기실로 돌아가기까지 {Math.max(0, Math.ceil((state.lobbyReturnsAt - Date.now()) / 1000))}초</p>}
      <ul className="round-results">{[...(state.roundResults?.entries() ?? [])].map(([id, p]) => <li key={id}><span>{p.nickname}</span><strong>{p.startedAsHuman ? results[p.result] ?? "기록 없음" : "시작 좀비"}</strong></li>)}</ul>
    </> : <>
      <strong>{state.roundStage === "ESCAPE" ? "탈출 단계" : "생존 단계"} · 남은 시간 {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong>
      {state.exitWarning && state.roundStage !== "ESCAPE" ? <p role="status">15초 후 출구가 열립니다. 개방될 출구는 아직 공개되지 않습니다.</p> : null}
      {gates.length ? <p>열린 출구: {gates.map(g => g.name).join(" · ")} · 출구에서 Space 1초 유지</p> : <p>출구는 생존 단계가 끝나면 열립니다.</p>}
      {gates.length ? <svg className="escape-map" viewBox={`0 0 ${map.worldWidth} ${map.worldHeight}`} role="img" aria-label="열린 출구 위치와 내 위치">
        <polygon points={map.boundary.map(p => `${p.x},${p.y}`).join(" ")} fill="#c8cbb1" stroke="#4a4539" strokeWidth={8} />
        {map.objects.map(o => <rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} rx={o.kind === "tree" ? o.width / 2 : 0} fill={o.kind === "pond" ? "#769b8e" : o.kind === "tree" ? "#52794f" : CAMPUS_BUILDING_APPEARANCE[o.name]?.wall ?? "#b9bdb2"} />)}
        {gates.map(g => <g key={g.name}><circle cx={g.x} cy={g.y} r={42} fill="#a3241d" /><text x={g.x} y={g.y + 90} fontSize={90} textAnchor="middle" fill="#1b1a17">{g.name}</text></g>)}
        {player && !escaped ? <circle cx={player.x} cy={player.y} r={30} fill="#fff4dc" stroke="#1b1a17" strokeWidth={8} /> : null}
      </svg> : null}
      {escaped ? <p>탈출 완료 · 인간 승리를 확보했습니다. 남은 참가자의 결과를 기다리는 중입니다.</p> : null}
    </>}
  </section>;
}
