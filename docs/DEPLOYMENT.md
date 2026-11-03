# Vercel + Railway 첫 테스트 배포

진행 순서: Railway 계정 → 게임 서버 → 공개 주소 확인 → Vercel 웹 → 외부 4~8인 테스트. GitHub 저장소는 기존 `jongparks/uos-survivors`를 사용한다. DB와 Redis는 추가하지 않는다. 계정 생성·로그인·결제는 사용자가 직접 진행한다.

## 1. Railway 계정

https://railway.com 에서 GitHub로 가입한다. 저장소를 소유한 계정을 연결한다. 체험 크레딧과 Full/Limited Trial 표시를 확인한다. 무료 테스트 단계에서는 유료 플랜을 선택할 필요가 없다. 신규 사용자 체험은 최대 30일 또는 $5 소진까지이며 이후 무료 플랜의 크레딧은 월 $1이다. 이는 상시 무료 운영을 보장하지 않는다. 실제 혜택과 제한은 계정 화면에서 확인한다.

## 2. Railway 게임 서버

- GitHub 저장소에서 새 서비스를 생성한다. 저장소 접근 선택이 나오면 이 저장소만 선택할 수 있다.
- Root Directory는 저장소 루트 그대로 둔다. `apps/server`만 지정하면 공통 패키지가 빠질 수 있다.
- 루트 `railway.json`이 공유 패키지 → 서버 빌드와 Node 실행, `/health` 검사를 정의한다.
- Variables에 `NODE_ENV=production`을 설정한다. 플랫폼의 `PORT`를 사용하며 서버는 `0.0.0.0`에 바인딩한다.
- 인스턴스/Replica는 1개로 유지한다. 여러 방은 이 프로세스 안에서 관리한다.
- 배포 성공 후 Networking에서 공개 도메인을 생성한다. `https://발급주소/health`가 `status: ok`를 반환하는지 확인한다.
- GitHub 연동 자동 배포는 진행 중 경기를 끊을 수 있다. 지인 테스트 시간에는 배포를 피한다. 서버가 재시작하면 메모리의 방은 복구되지 않는다.

## 3. Vercel 웹

- 기존 Vercel 계정에서 같은 저장소를 Import한다.
- Root Directory: `apps/web`. 외부 루트 파일을 빌드에 포함하는 옵션을 켜서 `packages/shared`를 읽을 수 있게 한다.
- Framework: Vite, Output Directory: `dist`. `apps/web/vercel.json`의 빌드 명령을 사용한다.
- Node.js 24.x를 사용한다. 루트 `packageManager`는 pnpm 11.25.0이다. 플랫폼이 다른 버전을 선택하면 Corepack 설정을 확인한다.
- `VITE_GAME_SERVER_URL`에 **실제 Railway 공개 HTTPS 주소**를 설정한다. `https://...up.railway.app` 형식이면 SDK가 HTTPS 매칭과 WSS 통신을 사용한다. `wss://`도 SDK가 지원하지만 `/health` 확인은 HTTPS로 한다.
- 이 값은 브라우저에 공개되는 주소다. 비밀 키는 넣지 않는다. 주소를 바꾼 뒤에는 웹을 다시 배포한다.
- Vercel의 Production 주소를 친구들에게 공유한다. Railway 서버 주소가 아닌 웹 주소로 접속한다.

## 확인 범위

저장소의 로컬 검사와 실제 외부 배포 성공은 별개다. 서버 공개 주소 발급, HTTPS/WSS, Vercel 연결, 외부 4~8인 7분 경기, 서버 재시작 안내와 사용량은 실제 배포 후 확인한다. 동시 3개 방/24명은 부하 테스트 목표이며 검증된 처리 한도가 아니다.

첨부 설계의 준비 완료·경기 중 신규 참가 금지·30초 재접속은 기존 게임 동작과 대조가 필요한 게임 정책 항목이다. 배포 설정만으로 이 동작이 바뀌지는 않으며, 배포 전 별도 확인 대상으로 남긴다.

공식 문서: [Railway 체험](https://docs.railway.com/pricing/free-trial), [모노레포](https://docs.railway.com/deployments/monorepo), [설정 파일](https://docs.railway.com/config-as-code/reference), [Vercel 모노레포](https://vercel.com/docs/monorepos/monorepo-faq).
