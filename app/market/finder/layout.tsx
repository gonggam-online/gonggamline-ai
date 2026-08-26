import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "1-1. 아이템 발굴 워크벤치 | 공감라인 AI",
  description: "키워드, 쇼핑 콘텐츠, 채널, 시즌과 쿠팡 가격 근거를 결합하는 아이템 발굴 워크벤치",
};

export default function ItemDiscoveryFinderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
