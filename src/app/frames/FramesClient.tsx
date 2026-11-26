
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CSSProperties,
  TouchEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";

import framesData from "./frames.json";
import "./frames.css";

type PhotoSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Frame = {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  photoSlots: PhotoSlot[];
};

type PhotoCrop = {
  zoom: number;
  centerX: number;
  centerY: number;
};

type PhotoDimension = {
  width: number;
  height: number;
};

type PointerPosition = {
  x: number;
  y: number;
};

const frames = framesData.frames as Frame[];

const DEFAULT_CROP: PhotoCrop = {
  zoom: 1,
  centerX: 0.5,
  centerY: 0.5,
};

// 이미지 불러오기
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));

    image.src = src;
  });
}

// 사진이 슬롯 밖으로 나가지 않도록 크롭 위치 제한
function clampCrop(
  crop: PhotoCrop,
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number
): PhotoCrop {
  const baseScale = Math.max(
    slotWidth / imageWidth,
    slotHeight / imageHeight
  );

  const renderedWidth = imageWidth * baseScale * crop.zoom;
  const renderedHeight = imageHeight * baseScale * crop.zoom;

  const minCenterX = slotWidth / (2 * renderedWidth);
  const maxCenterX = 1 - minCenterX;

  const minCenterY = slotHeight / (2 * renderedHeight);
  const maxCenterY = 1 - minCenterY;

  return {
    zoom: Math.max(1, Math.min(4, crop.zoom)),
    centerX: Math.max(
      minCenterX,
      Math.min(maxCenterX, crop.centerX)
    ),
    centerY: Math.max(
      minCenterY,
      Math.min(maxCenterY, crop.centerY)
    ),
  };
}

