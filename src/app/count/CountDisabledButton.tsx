// 1컷 준비중에 관련된 버튼 


"use client";

type CountDisabledButtonProps = {
  children: React.ReactNode;
};

export default function CountDisabledButton({
  children,
}: CountDisabledButtonProps) {
  return (
    <button
      type="button"
      className="count-card count-card--disabled"
      onClick={() => alert("준비중입니다.")}
    >
      {children}
    </button>
  );
}
