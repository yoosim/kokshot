
// 촬영 기본 구성 (1장, 4장 받아오기)

import { Suspense } from "react";
import CameraClient from "./CameraClient";

type CameraPageProps = {
  searchParams: Promise<{
    count?: string;
  }>;
};

// URL에서 사진 장수를 확인하는 컴포넌트
async function CameraContent({
  searchParams,
}: CameraPageProps) {
  const params = await searchParams;

  // 선택한 사진 장수가 1 또는 4인지 확인
  const count = params.count === "4" ? 4 : 1;

  return <CameraClient count={count} />;
}

// 카메라 페이지
export default function CameraPage({
  searchParams,
}: CameraPageProps) {
  return (
    <Suspense fallback={<div>카메라 페이지를 준비하고 있어요...</div>}>
      <CameraContent searchParams={searchParams} />
    </Suspense>
  );
}
