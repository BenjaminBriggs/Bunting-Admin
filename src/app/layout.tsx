import type { Metadata } from 'next';
import { Belanosima, Nunito } from 'next/font/google';
import { ThemeProvider } from '@/components';
import AuthSessionProvider from '@/components/providers/session-provider';

const belanosima = Belanosima({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-belanosima',
});
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'Bunting Admin',
  description: 'Feature flag management interface for Bunting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${belanosima.variable}`}>
        <AuthSessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}