/** Visual observations, not a specification of the buildings' construction.
 * Roof colours/forms come from the Kakao Map sky view; facade materials from
 * official building photos and the Seoul Institute aerial photo.
 * References and confidence are recorded in docs/CAMPUS_ART.md. */
export interface BuildingAppearance {
  facade: "brick" | "stone" | "concrete" | "glass" | "louver" | "metal";
  wall: string;
  roof: string;
  trim: string;
  glazing: string;
  /** Roof treatment seen from above. */
  roofForm?: "flat" | "gable" | "green" | "octagon" | "greenhouse" | "terrace";
  /** Roof equipment seen from above. */
  roofDetail?: "solar" | "skylight" | "cross-skylight" | "hvac" | "court";
  feature?: "columns" | "glass-spine" | "split" | "rotunda" | "curtain";
  /** Approximate storeys; drives shadow length and facade height. */
  floors?: number;
}
const brick = (wall: string, roof = "#80867f", floors = 4): BuildingAppearance => ({ facade: "brick", wall, roof, trim: "#d9c6ad", glazing: "#3f6168", floors });
const stone = (wall: string, roof = "#c9cbc4", floors = 4): BuildingAppearance => ({ facade: "stone", wall, roof, trim: "#e6e4d9", glazing: "#4c7480", floors });
export const CAMPUS_BUILDING_APPEARANCE: Readonly<Record<string, BuildingAppearance>> = {
  "전농관": { ...stone("#e3e1d6", "#6fa48f", 3), roofForm: "flat", feature: "curtain", glazing: "#5f9e8a" },
  "건설공학관": { facade: "metal", wall: "#b07c4a", roof: "#7f9361", trim: "#d8c3a0", glazing: "#3b5a62", roofForm: "green", floors: 5 },
  "창공관": { ...brick("#a5644c", "#727a76", 4), roofDetail: "skylight" },
  "인문학관": { ...brick("#b0745a", "#a7aaa4", 4), roofDetail: "solar" },
  "배봉관": { ...brick("#9f6250", "#7f9e66", 4), roofForm: "green" },
  "대학본부": { ...brick("#b67652", "#6f8f5c", 8), roofForm: "green", feature: "glass-spine" },
  "자연과학관": { ...brick("#a5634f", "#6c7f68", 4), roofForm: "green", feature: "rotunda" },
  "경농관": { ...brick("#9b6a50", "#6f777a", 2), roofForm: "gable", feature: "columns" },
  "창의혁신관": { ...stone("#d3d1c4", "#c3c6bf", 5), roofDetail: "hvac" },
  "학생회관": { ...brick("#a86c58", "#9da3a2", 4), roofDetail: "solar", feature: "columns" },
  "시대인재관": { ...stone("#c9b597", "#d4d6cf", 3), roofDetail: "solar", feature: "glass-spine" },
  "과학기술관": { ...brick("#b07f63", "#b9bdb7", 6), feature: "rotunda" },
  "21세기관": { ...stone("#cbbd9e", "#727873", 5), roofDetail: "hvac", feature: "columns" },
  "조형관": { facade: "concrete", wall: "#b7b5a8", roof: "#d9dad3", trim: "#dcdacd", glazing: "#3d6474", feature: "glass-spine", floors: 4 },
  "자작마루": { ...brick("#b9a688", "#858d8e", 1), roofForm: "gable", feature: "columns" },
  "정보기술관": { ...stone("#d5dbd8", "#d9dbd6", 7), roofDetail: "solar", feature: "glass-spine", glazing: "#4f8f97" },
  "법학관": { facade: "louver", wall: "#6f7674", roof: "#8ea172", trim: "#b4c0bb", glazing: "#5a7f86", roofForm: "terrace", feature: "glass-spine", floors: 6 },
  "중앙도서관": { ...brick("#a95f46", "#dfe0da", 5), roofDetail: "cross-skylight", feature: "columns" },
  "생활관": { ...brick("#b98a6a", "#d6d8d2", 7), roofDetail: "solar", feature: "split" },
  "국제학사": { ...brick("#b06e55", "#a9b4bd", 6), roofDetail: "solar" },
  "미디어관": { ...stone("#babcb3", "#b3b6b0", 3), feature: "glass-spine" },
  "대강당": { ...brick("#98674f", "#a3bea3", 3), roofForm: "octagon" },
  "박물관": { ...brick("#a2937c", "#737a7c", 1), roofForm: "gable", feature: "columns" },
  "웰니스센터": { facade: "glass", wall: "#9fb5b3", roof: "#4f7fae", trim: "#d2d8d0", glazing: "#6f99a0", floors: 2 },
  "미래관": { ...stone("#dcdcd2", "#d7d8d2", 12), feature: "glass-spine", glazing: "#3f7da0" },
  "100주년기념관": { ...brick("#b8664c", "#c6c9c3", 6), roofDetail: "solar", feature: "split" },
  "시대융합관": { facade: "louver", wall: "#a9ada6", roof: "#dcddd6", trim: "#d6d8cd", glazing: "#55767b", roofDetail: "hvac", floors: 5 },
  "음악관": { facade: "concrete", wall: "#aeada2", roof: "#e0e1dc", trim: "#cbcbc0", glazing: "#34494f", feature: "split", floors: 4 },
  "자동화온실": { facade: "glass", wall: "#cfe1dc", roof: "#e7efec", trim: "#f3f6f2", glazing: "#a9c7c1", roofForm: "greenhouse", floors: 1 },
  // No sufficiently clear individual exterior photograph: deliberately restrained.
  "토목구조실험동": { ...stone("#b7b8ad", "#5b86b0", 2) },
  "건축구조실험동": { ...stone("#bcbeb2", "#5b86b0", 2) },
  "스마트연구동": { ...stone("#d9dbd3", "#e1e2dc", 1) },
  "직장어린이집": { ...brick("#c0a386", "#c98d5a", 2) },
};
export const DEFAULT_BUILDING_APPEARANCE: BuildingAppearance = stone("#b9bdb2");
