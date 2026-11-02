import { useEffect, useRef } from "react";
import Phaser from "phaser";

import type { ConnectedGameRoom } from "../network/useGameRoom";
import { MultiplayerScene } from "./scenes/MultiplayerScene";

interface GameCanvasProps {
  room: ConnectedGameRoom;
}

export function GameCanvas({ room }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const scene = new MultiplayerScene(room);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#07110e",
      width: 960,
      height: 540,
      pixelArt: true,
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
  }, [room]);

  return <div className="game-canvas" ref={containerRef} />;
}

