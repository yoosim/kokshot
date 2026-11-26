
"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import "./album.css";

const PHOTO_COUNT = 4;

type PhotoItem = string | null;

// 사진을 줄여서 브라우저 저장 공간을 절약
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 1600;
        const scale = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("이미지를 처리할 수 없습니다."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      image.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export default function AlbumClient() {
  const router = useRouter();

  const [photos, setPhotos] = useState<PhotoItem[]>([
    null,
    null,
    null,
    null,
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const initialInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const selectedCount = photos.filter(Boolean).length;
  const isComplete = selectedCount === PHOTO_COUNT;

  // 처음 사진 여러 장 선택
  async function handleInitialSelect(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? []).slice(0, PHOTO_COUNT);

    if (files.length === 0) return;

    setIsLoading(true);
    setMessage("");

    try {
      const convertedPhotos = await Promise.all(
        files.map((file) => compressImage(file))
      );

      const nextPhotos: PhotoItem[] = [
        ...convertedPhotos,
        ...Array(PHOTO_COUNT - convertedPhotos.length).fill(null),
      ];

      setPhotos(nextPhotos);
    } catch {
      setMessage("사진을 불러오지 못했어요. 다시 선택해 주세요.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  // 비어 있는 칸에 사진 한 장 추가
  async function handleReplace(
    event: ChangeEvent<HTMLInputElement>,
    index: number
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsLoading(true);
    setMessage("");

    try {
      const convertedPhoto = await compressImage(file);

      setPhotos((current) =>
        current.map((photo, photoIndex) =>
          photoIndex === index ? convertedPhoto : photo
        )
      );
    } catch {
      setMessage("사진을 불러오지 못했어요. 다시 선택해 주세요.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  // 해당 위치의 사진 삭제
  function handleDelete(index: number) {
    setPhotos((current) =>
      current.map((photo, photoIndex) =>
        photoIndex === index ? null : photo
      )
    );

    setMessage("");
  }

  // 프레임 선택 페이지로 이동
  function goToFrames() {
    if (!isComplete || isLoading) return;

    const completedPhotos = photos.filter(
      (photo): photo is string => photo !== null
    );

    try {
      sessionStorage.setItem(
        "kokshot-photos",
        JSON.stringify(completedPhotos)
      );

      sessionStorage.setItem("kokshot-count", "4");

      router.push("/frames?count=4");
    } catch {
      setMessage("사진을 저장할 공간이 부족해요. 사진 크기를 줄여 다시 시도해 주세요.");
    }
  }

  return (
    <main className="album">
      <section className="album__content">
        <header className="album__header">
          <button
            type="button"
            className="album__back"
            onClick={() => router.push("/photo")}
          >
            ← 이전으로
          </button>

          <span className="album__step">02 / 앨범 선택</span>
        </header>

        <div className="album__intro">
          <p className="album__eyebrow">PHOTO ALBUM</p>

          <h1 className="album__title">
            오늘의 순간을<br />
            골라볼까요<span>?</span>
          </h1>

          <p className="album__description">
            사진 4장을 선택해 주세요.
            <br />
            비어 있는 칸을 눌러 사진을 추가할 수 있어요.
          </p>
        </div>

        <input
          ref={initialInputRef}
          type="file"
          accept="image/*"
          multiple
          className="album__hidden-input"
          onChange={handleInitialSelect}
        />

        {selectedCount === 0 ? (
          <button
            type="button"
            className="album__select-button"
            onClick={() => initialInputRef.current?.click()}
            disabled={isLoading}
          >
            <span className="album__select-icon">＋</span>
            <strong>사진 4장 선택하기</strong>
            <span>휴대폰 앨범 또는 PC에서 불러오기</span>
          </button>
        ) : (
          <div className="album__photo-area">
            <div className="album__photo-heading">
              <strong>선택한 사진</strong>
              <span>{selectedCount} / 4</span>
            </div>

            <div className="album__grid">
              {photos.map((photo, index) => (
                <div className="album__slot" key={index}>
                  {photo ? (
                    <>
                      <img
                        src={photo}
                        alt={`${index + 1}번 사진`}
                        className="album__image"
                      />

                      <span className="album__slot-number">
                        0{index + 1}
                      </span>

                      <button
                        type="button"
                        className="album__delete"
                        onClick={() => handleDelete(index)}
                        aria-label={`${index + 1}번 사진 삭제`}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="album__empty"
                      onClick={() =>
                        slotInputRefs.current[index]?.click()
                      }
                      disabled={isLoading}
                    >
                      <span>＋</span>
                      <strong>사진 추가</strong>
                      <small>0{index + 1}</small>
                    </button>
                  )}

                  <input
                    ref={(element) => {
                      slotInputRefs.current[index] = element;
                    }}
                    type="file"
                    accept="image/*"
                    className="album__hidden-input"
                    onChange={(event) => handleReplace(event, index)}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              className="album__add-more"
              onClick={() => initialInputRef.current?.click()}
              disabled={isLoading}
            >
              사진 다시 선택하기
            </button>
          </div>
        )}

        {message && <p className="album__message">{message}</p>}

        {isLoading && (
          <p className="album__loading">사진을 불러오는 중...</p>
        )}

        <button
          type="button"
          className="album__next"
          onClick={goToFrames}
          disabled={!isComplete || isLoading}
        >
          프레임 선택하기 <span>→</span>
        </button>

        <footer className="album__footer">
          YOUR GAME, YOUR MOMENT.
        </footer>
      </section>
    </main>
  );
}
