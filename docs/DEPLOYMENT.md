# Vercel + Render 첫 테스트 배포

진행 순서: Render 계정 → 게임 서버 → 공개 주소 확인 → Vercel 웹 → 외부 4~8인 테스트. 기존 GitHub 저장소 `jongparks/uos-survivors`를 사용한다. DB·Redis·유료 서비스를 추가하지 않는다. Railway는 새 계정의 무료 배포 제한으로 이번 테스트에서 사용하지 않는다. 기존 `railway.json`은 대안 설정으로만 보관하며 Render에서는 사용하지 않는다.

## 1. Render 계정

https://dashboard.render.com 에서 GitHub 계정으로 가입·로그인한다. 무료 테스트에서는 결제수단을 등록하지 않고 Free Web Service를 사용한다. 무료 이용 가능 여부는 실제 계정 화면에서 확인한다.

무료 서버는 통신이 없는 상태가 15분 지속되면 중지되며 새 요청으로 재시작하는 데 약 1분이 걸릴 수 있다. 통신 중에도 재시작이 발생할 수 있으므로 상시 운영 보장은 없다. 결제수단 미등록 상태에서는 월 무료 시간·트래픽·빌드 한도 초과 시 관련 서비스나 빌드가 제한된다. 서버가 재시작하면 메모리의 게임방은 복구되지 않는다.

## 2. Render 게임 서버

New → Web Service → GitHub 저장소 연결 → `jongparks/uos-survivors` 선택. 저장소 접근 선택이 나오면 이 저장소만 선택할 수 있다.

| 항목 | 값 |
|---|---|
| Name | uos-survivors-server (사용 중이면 다른 이름) |
| Language / Runtime | Node |
| Region | Singapore |
| Branch | main |
| Root Directory | 비워 둠 (저장소 루트) |
| Instance Type | Free |
| Build Command | 아래 명령 |
| Start Command | `node apps/server/dist/index.js` |
| Health Check Path | `/health` |
| Environment | `NODE_ENV=production`, `NODE_VERSION=24.18.0` |

빌드 명령:

```sh
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm --filter @uos-survivors/shared build && corepack pnpm --filter @uos-survivors/server build
```

루트 `render.yaml`은 위 설정을 Blueprint 방식에서도 사용할 수 있게 정의한다. 일반 Web Service 생성 화면에서는 위 표를 직접 입력한다. `apps/server`만 Root Directory로 지정하면 공통 패키지가 누락될 수 있다. `PORT`는 Render가 제공하며 서버가 `0.0.0.0`에 바인딩하도록 구현돼 있다. 서비스는 하나만 생성한다.

배포 성공 후 발급된 `https://실제서비스명.onrender.com/health`에서 `status: ok`를 확인한다. URL은 실제 대시보드 값을 사용한다. 루트 주소 `/`는 웹 화면이 없으므로 404가 정상일 수 있다. 게임 화면은 Vercel에서 제공한다.

GitHub 자동 배포를 켜면 main 반영 시 새 버전이 올라간다. 진행 중 경기가 끊길 수 있으므로 지인 테스트 중에는 코드 배포를 피한다.

## 3. Vercel 웹

- 기존 Vercel 계정에서 같은 저장소를 Import한다.
- Root Directory: `apps/web`. 외부 루트 파일을 빌드에 포함하는 옵션을 켜서 `packages/shared`를 읽을 수 있게 한다.
- Framework: Vite, Output Directory: `dist`. `apps/web/vercel.json`의 빌드 명령을 사용한다.
- Node.js 24.x, pnpm 11.25.0을 사용한다. 패키지 관리자는 루트 `packageManager`에 기록돼 있다.
- `VITE_GAME_SERVER_URL`에 **실제 Render 공개 HTTPS 주소**를 설정한다. `https://...onrender.com` 형식이면 SDK가 HTTPS 매칭과 WSS 통신을 사용한다.
- 공개 가능한 접속 주소만 넣으며 비밀 키는 넣지 않는다. 주소를 바꾼 뒤에는 웹을 다시 배포한다.
- 친구들에게는 Vercel Production 주소를 공유한다. 첫 친구가 접속하기 전에 Render의 `/health`를 먼저 열어 서버가 준비됐는지 확인한다.

## 확인 범위

저장소 설정과 실제 외부 배포 성공은 별개다. Render 빌드·공개 주소·HTTPS/WSS·Vercel 연결·외부 4~8인 7분 경기·서버 재시작 안내는 실제 배포 후 확인한다. 동시 3개 방/24명은 부하 테스트 목표이며 Free 서버에서 검증된 처리 한도가 아니다.

첨부 설계의 준비 완료·경기 중 신규 참가 금지·30초 재접속은 기존 게임 동작과 대조가 필요한 게임 정책 항목이다. 배포 설정만으로 이 동작이 바뀌지는 않으며 별도 확인 대상으로 남긴다.

공식 문서: [Render 무료 제한](https://render.com/docs/free), [Node 서비스 배포](https://render.com/docs/deploy-node-express-app), [Blueprint](https://render.com/docs/blueprint-spec), [Vercel 모노레포](https://vercel.com/docs/monorepos/monorepo-faq).
