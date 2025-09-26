"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import { Close, Warning, Info, CheckCircle, Error } from '@mui/icons-material';

export interface FormModalAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  disabled?: boolean;
  startIcon?: React.ReactNode;
  loading?: boolean;
}

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;

  // Actions
  primaryAction?: FormModalAction;
  secondaryAction?: FormModalAction;
  cancelAction?: FormModalAction;
  additionalActions?: FormModalAction[];

  // State management
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  success?: string | null;
  warning?: string | null;
  info?: string | null;

  // Configuration
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  hideCloseButton?: boolean;

  // Form validation
  canSubmit?: boolean;
  validationErrors?: string[];
  disableOnValidationErrors?: boolean; // Whether to auto-disable button on validation errors
}

export function FormModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  primaryAction,
  secondaryAction,
  cancelAction,
  additionalActions = [],
  loading = false,
  saving = false,
  error,
  success,
  warning,
  info,
  maxWidth = 'sm',
  fullWidth = true,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  hideCloseButton = false,
  canSubmit = true,
  validationErrors = [],
  disableOnValidationErrors = false, // Default to false to avoid the trap
}: FormModalProps) {

  const handleClose = () => {
    if (!saving && !loading) {
      onClose();
    }
  };

  const handleBackdropClick = () => {
    if (!disableBackdropClick) {
      handleClose();
    }
  };

  const handleEscapeKeyDown = () => {
    if (!disableEscapeKeyDown) {
      handleClose();
    }
  };

  const renderActionButton = (action: FormModalAction, key: string) => {
    const { label, onClick, variant = 'text', color = 'inherit', disabled, startIcon, loading: actionLoading } = action;

    return (
      <Button
        key={key}
        variant={variant}
        color={color}
        onClick={onClick}
        disabled={disabled || loading || saving}
        startIcon={actionLoading ? <CircularProgress size={16} /> : startIcon}
      >
        {actionLoading ? 'Loading...' : label}
      </Button>
    );
  };

  const renderAlert = (severity: 'error' | 'warning' | 'info' | 'success', message: string) => {
    const icons = {
      error: <Error />,
      warning: <Warning />,
      info: <Info />,
      success: <CheckCircle />,
    };

    return (
      <Alert severity={severity} icon={icons[severity]} sx={{ mb: 2 }}>
        {message}
      </Alert>
    );
  };

  // Default actions if not provided
  const defaultCancelAction: FormModalAction = cancelAction || {
    label: 'Cancel',
    onClick: handleClose,
    variant: 'outlined',
  };

  const defaultPrimaryAction: FormModalAction | undefined = primaryAction && {
    variant: 'contained',
    color: 'primary',
    disabled: !canSubmit || (disableOnValidationErrors && validationErrors.length > 0),
    loading: saving,
    ...primaryAction,
  };

  return (
    <Dialog
      open={open}
      onClose={handleBackdropClick}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          handleEscapeKeyDown();
        }
      }}
      PaperProps={{
        sx: {
          minHeight: '200px',
        },
      }}
    >
      {/* Header */}
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Box>
              <Typography variant="h6">{title}</Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>

          {!hideCloseButton && (
            <IconButton
              onClick={handleClose}
              size="small"
              disabled={saving || loading}
              sx={{ ml: 1 }}
            >
              <Close />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <Divider />

      {/* Content */}
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {/* Loading State */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress sx={{ mr: 2 }} />
              <Typography>Loading...</Typography>
            </Box>
          )}

          {/* Alert Messages */}
          {error && renderAlert('error', error)}
          {warning && renderAlert('warning', warning)}
          {success && renderAlert('success', success)}
          {info && renderAlert('info', info)}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Please fix the following issues:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {validationErrors.map((errorMsg, index) => (
                  <li key={index}>{errorMsg}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Main Content */}
          {!loading && children}
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'flex-end' }}>
          {/* Additional actions (left-aligned) */}
          {additionalActions.length > 0 && (
            <Box sx={{ mr: 'auto', display: 'flex', gap: 1 }}>
              {additionalActions.map((action, index) =>
                renderActionButton(action, `additional-${index}`)
              )}
            </Box>
          )}

          {/* Main actions (right-aligned) */}
          {renderActionButton(defaultCancelAction, 'cancel')}
          {secondaryAction && renderActionButton(secondaryAction, 'secondary')}
          {defaultPrimaryAction && renderActionButton(defaultPrimaryAction, 'primary')}
        </Box>
      </DialogActions>
    </Dialog>
  );
}

// Higher-order components for common modal patterns
export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'warning',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'info' | 'warning' | 'error';
  loading?: boolean;
}) {
  const icons = {
    info: <Info color="info" />,
    warning: <Warning color="warning" />,
    error: <Error color="error" />,
  };

  const colors = {
    info: 'info' as const,
    warning: 'warning' as const,
    error: 'error' as const,
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      icon={icons[severity]}
      maxWidth="xs"
      primaryAction={{
        label: confirmLabel,
        onClick: onConfirm,
        variant: 'contained',
        color: colors[severity],
        loading,
      }}
      cancelAction={{
        label: cancelLabel,
        onClick: onClose,
        variant: 'outlined',
      }}
      saving={loading}
    >
      <Typography>{message}</Typography>
    </FormModal>
  );
}

// Utility hook for managing modal state
export function useFormModal(initialOpen: boolean = false) {
  const [open, setOpen] = React.useState(initialOpen);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const openModal = () => {
    setOpen(true);
    setError(null);
    setSuccess(null);
  };

  const closeModal = () => {
    setOpen(false);
    setLoading(false);
    setSaving(false);
    setError(null);
    setSuccess(null);
  };

  const handleAsyncAction = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      setSuccess('Operation completed successfully');
      // Optionally close modal after successful action
      // closeModal();
    } catch (err) {
      setError((err as any)?.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return {
    open,
    loading,
    saving,
    error,
    success,
    openModal,
    closeModal,
    setLoading,
    setSaving,
    setError,
    setSuccess,
    handleAsyncAction,
  };
}