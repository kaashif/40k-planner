import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '40k 11th Edition Missions',
  description: 'Warhammer 40,000 11th-edition mission and event layout reference.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
