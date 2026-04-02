import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Memex 2.0 — 知识图谱',
  description: 'Strategic Dark Tech 知识加速器',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
