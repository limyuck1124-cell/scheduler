import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "재활치료실 통합 스케줄러",
  description: "작업치료실 · 운동치료실 통합 일정 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
