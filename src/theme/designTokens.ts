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

// --- Core type mapping (Flag / Test / Rollout) ---
// The brand's warm hues identify *what kind of object* this is. These appear
// everywhere (nav, list rows, chips, icons, headers). They are a separate
// dimension from environment colors and must never share a hue with them.
export interface TypeColors {
	label: string;
	solid: string; // icon / dot / fill
	bg: string; // light tint — chip & header background
	border: string;
	text: string; // ink — label text
}

export const typeColors: Record<'flag' | 'test' | 'rollout', TypeColors> = {
	flag: {
		label: 'Flag',
		solid: '#E0564B',
		bg: '#FBE4E0',
		border: '#F6D4CE',
		text: '#C24A3E',
	},
	test: {
		label: 'Test',
		solid: '#1E9E92',
		bg: '#DEF3F0',
		border: '#C9ECE7',
		text: '#1E7B72',
	},
	rollout: {
		label: 'Rollout',
		solid: '#4C9E3A',
		bg: '#E9F4E0',
		border: '#DCEDCF',
		text: '#3F7A2D',
	},
};

// --- Fixed environment mapping (must match the Flags-list columns) ---
// Environment is a *separate dimension* from core type. The ramp is intentional:
// yellow → blue → purple (dev → beta → prod) reads warm-to-cool as you promote
// toward production, with a deliberately large jump between Dev and Prod.
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
		text: '#623ca1',
		bg: '#F5F3FD',
		headerBg: '#ece9fb',
		border: '#D9CFF3',
		dot: '#814fd4',
	},
	beta: {
		label: 'Beta',
		text: '#3a9cce',
		bg: '#EFF8FD',
		headerBg: '#e1f2fb',
		border: '#bde6f3',
		dot: '#44baf6',
	},
	development: {
		label: 'Development',
		text: '#9A7B16',
		bg: '#FEF9E6',
		headerBg: '#FCF3CF',
		border: '#F3E7B0',
		dot: '#FCD34D',
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
