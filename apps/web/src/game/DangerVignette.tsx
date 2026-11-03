import { useEffect, useState, type CSSProperties } from "react";
import { DANGER_LEVEL, DANGER_MESSAGES, GAME_PHASE, HUMAN_DANGER_CONFIG as C, PLAYER_ACTIVITY, PLAYER_ROLE, CHARACTER_IDS, type DangerLevel, type DangerUpdate } from "@uos-survivors/shared";
import type { ConnectedGameRoom } from "../network/useGameRoom";

export function DangerVignette({ room }: { room: ConnectedGameRoom }) {
  const [level, setLevel] = useState<DangerLevel>(DANGER_LEVEL.none);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setLevel(DANGER_LEVEL.none);
    const refresh = () => {
      const p = room.state.players?.get(room.sessionId);
      const enabled = room.state.phase === GAME_PHASE.playing && p?.role === PLAYER_ROLE.human && p.connected &&
        !(p.characterId === CHARACTER_IDS.fossil && p.activity === PLAYER_ACTIVITY.hidden);
      setEnabled(!!enabled);
    };
    const stopMessage = room.onMessage<DangerUpdate>(DANGER_MESSAGES.update, update => {
      if (Object.values(DANGER_LEVEL).includes(update.level)) setLevel(update.level);
      refresh();
    });
    const onDrop = () => { setLevel(DANGER_LEVEL.none); setEnabled(false); };
    const onReconnect = () => room.send(DANGER_MESSAGES.subscribe);
    room.onStateChange(refresh);
    room.onDrop(onDrop);
    room.onReconnect(onReconnect);
    refresh();
    room.send(DANGER_MESSAGES.subscribe);
    return () => { stopMessage(); room.onStateChange.remove(refresh); room.onDrop.remove(onDrop); room.onReconnect.remove(onReconnect); };
  }, [room]);
  const visibleLevel = enabled ? level : DANGER_LEVEL.none;
  const style = {
    opacity: visibleLevel === DANGER_LEVEL.danger ? C.dangerOpacity : visibleLevel === DANGER_LEVEL.warning ? C.warningOpacity : 0,
    transition: `opacity ${C.transitionMs}ms ease`,
    "--danger-pulse-cycle": `${C.pulseCycleMs}ms`,
  } as CSSProperties;
  return <div className="danger-vignette" style={style} aria-hidden="true">
    <div className={visibleLevel === DANGER_LEVEL.danger ? "danger-vignette-fill danger-vignette-pulse" : "danger-vignette-fill"} />
  </div>;
}
