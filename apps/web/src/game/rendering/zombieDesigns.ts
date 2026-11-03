import { CHARACTER_IDS } from "@uos-survivors/shared";
import { NORMAL_ZOMBIE_DESIGN } from "./normalZombieDesign";
import drunkMetadata from "../../assets/characters/drunk_student.json";
import drunkUrl from "../../assets/characters/drunk_student.svg?url";
import gradMetadata from "../../assets/characters/grad_student.json";
import gradUrl from "../../assets/characters/grad_student.svg?url";
import libraryMetadata from "../../assets/characters/library_npc.json";
import libraryUrl from "../../assets/characters/library_npc.svg?url";
import lateMetadata from "../../assets/characters/late_student.json";
import lateUrl from "../../assets/characters/late_student.svg?url";
import xmanMetadata from "../../assets/characters/x_man.json";
import xmanUrl from "../../assets/characters/x_man.svg?url";
import professorMetadata from "../../assets/characters/professor.json";
import professorUrl from "../../assets/characters/professor.svg?url";

export interface ZombieDesign {
  textureKey: string; sourceUrl: string; originX: number; originY: number;
  displayWidth: number; displayHeight: number; textureWidth: number; textureHeight: number;
}
interface ArtMetadata {
  art: { pivot: { x: number; y: number }; canvas_px: { width: number; height: number } };
}
function design(key: string, sourceUrl: string, metadata: ArtMetadata): ZombieDesign {
  const ratio = metadata.art.canvas_px.height / metadata.art.canvas_px.width;
  return { textureKey: key, sourceUrl, originX: metadata.art.pivot.x, originY: metadata.art.pivot.y,
    displayWidth: 44, displayHeight: 44 * ratio, textureWidth: 128, textureHeight: Math.round(128 * ratio) };
}

// Metadata supplies art geometry only; skill descriptions and gameplay proposals
// in the design bundle never override the authoritative character rules.
export const ZOMBIE_DESIGNS: Readonly<Partial<Record<string, ZombieDesign>>> = {
  [CHARACTER_IDS.normalZombie]: NORMAL_ZOMBIE_DESIGN,
  [CHARACTER_IDS.drunkenZombie]: design("drunken-zombie-design", drunkUrl, drunkMetadata),
  [CHARACTER_IDS.graduateZombie]: design("graduate-zombie-design", gradUrl, gradMetadata),
  [CHARACTER_IDS.libraryNpc]: design("library-zombie-design", libraryUrl, libraryMetadata),
  [CHARACTER_IDS.lateZombie]: design("late-zombie-design", lateUrl, lateMetadata),
  [CHARACTER_IDS.xmanZombie]: design("xman-zombie-design", xmanUrl, xmanMetadata),
  [CHARACTER_IDS.professor]: design("professor-zombie-design", professorUrl, professorMetadata),
};
