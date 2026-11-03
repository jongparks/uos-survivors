/** Visual observations, not a specification of the buildings' construction.
 * References and confidence are recorded in docs/CAMPUS_ART.md. */
export interface BuildingAppearance {
  facade: "brick" | "stone" | "concrete" | "glass" | "louver";
  wall: string;
  roof: string;
  trim: string;
  glazing: string;
  roofForm?: "gable" | "flat";
  feature?: "columns" | "glass-spine" | "split" | "rotunda";
}
const brick = (wall: string, roof = "#777f73"): BuildingAppearance => ({ facade: "brick", wall, roof, trim: "#d0b9a0", glazing: "#486b70" });
const stone = (wall: string, roof = "#9ba39b"): BuildingAppearance => ({ facade: "stone", wall, roof, trim: "#e0ded2", glazing: "#547b81" });
export const CAMPUS_BUILDING_APPEARANCE: Readonly<Record<string, BuildingAppearance>> = {
  "전농관": { ...stone("#d2cebb", "#7f9c89"), feature: "columns" },
  "건설공학관": stone("#bcb9a9"),
  "창공관": brick("#a16a52", "#737e77"),
  "인문학관": brick("#b17c5b", "#89917c"),
  "배봉관": brick("#9f6651", "#7d8777"),
  "대학본부": { ...brick("#b67b57", "#94a19b"), feature: "glass-spine" },
  "자연과학관": { ...brick("#a86650", "#71877d"), feature: "rotunda" },
  "경농관": { ...brick("#98674e", "#69756f"), roofForm: "gable", feature: "columns" },
  "창의혁신관": stone("#d5d3c3", "#7f9584"),
  "학생회관": { ...brick("#a9705e", "#839188"), feature: "columns" },
  "시대인재관": { ...stone("#c7b398", "#8c9288"), feature: "glass-spine" },
  "과학기술관": { ...brick("#b38164", "#747c72"), feature: "rotunda" },
  "21세기관": { ...stone("#c8bb9e", "#9caa9b"), feature: "columns" },
  "조형관": { facade: "concrete", wall: "#b5b3a6", roof: "#888f88", trim: "#d8d6c9", glazing: "#426978", feature: "glass-spine" },
  "자작마루": { ...brick("#b5a487", "#64716c"), roofForm: "gable", feature: "columns" },
  "정보기술관": { ...stone("#c6ceca", "#8c9e99"), feature: "glass-spine" },
  "법학관": { facade: "louver", wall: "#747a78", roof: "#8c9993", trim: "#acb9b4", glazing: "#5e8086", feature: "glass-spine" },
  "중앙도서관": { ...brick("#a86248", "#7a8377"), feature: "columns" },
  "생활관": { ...brick("#ba8d6d", "#89958a"), feature: "split" },
  "국제학사": { ...stone("#c1b79e", "#8c9c87"), feature: "columns" },
  "미디어관": { ...stone("#b9bbb2", "#8c9893"), feature: "glass-spine" },
  "대강당": { ...brick("#97694f", "#5d7869"), roofForm: "gable" },
  "박물관": { ...brick("#a1937c", "#69736c"), roofForm: "gable", feature: "columns" },
  "웰니스센터": { facade: "glass", wall: "#a5b8b4", roof: "#8fa29c", trim: "#d2d8d0", glazing: "#789c9f" },
  "미래관": { ...stone("#d4d4c8", "#a1aaa4"), feature: "glass-spine" },
  "100주년기념관": { ...brick("#b97355", "#a6ada3"), feature: "split" },
  "시대융합관": { facade: "louver", wall: "#a6aaa3", roof: "#a8b0a6", trim: "#d3d5ca", glazing: "#59767a" },
  "음악관": { facade: "concrete", wall: "#aaa99e", roof: "#606d6c", trim: "#c8c8bd", glazing: "#394e55", feature: "split" },
  // No sufficiently clear individual exterior photograph: deliberately restrained.
  "토목구조실험동": { ...stone("#b7b8ad", "#858f87") },
  "건축구조실험동": { ...stone("#bcbeb2", "#8d968a") },
  "스마트연구동": { ...stone("#b9c0b7", "#94a197") },
  "직장어린이집": { ...brick("#bca388", "#8c9a83") },
};
export const DEFAULT_BUILDING_APPEARANCE: BuildingAppearance = stone("#b9bdb2");
