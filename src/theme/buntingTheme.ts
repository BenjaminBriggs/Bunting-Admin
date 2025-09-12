// buntingTheme.ts - A playful, branded MUI v5 theme that avoids the stock look
// Drop this file into your project and import it where you create your ThemeProvider.
// Example usage:
// import { ThemeProvider, CssBaseline } from '@mui/material';
// import { buntingTheme } from './buntingTheme';
// <ThemeProvider theme={buntingTheme}><CssBaseline />{children}</ThemeProvider>

import { createTheme, alpha } from "@mui/material/styles";
import { Components } from "@mui/material/styles/components";

// --- Brand Palette (Bunting logo colors) ---
const brand = {
  teal: {
    main: "#56D5C4",
    light: "#79DEBA", 
    dark: "#3BA896",
  },
  mint: {
    main: "#79DEBA",
    light: "#9AE6C7",
    dark: "#56C29F",
  },
  yellow: {
    main: "#F9C730",
    light: "#FBD85A",
    dark: "#E6B41D",
  },
  orange: {
    main: "#FC7A51",
    light: "#FD9572",
    dark: "#E8633A",
  },
  error: {
    main: "#FC7A51",
    light: "#FD9572",
    dark: "#E8633A",
  },
  neutral: {
    defaultBg: "#FAF8F0",
    paper: "#FFFFFF",
    divider: "#E8E6DF",
    textPrimary: "#13130F",
    textSecondary: "#4A4A44",
    textDisabled: "#8B8B85",
  },
};

// --- Helpers ---
const soften = (c: string, a = 0.08) => alpha(c, a);
const elevate = (c: string, a = 0.12) => `0 8px 24px ${alpha(c, a)}`;
// --- Custom shadows (grounded + subtle) ---
const customShadows = {
  xs: `0 1px 2px ${alpha("#000", 0.04)}`,
  sm: `0 2px 6px ${alpha("#000", 0.06)}`,
  md: `0 4px 12px ${alpha("#000", 0.08)}`,
  lg: `0 8px 24px ${alpha("#000", 0.10)}`,
  focus: `0 0 0 3px ${alpha(brand.teal.main, 0.20)}`,
};

