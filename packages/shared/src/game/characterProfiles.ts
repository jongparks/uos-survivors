import { CHARACTER_IDS as C } from "./characters.js";

export const CHARACTER_PROFILES: Readonly<Record<string, { name: string; team: "HUMAN" | "ZOMBIE"; ability: string | null; description: string }>> = {
  [C.professor]: { name: "교수님", team: "ZOMBIE", ability: "과제 제출하세요", description: "가까운 인간에게 최대 3초 방향키 미션을 부여합니다. 사용 후 본인의 기본공격만 1초 제한됩니다." },
  [C.normalHuman]: { name: "시대생", team: "HUMAN", ability: null, description: "고유 능력 없이 이동과 상호작용으로 생존합니다. 공통 위험 감지가 적용됩니다." },
  [C.fossil]: { name: "화석", team: "HUMAN", ability: "비밀 은신처", description: "사용 가능한 은신처 근처에서 Space로 숨거나 나옵니다." },
  [C.sportsStudent]: { name: "스과생", team: "HUMAN", ability: "전력 질주", description: "6초 동안 빠르게 달린 뒤 2초간 탈진합니다." },
  [C.sculptureStudent]: { name: "조각학도", team: "HUMAN", ability: "살아있는 조각상", description: "최근 5초 이동을 따라가는 조각상으로 좀비를 교란합니다." },
  [C.engineeringStudent]: { name: "공대생", team: "HUMAN", ability: "밤샘 제작", description: "현재 위치에 좀비의 이동을 2.5초 묶는 함정을 제작합니다." },
  [C.computerStudent]: { name: "컴과생", team: "HUMAN", ability: "Ctrl + Z", description: "위치 기록이 3초 이상이면 3초 전 경로의 유효 위치로 돌아갑니다." },
  [C.philosophyStudent]: { name: "철학도", team: "HUMAN", ability: "소크라테스의 문답법", description: "3타일 이내 가장 가까운 좀비의 이동 입력을 3초 반전시킵니다." },
  [C.normalZombie]: { name: "일반 좀비", team: "ZOMBIE", ability: null, description: "인간보다 8% 빠르게 이동하며 Space 근접공격으로 감염시킵니다." },
  [C.drunkenZombie]: { name: "만취생", team: "ZOMBIE", ability: "숙취 폭발", description: "0.5초 준비 후 감염 투사체를 발사합니다. 빗나가면 둔화 웅덩이가 생깁니다." },
  [C.graduateZombie]: { name: "대학원생", team: "ZOMBIE", ability: "교수님이 찾으신다", description: "가장 가까운 인간 한 명을 본인에게만 4초간 표시합니다." },
  [C.libraryNpc]: { name: "중도 NPC", team: "ZOMBIE", ability: "자리 맡아놨습니다", description: "인간만 막는 책더미를 전방에 12초간 설치합니다." },
  [C.lateZombie]: { name: "지각생", team: "ZOMBIE", ability: "출석 마감", description: "최대 3타일을 돌진하며 첫 인간에 닿으면 감염시킵니다." },
  [C.xmanZombie]: { name: "엑스맨", team: "ZOMBIE", ability: "새터 잠입", description: "10초 동안 인간으로 위장합니다. 공격하면 즉시 위장을 풀고 공격합니다." },
};
