import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공감라인 AI",
  description: "AI Company OS · 쿠팡 상품 발굴부터 판매 운영까지",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