export function createBuntingTheme({ 
  belanosima = "Belanosima", 
  inter = "Nunito" 
}: { 
  belanosima?: string; 
  inter?: string; 
} = {}) {
  return createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: {
      main: brand.teal.main,
      light: brand.teal.light,
      dark: brand.teal.dark,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: brand.mint.main,
      light: brand.mint.light,
      dark: brand.mint.dark,
      contrastText: "#FFFFFF",
    },
    warning: {
      main: brand.yellow.main,
      light: brand.yellow.light,
      dark: brand.yellow.dark,
      contrastText: "#13130F",
    },
    error: {
      main: brand.error.main,
      light: brand.error.light,
      dark: brand.error.dark,
      contrastText: "#FFFFFF",
    },
    divider: brand.neutral.divider,
    background: {
      default: brand.neutral.defaultBg,
      paper: brand.neutral.paper,
    },
    text: {
      primary: brand.neutral.textPrimary,
      secondary: brand.neutral.textSecondary,
      disabled: brand.neutral.textDisabled,
    },
    success: {
      main: brand.mint.dark,
    },
    info: {
      main: brand.teal.dark,
    },
  },
  shape: {
    borderRadius: 16, // Friendly, rounded look
  },
  spacing: 8,
  typography: {
    // Belanosima for headings, Nunito for body text
    fontFamily: [
      inter,
      "Nunito",
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "sans-serif",
    ].join(","),
    h1: { 
      fontFamily: [belanosima, "Belanosima", "serif"].join(","),
      fontWeight: 700, 
      letterSpacing: -0.5 
    },
    h2: { 
      fontFamily: [belanosima, "Belanosima", "serif"].join(","),
      fontWeight: 700, 
      letterSpacing: -0.4 
    },
    h3: { 
      fontFamily: [belanosima, "Belanosima", "serif"].join(","),
      fontWeight: 600, 
      letterSpacing: -0.2 
    },
    h4: { 
      fontFamily: [belanosima, "Belanosima", "serif"].join(","),
      fontWeight: 600 
    },
    h5: { 
      fontFamily: [belanosima, "Belanosima", "serif"].join(","),
      fontWeight: 600 
    },
    h6: { 
      fontFamily: [belanosima, "Belanosima", "serif"].join(","),
      fontWeight: 600 
    },
    subtitle1: { fontWeight: 600 },
    button: { fontWeight: 700, textTransform: "none", letterSpacing: 0.1 },
    caption: { 
      fontFamily: [inter, "Nunito", "sans-serif"].join(","),
      fontSize: "0.75rem" 
    },
    body2: { 
      fontFamily: [inter, "Nunito", "sans-serif"].join(","),
      fontSize: "0.875rem" 
    },
  },
  transitions: {
    easing: {
      easeInOut: "cubic-bezier(0.22, 1, 0.36, 1)", // playful springy feel
      easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
      easeIn: "cubic-bezier(0.7, 0, 0.84, 0)",
      sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
    },
    duration: {
      shortest: 120,
      shorter: 160,
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
        ":root": {
          "--bunting-shadow-focus": customShadows.focus,
        },
        body: {
          backgroundColor: brand.neutral.defaultBg,
        },
        "*:focus-visible": {
          outline: "none",
          boxShadow: customShadows.focus,
          transition: "box-shadow 120ms",
          borderRadius: 10,
        },
      },
    },

    // Buttons: friendly, slightly elevated, with fun hover
    MuiButton: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          borderRadius: 999, // Full pill shape
          paddingInline: 16,
          paddingBlock: 10,
          boxShadow: "none",
          transition: theme.transitions.create(
            ["transform", "box-shadow", "background-color"],
            {
              duration: theme.transitions.duration.shorter,
              easing: theme.transitions.easing.easeOut,
            },
          ),
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: customShadows.sm,
          },
          "&:active": {
            transform: "translateY(0)",
            boxShadow: customShadows.xs,
          },
        }),
        containedPrimary: {
          backgroundColor: brand.teal.main,
          "&:hover": {
            backgroundColor: brand.teal.dark,
          },
        },
        containedSecondary: {
          backgroundColor: brand.mint.main,
          "&:hover": {
            backgroundColor: brand.mint.dark,
          },
        },
        outlined: {
          borderWidth: 2,
          "&:hover": { backgroundColor: soften("#000", 0.04) },
        },
        sizeSmall: { borderRadius: 999, paddingBlock: 8, paddingInline: 14 },
        sizeLarge: { borderRadius: 999, paddingBlock: 12, paddingInline: 22 },
      },
      variants: [
        {
          props: { color: "warning", variant: "contained" },
          style: {
            color: "#13130F",
            backgroundColor: brand.yellow.main,
            "&:hover": {
              backgroundColor: brand.yellow.dark,
            },
          },
        },
        {
          props: { variant: "soft" as any },
          style: {
            backgroundColor: alpha(brand.teal.main, 0.12),
            color: brand.teal.dark,
            "&:hover": { backgroundColor: alpha(brand.teal.main, 0.18) },
          },
        },
      ],
    },

    // Chips: pill-y, playful
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
        colorPrimary: {
          backgroundColor: alpha(brand.teal.main, 0.16),
          color: brand.teal.dark,
        },
        colorSecondary: {
          backgroundColor: alpha(brand.mint.main, 0.18),
          color: brand.mint.dark,
        },
      },
    },

    // Cards & Paper: soft edges and subtle shadows
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: customShadows.xs,
          backgroundImage: "none",
        },
        outlined: {
          borderColor: alpha("#000", 0.08),
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: customShadows.sm,
        },
      },
    },

    // AppBar: translucent glassy header
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha("#FFFFFF", 0.7),
          backdropFilter: "saturate(1.2) blur(8px)",
          color: brand.neutral.textPrimary,
          boxShadow: "none",
          borderBottom: `1px solid ${brand.neutral.divider}`,
        },
      },
    },

    // Tabs: underlined with a bubble indicator
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 36,
          borderRadius: 18,
          backgroundColor: alpha(brand.teal.main, 0.24),
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 12,
          minHeight: 44,
          paddingInline: 14,
          "&.Mui-selected": { color: brand.teal.dark },
        },
      },
    },

    // Inputs: soft backgrounds, clear focus ring
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(brand.teal.main, 0.5),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: brand.teal.main,
            boxShadow: customShadows.focus,
          },
        },
        notchedOutline: { borderWidth: 2 },
        input: { paddingBlock: 12, paddingInline: 14 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiSelect: {
      styleOverrides: {
        select: { borderRadius: 12 },
        icon: { color: brand.neutral.textSecondary },
      },
    },

    // Switches and toggles
    MuiSwitch: {
      styleOverrides: {
        thumb: { boxShadow: customShadows.xs },
        track: { backgroundColor: alpha(brand.teal.main, 0.25) },
      },
    },

    // Lists & Navigation (great for sidebars)
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#FFFFFF",
          borderRight: `1px solid ${brand.neutral.divider}`,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginInline: 6,
          "&.Mui-selected": {
            backgroundColor: alpha(brand.teal.main, 0.14),
            "&:hover": { backgroundColor: alpha(brand.teal.main, 0.2) },
          },
        },
      },
    },

    // Tables (denser but friendly)
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(brand.teal.light, 0.20),
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${brand.neutral.divider}` },
        head: { fontWeight: 800 },
      },
    },

    // Feedback
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 14 },
        standardInfo: { backgroundColor: alpha(brand.teal.light, 0.28) },
        standardSuccess: { backgroundColor: alpha(brand.mint.light, 0.3) },
        standardWarning: {
          backgroundColor: alpha(brand.yellow.light, 0.4),
          color: "#13130F",
        },
        standardError: { backgroundColor: alpha(brand.error.light, 0.3) },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 10,
          background: brand.neutral.textPrimary,
        },
        arrow: { color: brand.neutral.textPrimary },
      },
    },

    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          "&::before": { display: "none" },
          boxShadow: customShadows.xs,
          overflow: "hidden",
        },
      },
    },
  } as Components,
});
}

// Default theme export for convenience
export const buntingTheme = createBuntingTheme();

// --- Optional: a ready-made dark theme variant (toggle when needed)
export const buntingDarkTheme = createTheme({
  ...buntingTheme,
  palette: {
    mode: "dark",
    primary: buntingTheme.palette.primary,
    secondary: buntingTheme.palette.secondary,
    warning: buntingTheme.palette.warning,
    error: buntingTheme.palette.error,
    background: { default: "#1A1A16", paper: "#242420" },
    divider: alpha("#FFFFFF", 0.12),
    text: {
      primary: "#FAF8F0",
      secondary: alpha("#FAF8F0", 0.72),
      disabled: alpha("#FAF8F0", 0.44),
    },
    success: { main: brand.mint.light },
    info: { main: brand.teal.light },
  },
  components: {
    ...buntingTheme.components,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#1A1A16",
        },
      },
    },
  },
});
