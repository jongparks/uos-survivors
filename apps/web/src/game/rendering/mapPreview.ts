import { DEFAULT_MAP_ID, getGameMap } from "@uos-survivors/shared";
import { paintGameMap } from "./paintGameMap";

// Development-only, standalone art review; no room, player, or game clock.
const source = document.createElement("canvas");
const CAMPUS_MAP = getGameMap(DEFAULT_MAP_ID);
source.width = CAMPUS_MAP.worldWidth; source.height = CAMPUS_MAP.worldHeight;
paintGameMap(source.getContext("2d")!, CAMPUS_MAP);
const output = document.querySelector("canvas")!;
const crops: Record<string, readonly [number, number, number, number]> = {
  all: [0, 0, source.width, source.height],
  west: [280, 630, 1050, 980], center: [880, 360, 1220, 730], east: [1810, 340, 1100, 850],
};
function show(key: string) {
  const [x, y, w, h] = crops[key]!; output.width = w; output.height = h;
  output.getContext("2d")!.drawImage(source, x, y, w, h, 0, 0, w, h);
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === key)));
}
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.addEventListener("click", () => show(b.dataset.view!)));
source.toBlob(blob => {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  document.querySelector<HTMLAnchorElement>("#download")!.href = url;
  window.addEventListener("pagehide", () => URL.revokeObjectURL(url), { once: true });
}, "image/png");
show("all");
