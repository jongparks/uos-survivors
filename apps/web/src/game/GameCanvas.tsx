import { useEffect, useRef } from "react";
import Phaser from "phaser";

import { MovementScene } from "./scenes/MovementScene";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

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
      scene: [MovementScene],
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div className="game-canvas" ref={containerRef} />;
}

