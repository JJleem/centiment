import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Centiment — Supercent 게임 리뷰 감성 분석",
    template: "%s | Centiment",
  },
  description:
    "Supercent 모바일 게임의 iOS · Android 리뷰를 Claude AI로 실시간 감성 분석합니다. 버전별 트렌드, 카테고리 인사이트, 게임 간 비교를 한눈에.",
  keywords: ["Supercent", "게임 리뷰", "감성 분석", "Claude AI", "모바일 게임", "앱스토어", "구글플레이"],
  authors: [{ name: "임재준", url: "https://github.com/JJleem" }],
  openGraph: {
    title: "Centiment — Supercent 게임 리뷰 감성 분석",
    description: "Claude AI 기반 모바일 게임 리뷰 실시간 분석 대시보드",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
      </body>
    </html>
  );
}
