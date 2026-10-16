import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JARVIS — Personal AI Assistant',
  description: 'Autonomous personal AI assistant with persistent planning, research, memory, and deterministic scheduling.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
