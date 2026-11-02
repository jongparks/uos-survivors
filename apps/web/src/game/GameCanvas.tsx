import { useEffect, useRef } from "react";
import Phaser from "phaser";

import { BootstrapScene } from "./scenes/BootstrapScene";

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
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootstrapScene],
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div className="game-canvas" ref={containerRef} />;
}

