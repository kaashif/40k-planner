import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '40k Field Notes · Grand Coven VOD analysis',
  description: 'Evidence-backed Thousand Sons game analysis: broadcast frames, board-state changes and timestamped commentary. Plus 11th-edition mission and deployment tools.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
