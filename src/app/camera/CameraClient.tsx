
// 실제 카메라 작동, 사진 촬영, 미리보기 등 실제 기능 구현 

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./camera.css";

type CameraClientProps = {
  count: number;
};

export default function CameraClient({ count }: CameraClientProps) {
  const router = useRouter();

  // 카메라 영상과 셔터음 요소
  const videoRef = useRef<HTMLVideoElement>(null);
  const shutterRef = useRef<HTMLAudioElement>(null);

  // 카운트다운 효과음 생성용
  const audioContextRef = useRef<AudioContext | null>(null);

  // 카메라 종류: user = 전면, environment = 후면
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // 좌우반전 상태
  const [isMirrored, setIsMirrored] = useState(true);

  // 카메라 연결 상태
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // 촬영 상태
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // 촬영한 사진 저장
  const [photos, setPhotos] = useState<string[]>([]);

  // 카메라 연결 및 전환
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function connectCamera() {
      setIsCameraReady(false);
      setCameraError("");

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
        }

        // 선택한 방향의 카메라 요청
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        // 카메라 전환 중 이전 요청이 끝났다면 스트림 종료
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setCameraError(
            error instanceof Error
              ? error.message
              : "카메라를 연결하지 못했습니다."
          );
        }
      }
    }

    connectCamera();

    // 페이지를 벗어나거나 카메라를 전환하면 기존 스트림 종료
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  // 촬영 완료 후 다시 카메라를 표시하면 영상 재생 재개
  useEffect(() => {
    if (isFinished) return;

    const video = videoRef.current;

    if (video && video.srcObject) {
      video.play().catch(() => {
        setCameraError("카메라 영상을 다시 불러오지 못했습니다.");
      });
    }
  }, [isFinished]);

  // 페이지를 벗어날 때 카운트다운 오디오 정리
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // 전면 카메라와 후면 카메라 전환
  function switchCamera() {
    if (isCapturing) return;

    setFacingMode((current) =>
      current === "user" ? "environment" : "user"
    );
  }

  // 카운트다운 효과음 생성
  async function playCountdownSound() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const audio = audioContextRef.current;

    if (audio.state !== "running") {
      await audio.resume();
    }

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audio.currentTime);

    gain.gain.setValueAtTime(0.15, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + 0.18
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);

    // 효과음이 끝나면 다음 숫자로 이동
    const soundEnded = new Promise<void>((resolve) => {
      oscillator.onended = () => {
        resolve();
      };
    });

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.18);

    await soundEnded;
  }

  // 셔터 MP3 재생
  async function playShutterSound() {
    const audio = shutterRef.current;
    if (!audio) return;

    audio.currentTime = 0;

    // ended 이벤트를 먼저 등록해 재생 완료 이벤트를 놓치지 않도록 함
    const soundEnded = new Promise<void>((resolve) => {
      audio.addEventListener("ended", () => resolve(), { once: true });
    });

    try {
      await audio.play();
      await soundEnded;
    } catch {
      // 소리 재생에 실패해도 촬영은 계속 진행
    }
  }

  // 지정한 시간만큼 대기
  function wait(milliseconds: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  // 현재 카메라 화면을 사진으로 저장
  function capturePhoto() {
    const video = videoRef.current;

    if (!video || video.readyState < 2) {
      throw new Error("카메라 화면이 아직 준비되지 않았습니다.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("사진을 저장할 수 없습니다.");
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 좌우반전 설정을 실제 저장 사진에도 적용
    if (isMirrored) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.9);
  }

  // 5초 카운트다운
  async function runCountdown() {
    for (let number = 5; number >= 1; number--) {
      setCountdown(number);
      await playCountdownSound();
      await wait(820);
    }

    setCountdown(null);
  }

  // 촬영 시작 및 다시 촬영
  async function startCapture() {
    if (isCapturing || !isCameraReady) return;

    setIsCapturing(true);
    setIsFinished(false);
    setPhotos([]);

    try {
      // 사용자 클릭 시 오디오 실행 권한 확보
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      if (audioContextRef.current.state !== "running") {
        await audioContextRef.current.resume();
      }

      const capturedPhotos: string[] = [];

      // 1컷 또는 4컷 촬영
      for (let i = 0; i < count; i++) {
        await runCountdown();
        await playShutterSound();

        const photo = capturePhoto();

        capturedPhotos.push(photo);
        setPhotos([...capturedPhotos]);
      }

      // 모든 촬영이 끝나면 결과 화면으로 전환
      setIsFinished(true);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "사진 촬영 중 문제가 발생했습니다."
      );
    } finally {
      setCountdown(null);
      setIsCapturing(false);
    }
  }

  // 이전 페이지 이동
  function goBack(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const confirmed = window.confirm(
      "이전 페이지로 이동하면 촬영한 사진이 초기화됩니다.\n이동하시겠습니까?"
    );

    if (confirmed) {
      router.push("/count?source=camera");
    }
  }

  // 프레임 선택 페이지 이동
  function goToFrames() {
    // 촬영한 사진 4장을 브라우저 임시 저장소에 보관
    sessionStorage.setItem(
      "kokshot-photos",
      JSON.stringify(photos)
    );

    // 촬영 장수 정보도 함께 저장
    sessionStorage.setItem(
      "kokshot-count",
      String(count)
    );

    // 프레임 선택 페이지로 이동
    router.push(`/frames?count=${count}`);
  }

  return (
    <main className="camera">
      <section className="camera__content">

        {/* 상단 페이지 이동 및 단계 표시 */}
        <header className="camera__header">
          <Link
            href="/count?source=camera"
            className="camera__back"
            onClick={goBack}
          >
            ← 이전으로
          </Link>

          <span className="camera__step">03 / CAMERA</span>
        </header>

        {/* 페이지 제목 */}
        <div className="camera__intro">
          <p className="camera__eyebrow">READY, SET, SHOT!</p>

          <h1 className="camera__title">
            {isFinished ? (
              "촬영 완료!"
            ) : (
              <>
                오늘의 순간을
                <br />
                담아볼까요<span>?</span>
              </>
            )}
          </h1>

          <p className="camera__description">
            {isFinished
              ? "촬영한 사진을 확인하고 다음 단계로 이동해 주세요."
              : "카메라를 준비하고 촬영을 시작해주세요."}
          </p>
        </div>

        {/* 상단 사진 미리보기: 1컷 또는 4컷 */}
        <div className={`camera__thumbnail-section ${count === 1 ? "is-single" : "is-multiple"}`}>
          <div className="camera__thumbnail-header">
            <span>PHOTO PREVIEW</span>
            <span>{photos.length} / {count}</span>
          </div>

          <div className="camera__thumbnails">
            {Array.from({ length: count }, (_, index) => (
              <div className="camera__thumbnail" key={index}>
                {photos[index] ? (
                  <img
                    src={photos[index]}
                    alt={`${index + 1}번째 사진`}
                  />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 촬영 전과 촬영 중에만 카메라 표시 */}
        {/* 카메라 영역: 촬영 완료 후 화면에서만 숨김 */}
        <div
          className={`camera__camera-area ${
            isFinished ? "is-hidden" : ""
          }`}
        >
          {/* 실시간 카메라 미리보기 */}
          <div className="camera__preview">
            <video
              ref={videoRef}
              className={`camera__video ${
                isMirrored ? "is-mirrored" : ""
              }`}
              autoPlay
              playsInline
              muted
            />

            {/* 카메라 연결 중 또는 오류 표시 */}
            {!isCameraReady && (
              <div className="camera__loading">
                <span>
                  {cameraError || "카메라 연결 중..."}
                </span>
              </div>
            )}

            {/* 카운트다운 숫자 */}
            {countdown !== null && (
              <div className="camera__countdown">
                {countdown}
              </div>
            )}

            {/* 촬영 순간 플래시 효과 */}
            {isCapturing && countdown === null && (
              <div className="camera__shot-flash" />
            )}

            {/* 카메라 화면 안의 작은 조작 버튼 */}
            {isCameraReady && !isCapturing && (
              <div className="camera__controls">
                <button
                  type="button"
                  className={`camera__control ${
                    isMirrored ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setIsMirrored((current) => !current)
                  }
                >
                  ↔ 좌우반전
                </button>

                <button
                  type="button"
                  className="camera__control"
                  onClick={switchCamera}
                >
                  ⟳ 카메라 전환
                </button>
              </div>
            )}
          </div>

          {/* 촬영 버튼 */}
          <button
            type="button"
            className="camera__capture"
            onClick={startCapture}
            disabled={!isCameraReady || isCapturing}
          >
            {isCapturing
              ? "촬영 중..."
              : count === 1
                ? "촬영하기"
                : "자동 촬영하기"}
          </button>

          {/* 촬영 진행 상황 */}
          {isCapturing && (
            <p className="camera__progress">
              {photos.length + 1} / {count} 번째 사진 촬영 중
            </p>
          )}
        </div>

        {/* 촬영 완료 후 버튼 */}
        {isFinished && (
          <div className="camera__result">
            <p>{photos.length}장의 사진을 촬영했어요.</p>

            <div className="camera__result-buttons">
              <button
                type="button"
                className="camera__retry"
                onClick={startCapture}
              >
                ↻ 다시 촬영하기
              </button>

              <button
                type="button"
                className="camera__next"
                onClick={goToFrames}
              >
                프레임 선택하기 →
              </button>
            </div>
          </div>
        )}

        {/* 하단 문구 */}
        <footer className="camera__footer">
          EVERY SHOT, YOUR MOMENT.
        </footer>

        {/* 셔터 소리 파일 */}
        <audio
          ref={shutterRef}
          src="/sounds/shutter.mp3"
          preload="auto"
        />

      </section>
    </main>
  );
}
