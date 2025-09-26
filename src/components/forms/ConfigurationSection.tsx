"use client";

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Paper,
  Divider,
  Chip,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import { ExpandMore, ExpandLess, Info, Warning, Error, CheckCircle } from '@mui/icons-material';

export interface ConfigurationSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;

  // Status and validation
  status?: 'default' | 'success' | 'warning' | 'error';
  statusMessage?: string;
  required?: boolean;

  // Layout options
  variant?: 'default' | 'compact' | 'outlined' | 'elevated';
  collapsible?: boolean;
  defaultExpanded?: boolean;
  spacing?: number;

  // Actions
  actions?: React.ReactNode;

  // Visual enhancements
  badge?: string | number;
  highlight?: boolean;
}

export function ConfigurationSection({
  title,
  subtitle,
  description,
  icon,
  children,
  status = 'default',
  statusMessage,
  required = false,
  variant = 'default',
  collapsible = false,
  defaultExpanded = true,
  spacing = 3,
  actions,
  badge,
  highlight = false,
}: ConfigurationSectionProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const handleToggle = () => {
    if (collapsible) {
      setExpanded(!expanded);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" sx={{ fontSize: 20 }} />;
      case 'warning':
        return <Warning color="warning" sx={{ fontSize: 20 }} />;
      case 'error':
        return <Error color="error" sx={{ fontSize: 20 }} />;
      case 'info':
        return <Info color="info" sx={{ fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success.main';
      case 'warning':
        return 'warning.main';
      case 'error':
        return 'error.main';
      case 'info':
        return 'info.main';
      default:
        return 'primary.main';
    }
  };

  const renderHeader = () => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: collapsible ? 'pointer' : 'default',
        '&:hover': collapsible ? { bgcolor: 'action.hover', borderRadius: 1 } : {},
        p: collapsible ? 1 : 0,
        mx: collapsible ? -1 : 0,
      }}
      onClick={handleToggle}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        {icon}

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: highlight ? 600 : 500,
                color: highlight ? getStatusColor(status) : 'text.primary',
              }}
            >
              {title}
            </Typography>

            {required && (
              <Chip
                label="Required"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20 }}
              />
            )}

            {badge && (
              <Chip
                label={badge}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 20 }}
              />
            )}
          </Box>

          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {getStatusIcon(status)}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {actions}

        {collapsible && (
          <IconButton size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        )}
      </Box>
    </Box>
  );

  const renderContent = () => (
    <Stack spacing={spacing}>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}

      {statusMessage && (
        <Alert severity={status === 'default' ? 'info' : status}>
          {statusMessage}
        </Alert>
      )}

      {children}
    </Stack>
  );

  const content = (
    <Stack spacing={2}>
      {renderHeader()}

      <Collapse in={expanded || !collapsible}>
        {renderContent()}
      </Collapse>
    </Stack>
  );

  // Render based on variant
  switch (variant) {
    case 'outlined':
      return (
        <Paper variant="outlined" sx={{ p: 3 }}>
          {content}
        </Paper>
      );

    case 'elevated':
      return (
        <Card elevation={2}>
          <CardContent sx={{ p: 3 }}>
            {content}
          </CardContent>
        </Card>
      );

    case 'compact':
      return (
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Stack spacing={1.5}>
            {renderHeader()}

            <Collapse in={expanded || !collapsible}>
              <Box sx={{ pt: 1 }}>
                {renderContent()}
              </Box>
            </Collapse>
          </Stack>
        </Box>
      );

    default:
      return (
        <Box sx={{ py: 2 }}>
          {content}
          {variant === 'default' && <Divider sx={{ mt: 3 }} />}
        </Box>
      );
  }
}

// Specialized configuration section variants
export function SettingsSection(props: Omit<ConfigurationSectionProps, 'variant'>) {
  return <ConfigurationSection {...props} variant="outlined" />;
}

export function SetupSection(props: Omit<ConfigurationSectionProps, 'variant' | 'collapsible'>) {
  return <ConfigurationSection {...props} variant="elevated" collapsible={false} />;
}

export function CompactSection(props: Omit<ConfigurationSectionProps, 'variant'>) {
  return <ConfigurationSection {...props} variant="compact" />;
}

// Group component for related sections
interface ConfigurationGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  spacing?: number;
  variant?: 'default' | 'card' | 'paper';
}

export function ConfigurationGroup({
  title,
  description,
  children,
  spacing = 4,
  variant = 'default',
}: ConfigurationGroupProps) {
  const content = (
    <Stack spacing={spacing}>
      {(title || description) && (
        <Box sx={{ mb: 2 }}>
          {title && (
            <Typography variant="h5" sx={{ mb: 1 }}>
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body1" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
      )}

      {children}
    </Stack>
  );

  switch (variant) {
    case 'card':
      return (
        <Card>
          <CardContent sx={{ p: 4 }}>
            {content}
          </CardContent>
        </Card>
      );

    case 'paper':
      return (
        <Paper sx={{ p: 4 }}>
          {content}
        </Paper>
      );

    default:
      return <Box>{content}</Box>;
  }
}

// Utility components for common configuration patterns
export function KeyValueSection({
  title,
  items,
  ...props
}: Omit<ConfigurationSectionProps, 'children'> & {
  items: Array<{ key: string; value: React.ReactNode; description?: string }>;
}) {
  return (
    <ConfigurationSection {...props} title={title}>
      <Stack spacing={2}>
        {items.map((item, index) => (
          <Box key={index}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {item.key}
              </Typography>
              <Box>{item.value}</Box>
            </Box>
            {item.description && (
              <Typography variant="caption" color="text.secondary">
                {item.description}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </ConfigurationSection>
  );
}