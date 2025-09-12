'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { fetchApps } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkApps = async () => {
      try {
        const apps = await fetchApps();
        if (apps.length === 0) {
          // No apps exist, go to setup
          router.replace('/setup');
        } else {
          // Apps exist, go to dashboard
          router.replace('/dashboard');
        }
      } catch (error) {
        console.error('Failed to check apps:', error);
        // On error, default to setup
        router.replace('/setup');
      } finally {
        setLoading(false);
      }
    };

    checkApps();
  }, [router]);

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