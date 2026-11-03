import design from "../../assets/characters/normal_zombie.json";
import sourceUrl from "../../assets/characters/normal_zombie.svg?url";

export const NORMAL_ZOMBIE_DESIGN = {
  textureKey: "normal-zombie-design",
  sourceUrl,
  originX: design.art.pivot.x,
  originY: design.art.pivot.y,
  displayWidth: 44,
  displayHeight: 44 * design.art.canvas_px.height / design.art.canvas_px.width,
  // Rasterize the provided vector at a higher resolution for smooth filtering.
  textureWidth: 128,
  textureHeight: Math.round(128 * design.art.canvas_px.height / design.art.canvas_px.width),
} as const;
