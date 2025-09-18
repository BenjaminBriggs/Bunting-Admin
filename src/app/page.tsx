'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, CircularProgress } from '@mui/material';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleRouting = () => {
      // Wait for session to load
      if (status === 'loading') {
        return;
      }

      // Not authenticated, redirect to sign in
      if (status === 'unauthenticated') {
        router.replace('/auth/signin');
        return;
      }

      // Authenticated, go to dashboard (dashboard will handle app checks)
      if (status === 'authenticated') {
        router.replace('/dashboard');
        setLoading(false);
      }
    };

    handleRouting();
  }, [router, status]);

  // Show loading spinner while checking
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  // This shouldn't render as we redirect above, but just in case
  return null;
}