'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { createBuntingTheme } from '@/theme/buntingTheme';

export default function CustomThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = createBuntingTheme();
  
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}