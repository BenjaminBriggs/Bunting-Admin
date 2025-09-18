import type { Metadata } from 'next';
import { Belanosima, Nunito } from 'next/font/google';
import { ThemeProvider } from '@/components';
import AuthSessionProvider from '@/components/providers/session-provider';

const belanosima = Belanosima({ 
  subsets: ['latin'],
  weight: ['400', '600', '700']
});
const nunito = Nunito({ 
  subsets: ['latin'],
  weight: ['400', '600', '700']
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
      <body className={nunito.className}>
        <AuthSessionProvider>
          <ThemeProvider belanosima={belanosima.style.fontFamily} inter={nunito.style.fontFamily}>
            {children}
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}