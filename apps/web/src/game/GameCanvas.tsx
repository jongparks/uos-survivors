import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { CHARACTER_IDS, CHARACTER_PROFILES, CHAT_MESSAGES, CHAT_RULES, GAME_PHASE, ROUND_START_RULES } from "@uos-survivors/shared";

import type { ConnectedGameRoom } from "../network/useGameRoom";
import { MultiplayerScene } from "./scenes/MultiplayerScene";
import { DangerVignette } from "./DangerVignette";
import { ConfusionOverlay } from "./ConfusionOverlay";

interface GameCanvasProps {
  room: ConnectedGameRoom;
}

export function GameCanvas({ room }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatOpenRef = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [readyMap, setReadyMap] = useState(room.state.mapId ?? "");
  const [actions, setActions] = useState({ skill: "", attack: "" });
  const [briefing, setBriefing] = useState({ remaining: 0, character: "" });
  const toggleChat = (open: boolean) => {
    chatOpenRef.current = open;
    setChatOpen(open);
  };
  useEffect(() => {
    const openChat = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing || event.keyCode === 229 ||
        chatOpenRef.current || !room.connection.isOpen || room.state.phase === GAME_PHASE.preparing ||
        (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, [contenteditable]"))) return;
      event.preventDefault();
      event.stopPropagation();
      toggleChat(true);
    };
    const closeChat = () => toggleChat(false);
    const closeDuringBriefing = () => {
      if (chatOpenRef.current && room.state.phase === GAME_PHASE.preparing) closeChat();
    };
    window.addEventListener("keydown", openChat, true);
    room.onDrop(closeChat);
    room.onStateChange(closeDuringBriefing);
    return () => {
      window.removeEventListener("keydown", openChat, true);
      room.onDrop.remove(closeChat);
      room.onStateChange.remove(closeDuringBriefing);
    };
  }, [room]);
  useEffect(() => {
    const refresh = () => {
      const remaining = room.state.phase === GAME_PHASE.preparing
        ? Math.max(1, room.state.roundStartsAt - Date.now()) : 0;
      const character = remaining ? room.state.players?.get(room.sessionId)?.characterId ?? "" : "";
      setBriefing(previous => previous.remaining === remaining && previous.character === character
        ? previous : { remaining, character });
    };
    refresh();
    room.onStateChange(refresh);
    const timer = window.setInterval(refresh, 100);
    return () => {
      room.onStateChange.remove(refresh);
      window.clearInterval(timer);
    };
  }, [room]);
  useEffect(() => {
    const refresh = () => setReadyMap(room.state.mapId ?? "");
    refresh(); room.onStateChange(refresh);
    return () => room.onStateChange.remove(refresh);
  }, [room]);

  useEffect(() => {
    if (!containerRef.current || !readyMap || readyMap !== room.state.mapId) {
      return undefined;
    }

    const scene = new MultiplayerScene(room, (skill, attack) => {
      setActions(previous => previous.skill === skill && previous.attack === attack ? previous : { skill, attack });
    }, () => chatOpenRef.current);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#07110e",
      width: 960,
      height: 540,
      pixelArt: false,
      antialias: true,
      physics: {
        default: "arcade",
        arcade: {
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [scene],
    });

    return () => {
      scene.dispose();
      game.destroy(true);
    };
  }, [room, readyMap]);

  const profile = CHARACTER_PROFILES[briefing.character];
  const reading = briefing.remaining > ROUND_START_RULES.countdownMs;
  const seconds = Math.ceil((briefing.remaining - (reading ? ROUND_START_RULES.countdownMs : 0)) / 1000);
  return (
    <div className="game-canvas" ref={containerRef}>
      <DangerVignette room={room} />
      <ConfusionOverlay room={room} />
      {briefing.remaining > 0 ? (
        <div className="round-briefing">
          <section aria-label={reading ? "캐릭터 설명" : "시작 카운트다운"}>
            <strong>{profile ? `${profile.team === "HUMAN" ? "인간" : "좀비"} · ${profile.name}` : "캐릭터 배정 중"}</strong>
            {reading && profile ? <>
              {profile.ability && <b>{profile.ability}</b>}
              <p>{profile.description}</p>
              <small>방향키 이동 · Space {profile.team === "HUMAN" ? "상호작용" : "기본 공격"}
                {profile.ability && briefing.character !== CHARACTER_IDS.fossil ? " · Shift 능력" : ""}</small>
            </> : null}
            <span className="briefing-count">{reading ? `준비 · ${seconds}초` : `${seconds}`}</span>
          </section>
        </div>
      ) : !chatOpen && (actions.skill || actions.attack) ? (
        <div className="action-hud" aria-label="능력 및 공격 상태">
          {actions.attack && <div><kbd>Space</kbd> <b>기본 공격</b> · {actions.attack}</div>}
          {actions.skill && <div>{actions.skill}</div>}
        </div>
      ) : null}
      {chatOpen ? (
        <div className="game-chat-input">
          <input
            autoFocus
            aria-label="게임 채팅"
            placeholder="메시지를 입력하세요"
            maxLength={CHAT_RULES.maxLength}
            onBlur={() => toggleChat(false)}
            onKeyUp={event => event.stopPropagation()}
            onKeyDown={event => {
              event.stopPropagation();
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.repeat) return;
              if (event.key === "Escape") {
                event.preventDefault();
                toggleChat(false);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const text = event.currentTarget.value.trim();
                if (text && room.connection.isOpen) room.send(CHAT_MESSAGES.send, text);
                toggleChat(false);
              }
            }}
          />
          <span>Enter 전송 · Esc 닫기</span>
        </div>
      ) : briefing.remaining === 0 && <span className="game-chat-hint"><kbd>Enter</kbd> 채팅</span>}
    </div>
  );
}

