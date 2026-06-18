// designTokens.ts — Bunting hi-fi design system tokens (from the Claude Design handoff).
// These complement the MUI theme for the cases MUI's palette doesn't model cleanly:
// the fixed per-environment color mapping, the JetBrains Mono "technical voice", and the
// sharp-cornered mono "technical" button used when a control authors machine config.

import type { SxProps, Theme } from '@mui/material/styles';

// --- Core ink / surface palette ---
export const ink = {
	primary: '#1C1B1A',
	soft: '#6B6452',
	muted: '#A79F8C',
	faint: '#B4AC9A',
} as const;

export const surface = {
	canvas: '#F7F3EA',
	paper: '#FFFFFF',
	sidebar: '#FCFAF3',
	sunken: '#FCFAF3',
	token: '#F1EBDD', // tinted chip background for mono/technical data
	border: '#EAE2D2',
	borderStrong: '#E6DECB',
	borderSidebar: '#ECE5D6',
	hover: '#F1EADB',
	navActive: '#FBEDC6',
} as const;

export const danger = '#C8503C';

// --- Fixed environment mapping (must match the Flags-list columns) ---
export interface EnvColors {
	label: string;
	text: string;
	bg: string; // tinted card background
	headerBg: string; // header band background
	border: string;
	dot: string;
}

export const envColors: Record<'production' | 'beta' | 'development', EnvColors> = {
	production: {
		label: 'Production',
		text: '#3F7A2D',
		bg: '#F3FAEE',
		headerBg: '#E9F4E0',
		border: '#DCEDCF',
		dot: '#57A95A',
	},
	beta: {
		label: 'Beta',
		text: '#1E7B72',
		bg: '#EDF8F6',
		headerBg: '#DEF3F0',
		border: '#C9ECE7',
		dot: '#54C9C0',
	},
	development: {
		label: 'Development',
		text: '#9A6F1C',
		bg: '#FDF6E6',
		headerBg: '#FCEFD2',
		border: '#F3E2BD',
		dot: '#F6A444',
	},
};

// --- Typography voices ---
export const monoFontFamily =
	"var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
export const displayFontFamily = "var(--font-baloo), 'Baloo 2', system-ui, sans-serif";

// Dark code-block surface for live JSON previews.
export const codeSurface = {
	bg: '#23231F',
	text: '#D7D4C7',
} as const;

// --- "Technical" button: mono label + sharp 5px bevel.
// Signals (subtly) that the action authors machine config — Create/Save flag, Add/Save
// variant, Add condition, Publish config. `disabled` softens to a muted fill.
export function technicalButtonSx(opts?: {
	disabled?: boolean;
	accent?: boolean;
}): SxProps<Theme> {
	const { disabled = false, accent = false } = opts ?? {};
	return {
		fontFamily: monoFontFamily,
		fontWeight: accent ? 600 : 500,
		fontSize: 13,
		textTransform: 'none',
		borderRadius: '5px',
		paddingInline: 2.25,
		paddingBlock: 1.25,
		boxShadow: 'none',
		color: accent ? '#3A2806' : '#fff',
		backgroundColor: disabled ? '#C2BAA8' : accent ? '#F6A444' : ink.primary,
		opacity: disabled ? 0.55 : 1,
		'&:hover': {
			boxShadow: 'none',
			backgroundColor: disabled ? '#C2BAA8' : accent ? '#E89327' : '#000',
		},
		'&.Mui-disabled': { color: '#fff', backgroundColor: '#C2BAA8', opacity: 0.55 },
	};
}

// Inline mono "token" style for keys / stored values rendered amid friendly text.
export const monoTokenSx: SxProps<Theme> = {
	fontFamily: monoFontFamily,
	fontWeight: 500,
	fontSize: 13,
	color: ink.primary,
	backgroundColor: surface.token,
	borderRadius: '6px',
	paddingInline: 1,
	paddingBlock: 0.4,
};
