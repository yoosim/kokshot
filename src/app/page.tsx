// main 페이지의 기본 구조

import Link from "next/link";
import "./home.css";

export default function Home() {
  return (
    <main className="home">

      <section className="home__content">

        {/* 영문 상단 문구 */}
        <p className="home__eyebrow">
          PHOTO STUDIO
        </p>

        {/* 메인 타이틀 */}
        <h1 className="home__title">
          콕<span>샷</span>
        </h1>

        {/* 영문 브랜드명 */}
        <p className="home__brand">
          KOKSHOT
        </p>

        {/* 서비스 소개 */}
        <div className="home__description">
          <p className="home__headline">
            오늘의 플레이를
            <br />
            나만의 인증샷으로!
          </p>

          <p className="home__subtext">
            사진 촬영 또는 앨범 속 사진으로
            <br />
            나만의 배드민턴 인증샷을 꾸며보세요!
          </p>
        </div>

        {/* 시작하기 버튼 */}
        <Link href="/photo" className="home__button">
          <span>시작하기</span>
          <span className="home__button-icon">→</span>
        </Link>

        {/* 하단 문구 */}
        <p className="home__footer">
          EVERY SHOT, YOUR MOMENT.
        </p>

      </section>

    </main>
  );
}
