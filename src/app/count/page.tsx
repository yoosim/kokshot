
import { Suspense } from "react";
import CountDisabledButton from "./CountDisabledButton";
import Link from "next/link";
import "./count.css";

type CountPageProps = {
  searchParams: Promise<{
    source?: string;
  }>;
};

// URL에서 이전 페이지의 촬영 방식 확인
async function CountContent({
  searchParams,
}: CountPageProps) {
  const params = await searchParams;

  // 이전 페이지에서 선택한 촬영 방식 확인
  const source = params.source === "album" ? "album" : "camera";

  return (
    <main className="count">
      <section className="count__content">

        {/* 상단 영역 */}
        <header className="count__header">
          <Link href="/photo" className="count__back">
            ← 이전으로
          </Link>

          <span className="count__step">
            02 / 촬영 횟수 선택
          </span>
        </header>

        {/* 안내 문구 */}
        <div className="count__intro">
          <p className="count__eyebrow">
            1장 / 4장
          </p>

          <h1 className="count__title">
            몇 장의 사진을<br />
            만들까요<span>?</span>
          </h1>

          <p className="count__description">
            원하는 사진 구성을 선택해 주세요.
          </p>
        </div>

        {/* 사진 장수 선택 */}
        <div className="count__options">

          {/* 1장 선택 - 준비 중 */}
          <CountDisabledButton>
            <div className="count-card__top">
              <span className="count-card__number">
                01 CUT
              </span>
              <span className="count-card__arrow">↗</span>
            </div>

            <div className="count-card__preview">
              <div className="count-card__single">
                <span>1</span>
              </div>
            </div>

            <div className="count-card__info">
              <h2>1장</h2>
              <p>한 장의 베스트 샷</p>
            </div>

            <div className="count-card__action">
              <span>준비중</span>
              <span>→</span>
            </div>
          </CountDisabledButton>


          {/* 4장 선택 - 정상 이용 */}
          <Link
            href={`/${source}?count=4`}
            className="count-card"
          >
            <div className="count-card__top">
              <span className="count-card__number">
                04 CUT
              </span>
              <span className="count-card__arrow">↗</span>
            </div>

            <div className="count-card__preview">
              <div className="count-card__grid">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
              </div>
            </div>

            <div className="count-card__info">
              <h2>4장</h2>
              <p>네 장의 순간을 한 번에</p>
            </div>

            <div className="count-card__action">
              <span>선택하기</span>
              <span>→</span>
            </div>
          </Link>

        </div>

        {/* 하단 문구 */}
        <footer className="count__footer">
          EVERY SHOT, YOUR MOMENT.
        </footer>

      </section>
    </main>
  );
}

// 페이지 진입점
export default function CountPage({
  searchParams,
}: CountPageProps) {
  return (
    <Suspense
      fallback={
        <main className="count">
          <section className="count__content">
            <p>페이지를 준비하고 있어요...</p>
          </section>
        </main>
      }
    >
      <CountContent searchParams={searchParams} />
    </Suspense>
  );
}
