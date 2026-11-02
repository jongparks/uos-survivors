# 시대생존록

**UOS: University of Survivors**

서울시립대학교 캠퍼스를 배경으로 PC 브라우저에서 4~8명이 참여하는 실시간 2D 탑다운 좀비 게임입니다.

**Phase 1 — 싱글플레이 이동 기반**까지 완료했습니다. 현재 테스트 맵에서 WASD 이동, 대각선 속도 정규화, 장애물 충돌, 카메라 추적과 기본 보행 애니메이션을 확인할 수 있습니다. 멀티플레이 게임 규칙은 아직 구현하지 않습니다.

## 요구 환경

- Node.js 22 이상
- pnpm 11 이상

## 시작하기

```bash
pnpm install
pnpm dev
```

- 웹 클라이언트: <http://localhost:5173>
- 게임 서버: <http://localhost:2567>
- 서버 상태 확인: <http://localhost:2567/health>

게임 화면을 클릭한 뒤 `W`, `A`, `S`, `D` 키로 이동합니다.

## 검증 명령

```bash
pnpm check
pnpm test:connection
```

환경 변수는 [`.env.example`](./.env.example)을 참고합니다.

