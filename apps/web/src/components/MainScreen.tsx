import { CampusBackdrop, EmergencyBanner } from "./CampusAtmosphere";
import type { ReactNode } from "react";
import type { ConnectionState } from "@uos-survivors/shared";
import "./MainScreen.css";

interface MainScreenProps { children: ReactNode; connectionState: ConnectionState; connectionLabel: string; }

export function MainScreen({ children, connectionState, connectionLabel }: MainScreenProps) {
  return <main className="main-screen">

  <CampusBackdrop />
  <EmergencyBanner />

  <section className="title" aria-labelledby="logo">
    <span className="eyebrow">UOS · UNIVERSITY OF SURVIVORS</span>
    <h1 className="logo" id="logo"><span className="t">시대생존록</span>
    <svg className="drips" width="420" height="40" viewBox="0 0 420 40" aria-hidden="true"><path d="M40 0 v18 q0 6 4 6 q4 0 4 -6 V0 M150 0 v28 q0 7 5 7 q5 0 5 -7 V0 M300 0 v14 q0 5 3 5 q3 0 3 -5 V0" fill="#D9483B" opacity=".85"/></svg><small>UOS: University of Survivors</small></h1>
    <p className="tag">밤 11시 59분, 캠퍼스에 남은 시대생은 당신뿐이 아니다.<br /><em>오늘 1교시는 휴강이 아니다.</em></p>
    <div className="meta"><span><i className={`dot dot-${connectionState}`} />{connectionLabel}</span><span>v0.1 · 서울시립대학교 캠퍼스</span></div>
  </section>


{children}
<div className="foot">ⓒ 시대생존록 팀 · 서울시립대학교를 배경으로 한 팬메이드 게임</div>
</main>;
}
