
import Link from "next/link";
import "./photo.css";

export default function PhotoPage() {
  return (
    <main className="photo">
      <section className="photo__content">
        <header className="photo__header">
          <Link href="/" className="photo__back">
            ← 처음으로
          </Link>

          <span className="photo__step">
            01 / 사진 촬영 선택
          </span>
        </header>

        <div className="photo__intro">
          <p className="photo__eyebrow">촬영 방식</p>

          <h1 className="photo__title">
            어떻게<br />
            촬영할까요<span>?</span>
          </h1>

          <p className="photo__description">
            오늘의 플레이를 기록할 방법을 선택해 주세요.
          </p>
        </div>

        <div className="photo__options">
          <Link href="/count?source=camera" className="photo-card">
            <div className="photo-card__top">
              <span className="photo-card__number">01</span>
              <span className="photo-card__icon">📸</span>
            </div>

            <div className="photo-card__info">
              <h2>카메라 촬영</h2>
              <p>지금 바로 사진 찍기</p>
            </div>

            <div className="photo-card__action">
              <span>선택하기</span>
              <span>→</span>
            </div>
          </Link>

          <Link href="/album" className="photo-card">
            <div className="photo-card__top">
              <span className="photo-card__number">02</span>
              <span className="photo-card__icon">🖼️</span>
            </div>

            <div className="photo-card__info">
              <h2>앨범 선택</h2>
              <p>기존 사진 가져오기</p>
            </div>

            <div className="photo-card__action">
              <span>선택하기</span>
              <span>→</span>
            </div>
          </Link>
        </div>

        <footer className="photo__footer">
          YOUR GAME, YOUR MOMENT.
        </footer>
      </section>
    </main>
  );
}
