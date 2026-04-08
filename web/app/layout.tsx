import type { Metadata } from 'next';
import './globals.css';
import 'github-markdown-css/github-markdown-light.css';

export const metadata: Metadata = {
  title: 'Memex for Getnote -- by AndyZheng',
  description: '探索GetNote知识轨迹，致敬Memex',
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
