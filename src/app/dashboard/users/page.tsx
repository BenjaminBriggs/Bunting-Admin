'use client'

import { Box, Typography, Breadcrumbs, Link } from '@mui/material'
import UserManagement from '@/components/settings/UserManagement'
import { NavigateNext } from '@mui/icons-material'
import NextLink from 'next/link'

export default function UsersPage() {
  return (
    <Box>
      <Breadcrumbs
        separator={<NavigateNext fontSize="small" />}
        sx={{ mb: 3 }}
      >
        <Link component={NextLink} href="/dashboard" color="inherit">
          Dashboard
        </Link>
        <Link component={NextLink} href="/dashboard/settings" color="inherit">
          Settings
        </Link>
        <Typography color="text.primary">User Management</Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1" gutterBottom>
        User Management
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Manage user access to all applications in your Bunting dashboard.
      </Typography>

      <UserManagement />
    </Box>
  )
}