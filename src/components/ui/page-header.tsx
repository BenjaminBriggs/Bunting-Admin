"use client";

import { ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  actions,
}: PageHeaderProps) {
  return (
    <Box 
      sx={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: actions ? "space-between" : "flex-start",
        mb: 3 
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Button
          startIcon={<ArrowBack />}
          component={Link}
          href={backHref}
          sx={{ mr: 2 }}
        >
          {backLabel}
        </Button>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: subtitle ? 1 : 0 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {actions && (
        <Box sx={{ display: "flex", gap: 1 }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}