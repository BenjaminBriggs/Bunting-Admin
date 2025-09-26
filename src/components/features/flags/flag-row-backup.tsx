"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Switch,
  TextField,
  Divider,
  Stack,
  Collapse,
  Alert,
  Tooltip,
  FormControl,
  Select,
} from "@mui/material";
import {
  MoreVert,
  Edit,
  Archive,
  ExpandMore,
  ExpandLess,
  Add,
  DragIndicator,
  Delete,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";
import Link from "next/link";
import { DBFlag, Environment, ConditionalVariant, FlagValue } from "@/types";
import ConditionCreatorModal from "./condition-creator-modal";
import { useApp } from "@/lib/app-context";
import { updateFlag } from "@/lib/api";
import { useChanges } from "@/lib/changes-context";

interface FlagRowProps {
  flag: DBFlag;
  archived?: boolean;
}

interface EnvironmentCellProps {
  environment: Environment;
  flag: DBFlag;
  color: string;
  onVariantUpdate: (
    environment: Environment,
    variants: ConditionalVariant[],
  ) => void;
  onDefaultValueUpdate: (environment: Environment, value: FlagValue) => void;
}

function EnvironmentCell({
  environment,
  flag,
  color,
  onVariantUpdate,
  onDefaultValueUpdate,
}: EnvironmentCellProps) {
  const { selectedApp } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [conditionDialog, setConditionDialog] = useState(false);
  const [editingVariant, setEditingVariant] =
    useState<ConditionalVariant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ConditionalVariant | null>(
    null,
  );
  const [editingDefault, setEditingDefault] = useState(false);
  const [tempDefaultValue, setTempDefaultValue] = useState<string>("");

  const defaultValue = flag.defaultValues[environment];
  const variants = flag.variants[environment] || [];

  const formatValue = (value: FlagValue): string => {
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getValueColor = (value: FlagValue) => {
    if (typeof value === "boolean") {
      return value ? "success" : "error";
    }
    return "default";
  };

  const handleEditVariant = (variant: ConditionalVariant) => {
    setEditingVariant(variant);
    setConditionDialog(true);
  };

  const handleDeleteVariant = (variantId: string) => {
    const updatedVariants = variants.filter((v) => v.id !== variantId);
    onVariantUpdate(environment, updatedVariants);
  };

  const confirmDeleteVariant = (variant: ConditionalVariant) => {
    setDeleteConfirm(variant);
  };

  const handleCreateVariant = () => {
    setEditingVariant(null);
    setConditionDialog(true);
  };

  const startEditingDefault = () => {
    setTempDefaultValue(formatValue(defaultValue));
    setEditingDefault(true);
  };

  const cancelEditingDefault = () => {
    setEditingDefault(false);
    setTempDefaultValue("");
  };

  const saveDefaultValue = () => {
    let processedValue: FlagValue;

    try {
      if ((flag.type as any) === "bool" || (flag.type as any) === "BOOL") {
        processedValue = tempDefaultValue === "true";
      } else if ((flag.type as any) === "int" || (flag.type as any) === "INT") {
        processedValue = parseInt(tempDefaultValue) || 0;
      } else if ((flag.type as any) === "double" || (flag.type as any) === "DOUBLE") {
        processedValue = parseFloat(tempDefaultValue) || 0.0;
      } else if ((flag.type as any) === "json" || (flag.type as any) === "JSON") {
        processedValue = JSON.parse(tempDefaultValue);
      } else {
        processedValue = tempDefaultValue;
      }

      onDefaultValueUpdate(environment, processedValue);
      setEditingDefault(false);
      setTempDefaultValue("");
    } catch (error) {
      // Keep editing mode if there's an error (invalid JSON, etc.)
      console.error("Error saving default value:", error);
    }
  };

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderColor: color,
          borderWidth: 2,
          minHeight: 80,
          cursor: variants.length > 0 ? "pointer" : "default",
        }}
        onClick={() => variants.length > 0 && setExpanded(!expanded)}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              Default
            </Typography>
            {!editingDefault && (
              <Tooltip title="Click to edit default value">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingDefault();
                  }}
                  sx={{ p: 0.25 }}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {variants.length > 0 && (
            <Tooltip title="Click to view and edit conditional variants">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Chip
                  label={`${variants.length} variant${variants.length !== 1 ? "s" : ""}`}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
                {expanded ? (
                  <ExpandLess fontSize="small" />
                ) : (
                  <ExpandMore fontSize="small" />
                )}
              </Box>
            </Tooltip>
          )}
        </Box>

        {editingDefault ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(flag.type as any) === "bool" || (flag.type as any) === "BOOL" ? (
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={tempDefaultValue}
                  onChange={(e) => setTempDefaultValue(e.target.value)}
                  autoFocus
                >
                  <MenuItem value="false">false</MenuItem>
                  <MenuItem value="true">true</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <TextField
                value={tempDefaultValue}
                onChange={(e) => setTempDefaultValue(e.target.value)}
                size="small"
                autoFocus
                multiline={flag.type === "json"}
                rows={flag.type === "json" ? 3 : 1}
                sx={{
                  fontFamily: "monospace",
                  "& .MuiInputBase-input": {
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                  },
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && flag.type !== "json") {
                    saveDefaultValue();
                  } else if (e.key === "Escape") {
                    cancelEditingDefault();
                  }
                }}
              />
            )}
            <IconButton size="small" onClick={saveDefaultValue} color="primary">
              <CheckCircle fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={cancelEditingDefault}
              color="secondary"
            >
              <Cancel fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label={formatValue(defaultValue)}
              size="small"
              color={getValueColor(defaultValue)}
              sx={{
                fontFamily: "monospace",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
              onClick={(e) => {
                e.stopPropagation();
                startEditingDefault();
              }}
            />
            <Tooltip title="Add conditional variant">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateVariant();
                }}
                sx={{ p: 0.25 }}
              >
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Paper>

      <Collapse in={expanded && variants.length > 0}>
        <Box sx={{ mt: 1 }}>
          {variants.map((variant, index) => (
            <Paper
              key={variant.id}
              variant="outlined"
              sx={{
                p: 1.5,
                mb: 1,
                bgcolor: "grey.50",
                border: "1px dashed",
                borderColor: "grey.300",
                borderRadius: 1,
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: "grey.100",
                  borderColor: "primary.main",
                  transform: "translateX(2px)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <DragIndicator fontSize="small" color="disabled" />
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {variant.name}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    #{variant.order}
                  </Typography>
                  <Tooltip title="Edit variant conditions and value">
                    <IconButton
                      size="small"
                      onClick={() => handleEditVariant(variant)}
                      sx={{ ml: 1 }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete this variant">
                    <IconButton
                      size="small"
                      onClick={() => confirmDeleteVariant(variant)}
                      color="error"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Chip
                  label={formatValue(variant.value)}
                  size="small"
                  color={getValueColor(variant.value)}
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
                <Typography variant="caption" color="text.secondary">
                  {variant.conditions.length} condition
                  {variant.conditions.length !== 1 ? "s" : ""}
                </Typography>
              </Box>
            </Paper>
          ))}

          <Button
            size="small"
            startIcon={<Add />}
            onClick={(e) => {
              e.stopPropagation();
              handleCreateVariant();
            }}
            sx={{ mt: 1 }}
          >
            Add Variant
          </Button>
        </Box>
      </Collapse>

      <ConditionCreatorModal
        open={conditionDialog}
        onClose={() => {
          setConditionDialog(false);
          setEditingVariant(null);
        }}
        onSave={(variant) => {
          let updatedVariants;
          if (editingVariant) {
            // Update existing variant
            updatedVariants = variants.map((v) =>
              v.id === editingVariant.id ? variant : v,
            );
          } else {
            // Add new variant
            updatedVariants = [...variants, variant];
          }
          // Sort by order
          updatedVariants.sort((a, b) => a.order - b.order);
          onVariantUpdate(environment, updatedVariants);
          setConditionDialog(false);
          setEditingVariant(null);
        }}
        environment={environment}
        flagType={flag.type}
        flagId={flag.id}
        appId={selectedApp?.id}
        existingVariant={editingVariant || undefined}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
      >
        <DialogTitle>Delete Variant</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the variant "{deleteConfirm?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (deleteConfirm) {
                handleDeleteVariant(deleteConfirm.id);
                setDeleteConfirm(null);
              }
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function FlagRow({ flag, archived = false }: FlagRowProps) {
  const { markChangesDetected } = useChanges();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [flagData, setFlagData] = useState<DBFlag>(flag);

  useEffect(() => {
    setFlagData(flag);
  }, [flag]);

  const handleVariantUpdate = async (
    environment: Environment,
    variants: ConditionalVariant[],
  ) => {
    const updatedVariants = {
      ...flagData.variants,
      [environment]: variants,
    };

    try {
      // Update the database
      await updateFlag(flagData.id, {
        variants: updatedVariants,
      });

      // Update local state
      setFlagData((prev) => ({
        ...prev,
        variants: updatedVariants,
      }));

      // Trigger change detection for release tab
      markChangesDetected();
    } catch (error) {
      console.error("Failed to update flag variants:", error);
      // Could add error handling here, like showing a toast
    }
  };

  const handleDefaultValueUpdate = async (
    environment: Environment,
    value: FlagValue,
  ) => {
    const updatedDefaultValues = {
      ...flagData.defaultValues,
      [environment]: value,
    };

    try {
      // Update the database
      await updateFlag(flagData.id, {
        defaultValues: updatedDefaultValues,
      });

      // Update local state
      setFlagData((prev) => ({
        ...prev,
        defaultValues: updatedDefaultValues,
      }));

      // Trigger change detection for release tab
      markChangesDetected();
    } catch (error) {
      console.error("Failed to update flag default values:", error);
      // Could add error handling here, like showing a toast
    }
  };

  const getTypeChipColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "bool":
        return "success";
      case "string":
        return "info";
      case "int":
      case "double":
        return "warning";
      case "json":
        return "secondary";
      case "date":
        return "error";
      default:
        return "default";
    }
  };

  const handleArchive = () => {
    setArchiveDialog(false);
    setMenuAnchor(null);
  };

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, opacity: archived ? 0.6 : 1 }}>
        <Grid container spacing={2}>
          {/* Flag Info Column */}
          <Grid size={{ xs: 3 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <DragIndicator sx={{ color: "text.disabled", mt: 0.5 }} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Typography
                    variant="h6"
                    component="h4"
                    sx={{ fontWeight: 500 }}
                  >
                    {flagData.displayName}
                  </Typography>
                  <Chip
                    label={flagData.type}
                    size="small"
                    color={getTypeChipColor(flagData.type)}
                  />
                  {archived && (
                    <Chip
                      label="Archived"
                      size="small"
                      color="default"
                      variant="outlined"
                    />
                  )}
                </Box>

                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "monospace",
                    bgcolor: "grey.100",
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    mb: 1,
                    fontSize: "0.75rem",
                  }}
                >
                  {flagData.key}
                </Typography>

                {flagData.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    {flagData.description}
                  </Typography>
                )}

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Updated {new Date(flagData.updatedAt).toLocaleDateString()}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Development Column */}
          <Grid size={{ xs: 3 }}>
            <EnvironmentCell
              environment="development"
              flag={flagData}
              color="#4caf50"
              onVariantUpdate={handleVariantUpdate}
              onDefaultValueUpdate={handleDefaultValueUpdate}
            />
          </Grid>

          {/* Staging Column */}
          <Grid size={{ xs: 3}}>
            <EnvironmentCell
              environment="staging"
              flag={flagData}
              color="#ff9800"
              onVariantUpdate={handleVariantUpdate}
              onDefaultValueUpdate={handleDefaultValueUpdate}
            />
          </Grid>

          {/* Production Column */}
          <Grid size={{ xs: 3}}>
            <EnvironmentCell
              environment="production"
              flag={flagData}
              color="#f44336"
              onVariantUpdate={handleVariantUpdate}
              onDefaultValueUpdate={handleDefaultValueUpdate}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          component={Link}
          href={`/dashboard/flags/${flagData.id}/edit`}
          onClick={() => setMenuAnchor(null)}
        >
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit Flag
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setArchiveDialog(true);
            setMenuAnchor(null);
          }}
          sx={{ color: "error.main" }}
        >
          <Archive fontSize="small" sx={{ mr: 1 }} />
          {archived ? "Unarchive" : "Archive"}
        </MenuItem>
      </Menu>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialog} onClose={() => setArchiveDialog(false)}>
        <DialogTitle>{archived ? "Unarchive" : "Archive"} Flag</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {archived ? "unarchive" : "archive"} the
            flag "{flagData.displayName}"?
            {!archived &&
              " This will remove it from active configuration but preserve its data."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialog(false)}>Cancel</Button>
          <Button
            onClick={handleArchive}
            color={archived ? "primary" : "error"}
            variant="contained"
          >
            {archived ? "Unarchive" : "Archive"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
