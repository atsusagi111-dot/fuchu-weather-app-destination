import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "自転車お出かけ天気 | 出発・帰宅時間から自転車で行けるか判断",
  description:
    "自転車で行ける？帰りは大丈夫？天気から最適な移動を提案。出発時間と帰宅時間をもとに、東京都府中市と目的地の気温・天気・湿度・降水確率から自転車移動の可否をアドバイスするアプリ。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
