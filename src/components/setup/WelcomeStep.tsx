import React from 'react'
import Image from 'next/image'
import { Stack, Typography, Alert } from '@mui/material'
import { Security } from '@mui/icons-material'
import { StepProps } from './types'

export function WelcomeStep({ onNext }: StepProps) {
  return (
    <Stack spacing={3} alignItems="center">
      <Image
        src="/images/Icon.png"
        alt="Bunting"
        width={50}
        height={50}
        style={{
          height: "50px",
          width: "auto",
          objectFit: "contain",
          cursor: "pointer",
        }}
      />
      <Typography variant="h4" align="center" gutterBottom>
        Welcome to Bunting!
      </Typography>
      <Typography variant="body1" align="center" color="text.secondary" sx={{ maxWidth: 600 }}>
        Let's set up authentication for your feature flag dashboard.
        You'll configure how team members can sign in to manage your iOS/macOS app flags.
      </Typography>
      <Alert severity="info" sx={{ maxWidth: 600 }}>
        <Typography variant="body2">
          This is a one-time setup process. You can always modify these settings later
          through the admin interface.
        </Typography>
      </Alert>
    </Stack>
  )
}