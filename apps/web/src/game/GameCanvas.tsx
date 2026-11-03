import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";

import type { ConnectedGameRoom } from "../network/useGameRoom";
import { MultiplayerScene } from "./scenes/MultiplayerScene";
import { DangerVignette } from "./DangerVignette";
import { ConfusionOverlay } from "./ConfusionOverlay";

interface GameCanvasProps {
  room: ConnectedGameRoom;
}

export function GameCanvas({ room }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [readyMap, setReadyMap] = useState(room.state.mapId ?? "");
  useEffect(() => {
    const refresh = () => setReadyMap(room.state.mapId ?? "");
    refresh(); room.onStateChange(refresh);
    return () => room.onStateChange.remove(refresh);
  }, [room]);

  useEffect(() => {
    if (!containerRef.current || !readyMap || readyMap !== room.state.mapId) {
      return undefined;
    }

    const scene = new MultiplayerScene(room);
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

  return <div className="game-canvas" ref={containerRef}><DangerVignette room={room} /><ConfusionOverlay room={room} /></div>;
}

