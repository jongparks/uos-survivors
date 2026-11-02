# 시대생존록

**UOS: University of Survivors**

서울시립대학교 캠퍼스를 배경으로 PC 브라우저에서 4~8명이 참여하는 실시간 2D 탑다운 좀비 게임입니다.

**Phase 2 — 멀티플레이 기반**까지 완료했습니다. 닉네임으로 새 방을 만들거나 6자리 초대 코드로 입장할 수 있고, 한 방에 최대 8명이 참여합니다. 테스트 맵의 WASD 이동과 충돌 판정은 서버가 계산하며 모든 플레이어에게 위치를 동기화합니다.

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

1. 닉네임을 입력하고 새 방을 만들거나 초대 코드를 입력해 참가합니다.
2. 게임 화면에서 `W`, `A`, `S`, `D` 키로 이동합니다.

서로 다른 브라우저 창에서 같은 초대 코드로 접속하면 실시간 동기화를 확인할 수 있습니다.

## 검증 명령

```bash
pnpm check
pnpm test:connection
```

환경 변수는 [`.env.example`](./.env.example)을 참고합니다.

