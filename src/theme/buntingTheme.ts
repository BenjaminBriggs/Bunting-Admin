// buntingTheme.ts — MUI theme implementing the Bunting hi-fi design system.
// Two typographic voices: Baloo 2 (friendly display) + Nunito (UI/body) for people,
// JetBrains Mono for machine-facing data. Warm cream canvas, ink primary, fixed
// per-environment colors live in ./designTokens.
//
// Example usage:
// import { ThemeProvider, CssBaseline } from '@mui/material';
// import { buntingTheme } from './buntingTheme';
// <ThemeProvider theme={buntingTheme}><CssBaseline />{children}</ThemeProvider>

import type { Components, Theme } from '@mui/material/styles';
import { alpha, createTheme } from '@mui/material/styles';

// --- Design tokens (kept local; ./designTokens re-exports the env palette + helpers) ---
const ink = {
	primary: '#1C1B1A',
	soft: '#6B6452',
	muted: '#A79F8C',
};
const surface = {
	canvas: '#F7F3EA',
	paper: '#FFFFFF',
	sidebar: '#FCFAF3',
	border: '#EAE2D2',
	borderStrong: '#E6DECB',
	divider: '#ECE5D6',
	hover: '#F1EADB',
	navActive: '#FBEDC6',
};
const accent = {
	amber: '#F6A444',
	amberDark: '#E89327',
	amberInk: '#3A2806',
	coral: '#F47C5D',
};
const functional = {
	success: '#3F7A2D',
	successBg: '#E9F4E0',
	warning: '#9A6F1C',
	warningBg: '#FCEFD2',
	info: '#1E7B72',
	infoBg: '#DEF3F0',
	danger: '#C8503C',
	dangerBg: '#FBEAE5',
};

const displayFont = ['var(--font-baloo)', 'Baloo 2', 'system-ui', 'sans-serif'].join(',');
const bodyFont = [
	'var(--font-nunito)',
	'Nunito',
	'ui-sans-serif',
	'system-ui',
	'-apple-system',
	'Segoe UI',
	'Roboto',
	'sans-serif',
].join(',');

const cardShadow = '0 1px 2px rgba(40,33,20,.03)';
const raisedShadow = '0 8px 24px rgba(40,33,20,.08)';
const focusRing = `0 0 0 3px ${alpha(ink.primary, 0.1)}`;

