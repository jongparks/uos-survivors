export function CampusBackdrop() {
  return (
<div className="campus-backdrop" aria-hidden="true">
    <svg className="campus-skyline" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
      <g fill="#060807">
        <rect x="60" y="220" width="190" height="200"/>
        <rect x="270" y="90" width="120" height="330"/>
        <rect x="410" y="250" width="150" height="170"/>
        <path d="M600 420 V230 h20 v-60 h40 v60 h20 V420 Z"/>
        <circle cx="640" cy="200" r="14" fill="#101412"/>
        <rect x="720" y="200" width="220" height="220"/>
        <rect x="960" y="260" width="140" height="160"/>
        <rect x="1120" y="160" width="160" height="260"/>
        <rect x="1300" y="240" width="140" height="180"/>
        <path d="M0 420 Q60 360 120 400 Q170 350 230 398 Q300 370 360 404 Q420 360 500 402 Q560 372 640 406 Q720 380 800 402 Q880 360 960 400 Q1040 370 1120 404 Q1200 366 1280 400 Q1360 372 1440 398 V420 Z" fill="#030403"/>
      </g>
      <path d="M640 200 L640 191 M640 200 L646 204" stroke="#A3241D" strokeWidth="2"/>
      <g fill="#E9D88A" opacity=".75">
        <rect className="campus-window" x="290" y="120" width="14" height="10"/><rect x="330" y="160" width="14" height="10" opacity=".5"/>
        <rect className="campus-window delayed" x="356" y="240" width="14" height="10"/><rect x="760" y="240" width="14" height="10" opacity=".4"/>
        <rect className="campus-window" x="1150" y="200" width="14" height="10"/><rect x="1230" y="300" width="14" height="10" opacity=".45"/>
      </g>
      <rect className="campus-window delayed" x="880" y="290" width="14" height="10" fill="#D9483B"/>
      <g fill="#000" opacity=".9">
        <path d="M470 420 l6 -38 q-8 -6 -4 -16 q4 -10 14 -8 q10 -2 12 10 q8 4 14 -4 l4 4 q-6 12 -16 12 l2 40 Z"/>
        <path d="M1010 420 l4 -34 q-6 -6 -2 -14 q4 -8 12 -6 q8 0 10 8 q-8 8 -6 14 l3 32 Z"/>
        <path d="M1380 420 l5 -30 q-6 -4 -2 -12 q4 -7 10 -5 q8 2 7 10 q8 2 12 -6 l3 3 q-4 10 -12 10 l1 30 Z"/>
      </g>
    </svg>
    <div className="campus-vignette"></div>
  </div>
  );
}

export function EmergencyBanner() {
  return (
<div className="emergency-banner" role="status" aria-live="off">
    <b>재난문자</b>
    <div className="emergency-track">[동대문구청] 서울시립대학교 일대 원인 불명 감염 확산. 건물 밖으로 나오지 말고 창문을 닫으십시오. · 중앙도서관 열람실 인원 확인 불가 · 정문·하늘문 통제 중 · 다음 안내까지 대기하십시오.</div>
  </div>
  );
}
