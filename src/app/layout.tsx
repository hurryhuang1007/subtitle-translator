import type { Metadata } from 'next';

import { Provider } from '@/com/ui/provider';

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
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
