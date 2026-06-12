import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkoutX 动作查询与训练计划",
  description: "基于 WorkoutX API 的动作缓存、器材识别与规则训练计划网站。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
