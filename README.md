# 시대생존록

**UOS: University of Survivors**

서울시립대학교 캠퍼스를 배경으로 PC 브라우저에서 4~8명이 참여하는 실시간 2D 탑다운 좀비 게임입니다.

현재는 **Phase 0 — 프로젝트 환경 구축** 단계입니다. 이 단계에는 Phaser 부트스트랩 화면과 Colyseus 연결 검증만 포함되며, 게임 규칙은 아직 구현하지 않습니다.

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

## 검증 명령

```bash
pnpm check
pnpm test:connection
```

환경 변수는 [`.env.example`](./.env.example)을 참고합니다.

