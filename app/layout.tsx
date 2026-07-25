import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { DialogProvider } from '../context/DialogContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'VoiceCraft AI Studio',
  description: 'Premium AI Shadowing & Pronunciation Workspace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable}`}>
      <body className="bg-[#0B1020] text-white font-sans antialiased min-h-screen">
        <DialogProvider>
          {children}
        </DialogProvider>
      </body>
    </html>
  );
}
