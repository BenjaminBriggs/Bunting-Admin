import type { Metadata } from 'next';
import { Baloo_2, JetBrains_Mono, Nunito } from 'next/font/google';
import { ThemeProvider } from '@/components';
import AuthSessionProvider from '@/components/providers/session-provider';
import './globals.css';

// Baloo 2 = friendly display voice (titles, flag/group names).
const baloo = Baloo_2({
	subsets: ['latin'],
	weight: ['500', '600', '700', '800'],
	variable: '--font-baloo',
});
// Nunito = UI / body voice.
const nunito = Nunito({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700', '800'],
	variable: '--font-nunito',
});
// JetBrains Mono = technical voice (keys, stored values, config, versions).
const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-jetbrains-mono',
});
// Material Symbols Rounded = icon font (className="ms"). next/font has no manifest entry
// for it, and the app's CSP blocks the Google Fonts CDN, so it's self-hosted from
// /public/fonts and @font-face'd in globals.css (served same-origin under font-src 'self').

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
		// suppressHydrationWarning: browser extensions (e.g. LanguageTool's
		// data-lt-installed) mutate <html> before hydration; this only suppresses the
		// warning for <html>'s own attributes, not for app-rendered content.
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${nunito.variable} ${baloo.variable} ${jetbrainsMono.variable}`}
			>
				<AuthSessionProvider>
					<ThemeProvider>{children}</ThemeProvider>
				</AuthSessionProvider>
			</body>
		</html>
	);
}
