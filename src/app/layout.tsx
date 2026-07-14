import type { Metadata } from 'next';
import 'animal-island-ui/style';
import './globals.css';

export const metadata: Metadata = {
  title: 'Subtitle Translator',
  description: '字幕翻译工具',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