// 화면에 표시할 사진 위치 계산
function getPhotoStyle(
  crop: PhotoCrop,
  dimensions: PhotoDimension | null,
  slot: PhotoSlot
): CSSProperties {
  if (!dimensions) {
    return {
      left: "0%",
      top: "0%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    };
  }

  const safeCrop = clampCrop(
    crop,
    dimensions.width,
    dimensions.height,
    slot.width,
    slot.height
  );

  const baseScale = Math.max(
    slot.width / dimensions.width,
    slot.height / dimensions.height
  );

  const renderedWidth =
    dimensions.width * baseScale * safeCrop.zoom;

  const renderedHeight =
    dimensions.height * baseScale * safeCrop.zoom;

  const left =
    slot.width / 2 - safeCrop.centerX * renderedWidth;

  const top =
    slot.height / 2 - safeCrop.centerY * renderedHeight;

  return {
    position: "absolute",
    left: `${(left / slot.width) * 100}%`,
    top: `${(top / slot.height) * 100}%`,
    width: `${(renderedWidth / slot.width) * 100}%`,
    height: `${(renderedHeight / slot.height) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
  };
}

// 최종 JPG에 사용할 원본 사진 크롭 좌표
function getCropRect(
  crop: PhotoCrop,
  imageWidth: number,
  imageHeight: number,
  slot: PhotoSlot
) {
  const safeCrop = clampCrop(
    crop,
    imageWidth,
    imageHeight,
    slot.width,
    slot.height
  );

  const baseScale = Math.max(
    slot.width / imageWidth,
    slot.height / imageHeight
  );

  const scale = baseScale * safeCrop.zoom;

  const sourceWidth = slot.width / scale;
  const sourceHeight = slot.height / scale;

  const sourceX = safeCrop.centerX * imageWidth - sourceWidth / 2;
  const sourceY = safeCrop.centerY * imageHeight - sourceHeight / 2;

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
  };
}

export default function FramesClient() {
  const router = useRouter();

  const [photos, setPhotos] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [count, setCount] = useState(4);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 사진 원본 크기
  const [photoDimensions, setPhotoDimensions] = useState<
    (PhotoDimension | null)[]
  >([null, null, null, null]);

  // 사진 4장의 크롭 설정을 각각 저장
  const [photoCrops, setPhotoCrops] = useState<PhotoCrop[]>([
    { ...DEFAULT_CROP },
    { ...DEFAULT_CROP },
    { ...DEFAULT_CROP },
    { ...DEFAULT_CROP },
  ]);

  // 사진 편집 모달
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // 터치 및 포인터 관리
  const touchStartX = useRef(0);
  const cropViewportRef = useRef<HTMLDivElement | null>(null);
  const pointerPositions = useRef<Map<number, PointerPosition>>(new Map());

  const gestureRef = useRef({
    lastX: 0,
    lastY: 0,
    initialDistance: 0,
    initialZoom: 1,
  });

  const originalCropRef = useRef<PhotoCrop | null>(null);

  const currentFrame = frames[currentIndex];

  const editingSlot =
    editingIndex !== null
      ? currentFrame?.photoSlots[editingIndex]
      : null;

  const editingPhoto =
    editingIndex !== null ? photos[editingIndex] : null;

  const editingCrop =
    editingIndex !== null
      ? photoCrops[editingIndex]
      : DEFAULT_CROP;

  const editingDimensions =
    editingIndex !== null
      ? photoDimensions[editingIndex]
      : null;

  // 촬영 페이지에서 사진 불러오기
  useEffect(() => {
    try {
      const savedPhotos = sessionStorage.getItem("kokshot-photos");
      const savedCount = sessionStorage.getItem("kokshot-count");

      if (savedPhotos) {
        const parsedPhotos: unknown = JSON.parse(savedPhotos);

        if (
          Array.isArray(parsedPhotos) &&
          parsedPhotos.every((photo) => typeof photo === "string")
        ) {
          setPhotos(parsedPhotos);
        }
      }

      if (savedCount) {
        const parsedCount = Number(savedCount);

        if (parsedCount === 1 || parsedCount === 4) {
          setCount(parsedCount);
        }
      }
    } catch (error) {
      console.error("사진을 불러오지 못했습니다.", error);
      setErrorMessage("사진을 불러오지 못했습니다.");
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 사진 원본 크기 저장
  function handlePhotoLoad(index: number, image: HTMLImageElement) {
    setPhotoDimensions((previous) => {
      const next = [...previous];

      next[index] = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };

      return next;
    });
  }

  // 크롭 설정 변경
  function updatePhotoCrop(
    index: number,
    nextCrop: PhotoCrop
  ) {
    const dimensions = photoDimensions[index];
    const slot = currentFrame?.photoSlots[index];

    if (!dimensions || !slot) return;

    const safeCrop = clampCrop(
      nextCrop,
      dimensions.width,
      dimensions.height,
      slot.width,
      slot.height
    );

    setPhotoCrops((previous) =>
      previous.map((crop, photoIndex) =>
        photoIndex === index ? safeCrop : crop
      )
    );
  }

  // 사진 편집 열기
  function openPhotoEditor(index: number) {
    if (!photos[index]) return;

    originalCropRef.current = { ...photoCrops[index] };

    setEditingIndex(index);
    setIsEditorOpen(true);
  }

  // 사진 편집 닫기
  function closePhotoEditor(save: boolean) {
    if (!save && editingIndex !== null && originalCropRef.current) {
      const originalCrop = originalCropRef.current;

      setPhotoCrops((previous) =>
        previous.map((crop, index) =>
          index === editingIndex ? originalCrop : crop
        )
      );
    }

    setIsEditorOpen(false);
    setEditingIndex(null);

    originalCropRef.current = null;
    pointerPositions.current.clear();
  }

  // 이전 프레임
  function showPreviousFrame() {
    setCurrentIndex((previous) =>
      previous === 0 ? frames.length - 1 : previous - 1
    );
  }

  // 다음 프레임
  function showNextFrame() {
    setCurrentIndex((previous) =>
      previous === frames.length - 1 ? 0 : previous + 1
    );
  }

  // 프레임 스와이프
  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const touchEndX = e.changedTouches[0]?.clientX ?? 0;
    const distance = touchEndX - touchStartX.current;

    if (Math.abs(distance) < 50) return;

    if (distance > 0) {
      showPreviousFrame();
    } else {
      showNextFrame();
    }
  }

  // 두 손가락 사이 거리
  function getPointerDistance(
    first: PointerPosition,
    second: PointerPosition
  ) {
    return Math.hypot(
      second.x - first.x,
      second.y - first.y
    );
  }

  // 편집 영역 포인터 시작
  function handleEditorPointerDown(
    e: ReactPointerEvent<HTMLDivElement>
  ) {
    if (editingIndex === null) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    pointerPositions.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });

    if (pointerPositions.current.size === 2) {
      const points = Array.from(pointerPositions.current.values());

      gestureRef.current.initialDistance = getPointerDistance(
        points[0],
        points[1]
      );

      gestureRef.current.initialZoom = photoCrops[editingIndex].zoom;
    } else {
      gestureRef.current.lastX = e.clientX;
      gestureRef.current.lastY = e.clientY;
    }
  }

  // 편집 영역 포인터 이동
  function handleEditorPointerMove(
    e: ReactPointerEvent<HTMLDivElement>
  ) {
    if (editingIndex === null || !editingSlot) return;

    const previousPosition = pointerPositions.current.get(e.pointerId);

    if (!previousPosition) return;

    pointerPositions.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });

    // 두 손가락: 확대 및 축소
    if (pointerPositions.current.size >= 2) {
      const points = Array.from(pointerPositions.current.values());

      const currentDistance = getPointerDistance(
        points[0],
        points[1]
      );

      const initialDistance = gestureRef.current.initialDistance;

      if (initialDistance > 0) {
        const zoom =
          gestureRef.current.initialZoom *
          (currentDistance / initialDistance);

        updatePhotoCrop(editingIndex, {
          ...photoCrops[editingIndex],
          zoom,
        });
      }

      return;
    }

    // 한 손가락 또는 마우스: 사진 이동
    const dimensions = photoDimensions[editingIndex];
    const viewport = cropViewportRef.current;

    if (!dimensions || !viewport) return;

    const rect = viewport.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const deltaX = e.clientX - gestureRef.current.lastX;
    const deltaY = e.clientY - gestureRef.current.lastY;

    gestureRef.current.lastX = e.clientX;
    gestureRef.current.lastY = e.clientY;

    const crop = photoCrops[editingIndex];

    const baseScale = Math.max(
      editingSlot.width / dimensions.width,
      editingSlot.height / dimensions.height
    );

    const renderedWidth =
      dimensions.width * baseScale * crop.zoom;

    const renderedHeight =
      dimensions.height * baseScale * crop.zoom;

    const logicalDeltaX =
      (deltaX * editingSlot.width) / rect.width;

    const logicalDeltaY =
      (deltaY * editingSlot.height) / rect.height;

    updatePhotoCrop(editingIndex, {
      ...crop,
      centerX: crop.centerX - logicalDeltaX / renderedWidth,
      centerY: crop.centerY - logicalDeltaY / renderedHeight,
    });
  }

  // 포인터 종료
  function handleEditorPointerUp(
    e: ReactPointerEvent<HTMLDivElement>
  ) {
    pointerPositions.current.delete(e.pointerId);

    const remaining = Array.from(pointerPositions.current.values());

    if (remaining.length === 1) {
      gestureRef.current.lastX = remaining[0].x;
      gestureRef.current.lastY = remaining[0].y;
    }

    if (remaining.length < 2) {
      gestureRef.current.initialDistance = 0;
    }
  }

  // 마우스 휠 확대 및 축소
  function handleEditorWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (editingIndex === null) return;

    e.preventDefault();

    const currentCrop = photoCrops[editingIndex];

    const zoom =
      currentCrop.zoom + (e.deltaY < 0 ? 0.1 : -0.1);

    updatePhotoCrop(editingIndex, {
      ...currentCrop,
      zoom,
    });
  }

  // 최종 JPG 다운로드
  async function downloadFrame() {
    if (!currentFrame || isDownloading) return;

    setIsDownloading(true);
    setErrorMessage("");

    try {
      const canvas = document.createElement("canvas");

      canvas.width = currentFrame.width;
      canvas.height = currentFrame.height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("이미지를 합성할 수 없습니다.");
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 사진 4장을 각각 불러오기
      const photoImages = await Promise.all(
        photos.map((photo) => loadImage(photo))
      );

      // 각 사진을 해당 슬롯에 개별 크롭하여 배치
      for (let index = 0; index < currentFrame.photoSlots.length; index++) {
        const slot = currentFrame.photoSlots[index];
        const photoImage = photoImages[index];

        if (!slot || !photoImage) continue;

        const crop = photoCrops[index] ?? DEFAULT_CROP;

        const cropRect = getCropRect(
          crop,
          photoImage.naturalWidth,
          photoImage.naturalHeight,
          slot
        );

        ctx.save();

        // 슬롯 영역 밖으로 사진이 나가지 않도록 클리핑
        ctx.beginPath();
        ctx.rect(slot.x, slot.y, slot.width, slot.height);
        ctx.clip();

        ctx.drawImage(
          photoImage,
          cropRect.sourceX,
          cropRect.sourceY,
          cropRect.sourceWidth,
          cropRect.sourceHeight,
          slot.x,
          slot.y,
          slot.width,
          slot.height
        );

        ctx.restore();
      }

      // 프레임 PNG를 가장 마지막에 합성
      const frameImage = await loadImage(currentFrame.image);

      ctx.drawImage(
        frameImage,
        0,
        0,
        currentFrame.width,
        currentFrame.height
      );

      // JPG 생성
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("JPG 파일을 생성하지 못했습니다."));
            }
          },
          "image/jpeg",
          0.95
        );
      });

      // 다운로드
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;

      const today = new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("");

      link.download = `kokshot_${date}.jpg`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("JPG 다운로드 오류:", error);

      setErrorMessage(
        "이미지 저장에 실패했습니다. 사진과 프레임 파일을 확인해 주세요."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  // 로딩
  if (!isLoaded) {
    return (
      <main className="frames-loading">
        사진을 불러오는 중입니다...
      </main>
    );
  }

  // 사진 4장 확인
  if (photos.length !== 4 || photos.some((photo) => !photo)) {
    return (
      <main className="frames-message-page">
        <h2>촬영한 사진을 찾을 수 없어요.</h2>
        <p>사진 4장을 다시 촬영해 주세요.</p>

        <button
          type="button"
          className="frames-primary-button"
          onClick={() => router.push("/camera?count=4")}
        >
          사진 촬영하러 가기
        </button>
      </main>
    );
  }

  if (!currentFrame) {
    return (
      <main className="frames-loading">
        프레임을 불러올 수 없습니다.
      </main>
    );
  }

  return (
    <main className="frames-page">
      {/* 상단 안내 */}
      <header className="frames-header">
        <p className="frames-step">STEP 03</p>

        <h1>마음에 드는 프레임을 골라보세요!</h1>

        <p className="frames-description">
          사진을 누르면 원하는 위치로 조정할 수 있어요.
        </p>
      </header>

      {/* 프레임 미리보기 */}
      <section className="frames-preview-section">
        <button
          type="button"
          className="frames-arrow"
          onClick={showPreviousFrame}
          aria-label="이전 프레임"
        >
          ‹
        </button>

        <div
          className="frames-preview"
          style={
            {
              "--frame-ratio": `${currentFrame.width} / ${currentFrame.height}`,
              "--frame-max-width": `${Math.min(
                420,
                (currentFrame.width / currentFrame.height) * 620
              )}px`,
            } as CSSProperties
          }
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* 사진 4장: 각각 독립된 슬롯 */}
          {currentFrame.photoSlots.map((slot, index) => (
            <button
              key={`${currentFrame.id}-${index}`}
              type="button"
              className="frames-photo-slot"
              aria-label={`${index + 1}번 사진 편집`}
              onClick={() => openPhotoEditor(index)}
              style={{
                left: `${(slot.x / currentFrame.width) * 100}%`,
                top: `${(slot.y / currentFrame.height) * 100}%`,
                width: `${(slot.width / currentFrame.width) * 100}%`,
                height: `${(slot.height / currentFrame.height) * 100}%`,
              }}
            >
              <img
                src={photos[index]}
                alt={`촬영 사진 ${index + 1}`}
                className="frames-photo"
                draggable={false}
                onLoad={(e) =>
                  handlePhotoLoad(index, e.currentTarget)
                }
                style={getPhotoStyle(
                  photoCrops[index],
                  photoDimensions[index],
                  slot
                )}
              />
            </button>
          ))}

          {/* 프레임 PNG */}
          <img
            src={currentFrame.image}
            alt={currentFrame.name}
            className="frames-overlay"
            draggable={false}
          />
        </div>

        <button
          type="button"
          className="frames-arrow"
          onClick={showNextFrame}
          aria-label="다음 프레임"
        >
          ›
        </button>
      </section>

      {/* 프레임 선택 표시 */}
      <div className="frames-indicators">
        {frames.map((frame, index) => (
          <button
            key={frame.id}
            type="button"
            className={`frames-indicator ${
              index === currentIndex ? "active" : ""
            }`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`${index + 1}번 프레임 선택`}
          />
        ))}
      </div>

      {/* 하단 버튼 */}
      <section className="frames-actions">
        <button
          type="button"
          className="frames-download-button"
          onClick={downloadFrame}
          disabled={isDownloading}
        >
          {isDownloading ? "이미지 만드는 중..." : "JPG 다운로드"}
        </button>

        <button
          type="button"
          className="frames-retake-button"
          onClick={() => router.push(`/camera?count=${count}`)}
        >
          {count}컷 다시 촬영
        </button>
      </section>

      {errorMessage && (
        <p className="frames-error">{errorMessage}</p>
      )}

      {/* 사진 편집 모달 */}
      {isEditorOpen &&
        editingIndex !== null &&
        editingSlot &&
        editingPhoto && (
          <div className="crop-editor-backdrop">
            <section
              className="crop-editor-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${editingIndex + 1}번 사진 편집`}
            >
              <header className="crop-editor-header">
                <h2>{editingIndex + 1}번 사진 편집</h2>

                <button
                  type="button"
                  className="crop-editor-close"
                  onClick={() => closePhotoEditor(false)}
                  aria-label="편집 취소"
                >
                  ×
                </button>
              </header>

              {/* 슬롯 비율과 동일한 고정 편집 영역 */}
              <div
                ref={cropViewportRef}
                className="crop-editor-viewport"
                style={{
                  aspectRatio: `${editingSlot.width} / ${editingSlot.height}`,
                }}
                onPointerDown={handleEditorPointerDown}
                onPointerMove={handleEditorPointerMove}
                onPointerUp={handleEditorPointerUp}
                onPointerCancel={handleEditorPointerUp}
                onWheel={handleEditorWheel}
              >
                <img
                  src={editingPhoto}
                  alt={`${editingIndex + 1}번 사진 편집 미리보기`}
                  className="crop-editor-image"
                  draggable={false}
                  onLoad={(e) =>
                    handlePhotoLoad(editingIndex, e.currentTarget)
                  }
                  style={getPhotoStyle(
                    editingCrop,
                    editingDimensions,
                    editingSlot
                  )}
                />
              </div>

              <p className="crop-editor-guide">
                사진을 드래그하거나 두 손가락으로 확대·축소해 보세요.
                <br />
                사진은 프레임 영역 안에서만 움직입니다.
              </p>

              <div className="crop-editor-actions">
                <button
                  type="button"
                  className="crop-editor-cancel"
                  onClick={() => closePhotoEditor(false)}
                >
                  취소
                </button>

                <button
                  type="button"
                  className="crop-editor-complete"
                  onClick={() => closePhotoEditor(true)}
                >
                  완료
                </button>
              </div>
            </section>
          </div>
        )}
    </main>
  );
}