export function createBuntingTheme() {
	return createTheme({
		cssVariables: true,
		palette: {
			mode: 'light',
			primary: {
				main: ink.primary,
				light: '#3A352C',
				dark: '#000000',
				contrastText: '#FFFFFF',
			},
			secondary: {
				main: accent.amber,
				light: '#FBD85A',
				dark: accent.amberDark,
				contrastText: accent.amberInk,
			},
			warning: {
				main: functional.warning,
				light: accent.amber,
				dark: '#5E4A18',
				contrastText: '#FFFFFF',
			},
			error: {
				main: functional.danger,
				light: '#D98B7C',
				dark: '#A23C2B',
				contrastText: '#FFFFFF',
			},
			success: { main: functional.success, contrastText: '#FFFFFF' },
			info: { main: functional.info, contrastText: '#FFFFFF' },
			divider: surface.border,
			background: {
				default: surface.canvas,
				paper: surface.paper,
			},
			text: {
				primary: ink.primary,
				secondary: ink.soft,
				disabled: ink.muted,
			},
		},
		shape: {
			borderRadius: 11,
		},
		spacing: 8,
		typography: {
			fontFamily: bodyFont,
			h1: { fontFamily: displayFont, fontWeight: 800, letterSpacing: -0.4 },
			h2: { fontFamily: displayFont, fontWeight: 800, letterSpacing: -0.3 },
			h3: { fontFamily: displayFont, fontWeight: 800, letterSpacing: -0.2 },
			h4: { fontFamily: displayFont, fontWeight: 800 },
			h5: { fontFamily: displayFont, fontWeight: 700 },
			h6: { fontFamily: displayFont, fontWeight: 700 },
			subtitle1: { fontWeight: 700 },
			subtitle2: { fontWeight: 700 },
			button: { fontWeight: 700, textTransform: 'none', letterSpacing: 0 },
			caption: { fontFamily: bodyFont, fontSize: '0.75rem' },
			body1: { fontFamily: bodyFont },
			body2: { fontFamily: bodyFont, fontSize: '0.875rem' },
		},
		transitions: {
			easing: {
				easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
				easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
				easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
				sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
			},
			duration: {
				shortest: 120,
				shorter: 150,
				short: 200,
				standard: 240,
				complex: 320,
				enteringScreen: 220,
				leavingScreen: 200,
			},
		},
		components: {
			MuiCssBaseline: {
				styleOverrides: {
					body: { backgroundColor: surface.canvas },
					// Note: the Material Symbols `.ms` helper lives in globals.css (it references
					// the self-hosted next/font --font-ms variable). Keep it out of here so it
					// isn't overridden with a font-family name the browser hasn't loaded.
					'*:focus-visible': {
						outline: 'none',
						boxShadow: focusRing,
						borderRadius: 8,
					},
				},
			},

			MuiButton: {
				defaultProps: { disableRipple: true, disableElevation: true },
				styleOverrides: {
					root: {
						borderRadius: 11,
						paddingInline: 18,
						paddingBlock: 10,
						boxShadow: 'none',
						fontWeight: 700,
						'&:hover': { boxShadow: 'none' },
					},
					containedPrimary: {
						backgroundColor: ink.primary,
						'&:hover': { backgroundColor: '#000' },
					},
					containedSecondary: {
						backgroundColor: accent.amber,
						color: accent.amberInk,
						'&:hover': { backgroundColor: accent.amberDark },
					},
					outlined: {
						borderWidth: 1.5,
						borderColor: '#E2D9C6',
						color: '#3A352C',
						'&:hover': {
							borderWidth: 1.5,
							borderColor: '#D8CFBC',
							backgroundColor: surface.hover,
						},
					},
					text: { color: ink.soft },
					sizeSmall: { borderRadius: 9, paddingBlock: 7, paddingInline: 14 },
					sizeLarge: { borderRadius: 11, paddingBlock: 12, paddingInline: 22 },
				},
				variants: [
					{
						props: { color: 'warning', variant: 'contained' },
						style: {
							color: accent.amberInk,
							backgroundColor: accent.amber,
							'&:hover': { backgroundColor: accent.amberDark },
						},
					},
				],
			},

			MuiChip: {
				styleOverrides: {
					root: { borderRadius: 8, fontWeight: 700 },
					label: { fontSize: '0.72rem' },
				},
			},

			MuiPaper: {
				styleOverrides: {
					root: {
						backgroundColor: surface.paper,
						borderRadius: 16,
						boxShadow: cardShadow,
						backgroundImage: 'none',
					},
					outlined: { borderColor: surface.border },
				},
			},
			MuiCard: {
				defaultProps: { variant: 'outlined' },
				styleOverrides: {
					root: {
						borderRadius: 16,
						border: `1px solid ${surface.border}`,
						boxShadow: cardShadow,
					},
				},
			},

			MuiAppBar: {
				styleOverrides: {
					root: {
						backgroundColor: surface.paper,
						color: ink.primary,
						boxShadow: 'none',
						borderBottom: `1px solid ${surface.divider}`,
					},
				},
			},

			MuiTabs: {
				styleOverrides: {
					indicator: { height: 2.5, borderRadius: 0, backgroundColor: ink.primary },
				},
			},
			MuiTab: {
				styleOverrides: {
					root: {
						textTransform: 'none',
						fontWeight: 700,
						minHeight: 44,
						paddingInline: 13,
						color: ink.muted,
						'&.Mui-selected': { color: ink.primary },
					},
				},
			},

			MuiTextField: { defaultProps: { variant: 'outlined' } },
			MuiOutlinedInput: {
				styleOverrides: {
					root: {
						borderRadius: 11,
						backgroundColor: surface.paper,
						'& .MuiOutlinedInput-notchedOutline': { borderColor: surface.borderStrong },
						'&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#D8CFBC' },
						'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
							borderColor: ink.primary,
							boxShadow: focusRing,
						},
					},
					notchedOutline: { borderWidth: 1.5 },
					input: { paddingBlock: 11, paddingInline: 13 },
				},
			},
			MuiInputLabel: { styleOverrides: { root: { fontWeight: 700 } } },
			MuiSelect: {
				styleOverrides: { icon: { color: ink.muted } },
			},

			MuiSwitch: {
				styleOverrides: {
					switchBase: { '&.Mui-checked': { color: '#fff' } },
					thumb: { boxShadow: '0 1px 2px rgba(0,0,0,.2)' },
					track: { backgroundColor: '#E2D9C6', opacity: 1 },
				},
			},

			MuiDrawer: {
				styleOverrides: {
					paper: {
						backgroundColor: surface.sidebar,
						borderRight: `1px solid ${surface.divider}`,
					},
				},
			},
			MuiListItemButton: {
				styleOverrides: {
					root: {
						borderRadius: 11,
						marginInline: 6,
						'&:hover': { backgroundColor: surface.hover },
						'&.Mui-selected': {
							backgroundColor: surface.navActive,
							'&:hover': { backgroundColor: surface.navActive },
						},
					},
				},
			},

			MuiTableHead: {
				styleOverrides: { root: { backgroundColor: alpha(surface.border, 0.4) } },
			},
			MuiTableCell: {
				styleOverrides: {
					root: { borderBottom: `1px solid ${surface.border}` },
					head: { fontWeight: 800 },
				},
			},

			MuiAlert: {
				styleOverrides: {
					root: { borderRadius: 11, fontWeight: 600 },
					standardInfo: {
						backgroundColor: functional.infoBg,
						color: functional.info,
						border: '1px solid #C9ECE7',
					},
					standardSuccess: {
						backgroundColor: functional.successBg,
						color: functional.success,
						border: '1px solid #CDE6C2',
					},
					standardWarning: {
						backgroundColor: functional.warningBg,
						color: functional.warning,
						border: '1px solid #F3E2BD',
					},
					standardError: {
						backgroundColor: functional.dangerBg,
						color: functional.danger,
						border: '1px solid #EAC7BF',
					},
				},
			},

			MuiDialog: {
				styleOverrides: { paper: { borderRadius: 20, boxShadow: raisedShadow } },
			},

			MuiTooltip: {
				styleOverrides: {
					tooltip: { borderRadius: 8, background: ink.primary, fontWeight: 600 },
					arrow: { color: ink.primary },
				},
			},

			MuiAccordion: {
				styleOverrides: {
					root: {
						borderRadius: 16,
						'&::before': { display: 'none' },
						boxShadow: cardShadow,
						overflow: 'hidden',
					},
				},
			},
		} satisfies Components<Omit<Theme, 'components'>>,
	});
}

// Default theme export for convenience
export const buntingTheme = createBuntingTheme();

// --- Optional dark theme variant (kept for parity; not the primary surface) ---
export const buntingDarkTheme = createTheme({
	...buntingTheme,
	palette: {
		mode: 'dark',
		primary: buntingTheme.palette.primary,
		secondary: buntingTheme.palette.secondary,
		warning: buntingTheme.palette.warning,
		error: buntingTheme.palette.error,
		background: { default: '#1A1A16', paper: '#242420' },
		divider: alpha('#FFFFFF', 0.12),
		text: {
			primary: '#FAF8F0',
			secondary: alpha('#FAF8F0', 0.72),
			disabled: alpha('#FAF8F0', 0.44),
		},
		success: { main: '#82C868' },
		info: { main: '#54C9C0' },
	},
	components: {
		...buntingTheme.components,
		MuiCssBaseline: {
			styleOverrides: { body: { backgroundColor: '#1A1A16' } },
		},
	},
});
