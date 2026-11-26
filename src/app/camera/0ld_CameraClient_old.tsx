// 실제 카메라 작동, 사진 촬영, 미리보기 등 실제 기능 구현 

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./camera.css";

type CameraClientProps = {
  count: number;
};

export default function CameraClient({ count }: CameraClientProps) {
  // 카메라 화면을 연결할 비디오 요소
  const videoRef = useRef<HTMLVideoElement>(null);

  // 현재 카메라 스트림
  const streamRef = useRef<MediaStream | null>(null);

  // 카운트다운 소리 생성용
  const audioContextRef = useRef<AudioContext | null>(null);

  // 셔터 소리 재생용
  const shutterRef = useRef<HTMLAudioElement>(null);

  // 카메라 방향: user = 전면, environment = 후면
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "user"
  );

  // 4컷
  const router = useRouter();

  // 좌우 반전 여부
  const [isMirrored, setIsMirrored] = useState(true);

  // 카메라 연결 상태
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // 촬영 상태
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // 촬영한 사진
  const [photos, setPhotos] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  // 카메라 연결
  useEffect(() => {
    let cancelled = false;
    let currentStream: MediaStream | null = null;

    async function connectCamera() {
      setIsCameraReady(false);
      setCameraError("");

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        currentStream = stream;

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!cancelled) {
          setIsCameraReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "카메라를 연결하지 못했습니다.";

          setCameraError(message);
        }
      }
    }

    connectCamera();

    return () => {
      cancelled = true;

      currentStream?.getTracks().forEach((track) => track.stop());

      if (streamRef.current === currentStream) {
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  // 컴포넌트가 종료될 때 오디오 정리
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // 카메라 전환
  function switchCamera() {
    if (isCapturing) return;

    setFacingMode((current) =>
      current === "user" ? "environment" : "user"
    );
  }

  // 카운트다운 소리 생성
  async function playCountdownSound() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const audioContext = audioContextRef.current;

    // 매번 오디오 실행 상태 확인
    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      880,
      audioContext.currentTime
    );

    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.18
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    // 소리가 실제로 끝날 때까지 기다리기
    const soundEnded = new Promise<void>((resolve) => {
      oscillator.onended = () => resolve();
    });

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.18);

    await soundEnded;
  }


  // 셔터 소리 재생
  async function playShutterSound() {
    const audio = shutterRef.current;

    if (!audio) return;

    audio.currentTime = 0;

    try {
      const playback = audio.play();
      await playback;

      // MP3 재생이 끝날 때까지 기다리기
      await new Promise<void>((resolve) => {
        audio.addEventListener("ended", () => resolve(), {
          once: true,
        });
      });
    } catch {
      // 소리 재생이 제한되더라도 사진 촬영은 진행
    }
  }

  // 지정한 시간만큼 대기
  function wait(milliseconds: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  // 현재 카메라 화면을 사진으로 저장
  const capturePhoto = useCallback(() => {
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

    // 전면 카메라에서 좌우 반전이 켜져 있다면
    // 실제 저장되는 사진에도 반영
    if (facingMode === "user" && isMirrored) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.9);
  }, [facingMode, isMirrored]);

  // 5초 카운트다운
  async function runCountdown() {
    for (let number = 5; number >= 1; number--) {
      setCountdown(number);
      // 숫자와 함께 카운트다운 소리 
      await playCountdownSound();
      // 다음 숫자까지 남은 시간 대기
      await wait(820);
    }

    setCountdown(null);
  }

  // 촬영 시작
  async function startCapture() {
    if (isCapturing || !isCameraReady) return;

    setIsCapturing(true);
    setIsFinished(false);
    setPhotos([]);

    try {
      // 사용자의 버튼 클릭으로 오디오 실행 권한 확보
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      const capturedPhotos: string[] = [];

      // 선택한 장수만큼 촬영
      for (let i = 0; i < count; i++) {
        // 매 사진마다 5초 카운트다운
        await runCountdown();

        // 찰칵 소리 재생 후 사진 촬영
        await playShutterSound();

        const photo = capturePhoto();

        capturedPhotos.push(photo);
        setPhotos([...capturedPhotos]);
      }

      setIsFinished(true);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "사진 촬영 중 문제가 발생했습니다."
      );
    } finally {
      setCountdown(null);
      setIsCapturing(false);
    }
  }

  // 전체 사진 다시 촬영
  function resetPhotos() {
    setPhotos([]);
    setIsFinished(false);
  }

  return (
    <main className="camera">
      <section className="camera__content">
        <header className="camera__header">
          <Link
            href="/count?source=camera"
            className="camera__back"
            onClick={(event) => {
              event.preventDefault();

              const confirmed = window.confirm(
                "이전 페이지로 이동하면 현재 촬영한 사진이 모두 초기화됩니다.\n이동하시겠습니까?"
              );

              if (confirmed) {
                setPhotos([]);
                setIsFinished(false);
                router.push("/count?source=camera");
              }
            }}
          >
            ← 이전으로
          </Link>

          <span className="camera__step">03 / CAMERA</span>
        </header>

        <div className="camera__intro">
          <p className="camera__eyebrow">READY, SET, SHOT!</p>

          <h1 className="camera__title">
            오늘의 순간을<br />
            담아볼까요<span>?</span>
          </h1>

          <p className="camera__description">
            카메라를 준비하고 촬영을 시작해 주세요.
          </p>
        </div>

        {/* 4장 촬영 진행 중 사진 미리보기 */}
        {count === 4 && (
          <div className="camera__thumbnail-section">
            <div className="camera__thumbnail-header">
              <span>PHOTO PROGRESS</span>
              <span>{photos.length} / 4</span>
            </div>

            <div className="camera__thumbnails">
              {[0, 1, 2, 3].map((index) => (
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
        )}

        {/* 카메라 미리보기 */}
        <div className="camera__preview">
          <video
            ref={videoRef}
            className={`camera__video ${
              facingMode === "user" && isMirrored
                ? "camera__video--mirrored"
                : ""
            }`}
            autoPlay
            playsInline
            muted
          />

          {!isCameraReady && (
            <div className="camera__loading">
              <span>카메라 연결 중...</span>
              {cameraError && <p>{cameraError}</p>}
            </div>
          )}

          {/* 카운트다운 숫자 */}
          {countdown !== null && (
            <div className="camera__countdown">
              {countdown}
            </div>
          )}

          {isCapturing && countdown === null && (
            <div className="camera__shot-flash" />
          )}
        </div>

        {/* 카메라 조작 버튼 */}
        <div className="camera__controls">
          <button
            type="button"
            className={`camera__control ${
              isMirrored ? "is-active" : ""
            }`}
            onClick={() => setIsMirrored((current) => !current)}
            disabled={isCapturing || facingMode === "environment"}
          >
            <span className="camera__control-icon">↔</span>
            <span>좌우 반전</span>
            <span className="camera__control-state">
              {facingMode === "environment"
                ? "후면 카메라"
                : isMirrored
                  ? "ON"
                  : "OFF"}
            </span>
          </button>

          <button
            type="button"
            className="camera__control"
            onClick={switchCamera}
            disabled={isCapturing}
          >
            <span className="camera__control-icon">⇄</span>
            <span>카메라 전환</span>
            <span className="camera__control-state">
              {facingMode === "user" ? "전면" : "후면"}
            </span>
          </button>
        </div>

        {/* 촬영 버튼 */}
        {!isFinished && (
          <button
            type="button"
            className="camera__capture"
            onClick={startCapture}
            disabled={!isCameraReady || isCapturing}
          >
            {isCapturing
              ? "촬영 중..."
              : count === 1
                ? "촬영"
                : "자동 촬영"}
          </button>
        )}

        {/* 촬영 진행 상태 */}
        {isCapturing && (
          <p className="camera__progress">
            {photos.length + 1} / {count} 번째 사진 촬영 중
          </p>
        )}

        {/* 촬영 완료 */}
        {isFinished && (
          <div className="camera__result">
            <h2>촬영 완료!</h2>
            <p>{photos.length}장의 사진을 촬영했어요.</p>

            <div className="camera__photos">
              {photos.map((photo, index) => (
                <div className="camera__photo" key={index}>
                  <img src={photo} alt={`${index + 1}번째 촬영 사진`} />
                  <span>{index + 1}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="camera__retry"
              onClick={startCapture}
            >
              다시 촬영하기
            </button>
          </div>
        )}

        <footer className="camera__footer">
          EVERY SHOT, YOUR MOMENT.
        </footer>

        {/* 셔터 MP3 */}
        <audio
          ref={shutterRef}
          src="/sounds/shutter.mp3"
          preload="auto"
        />
      </section>
    </main>
  );
}
