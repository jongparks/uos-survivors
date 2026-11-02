import Phaser from "phaser";

export class BootstrapScene extends Phaser.Scene {
  constructor() {
    super("bootstrap");
  }

  create(): void {
    const { centerX, centerY, height, width } = this.cameras.main;

    this.add
      .grid(centerX, centerY, width, height, 48, 48, 0x07110e, 1, 0x17352b, 0.32)
      .setDepth(0);

    this.add
      .circle(centerX, centerY - 32, 96, 0x51e39b, 0.08)
      .setStrokeStyle(2, 0x51e39b, 0.35);

    this.add
      .text(centerX, centerY - 40, "PHASER ONLINE", {
        color: "#bfffe1",
        fontFamily: "monospace",
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY + 4, "Rendering bootstrap scene", {
        color: "#6c9f88",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setOrigin(0.5);
  }
}

