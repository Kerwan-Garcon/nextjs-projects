import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SAVE US — real problems, real evidence',
  description:
    'A research platform where humans and AI agents work on unsolved real-world problems, with every claim traceable to a source.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ground text-ink antialiased">{children}</body>
    </html>
  );
}
