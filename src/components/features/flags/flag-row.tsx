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
} from "@mui/material";
import { MoreVert, Archive, Delete } from "@mui/icons-material";
import { DBFlag, Environment, ConditionalVariant, DBTestRollout } from "@/types";
import { formatTimestamp } from "@/lib/utils";
import { updateFlag, fetchTestsAndRolloutsForFlag, archiveFlag, deleteFlag } from "@/lib/api";
import { useChanges } from "@/lib/changes-context";
import { useApp } from "@/lib/app-context";
import EnvironmentColumn from "./environment-column";
import { VariantCreatorModal } from "../conditions";
import TestRolloutAssignmentModal from "./test-rollout-assignment-modal";
import DefaultValueEditModal from "./default-value-edit-modal";
import FlagAssignmentEditModal from "./flag-assignment-edit-modal";

interface FlagRowProps {
  flag: DBFlag;
  archived?: boolean;
}

export default function FlagRow({ flag, archived = false }: FlagRowProps) {
  const { markChangesDetected } = useChanges();
  const { selectedApp } = useApp();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [flagData, setFlagData] = useState<DBFlag>(flag);
  const [testsAndRollouts, setTestsAndRollouts] = useState<{tests: DBTestRollout[], rollouts: DBTestRollout[]}>({
    tests: [],
    rollouts: []
  });
  
  // Modal states
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [testRolloutModalOpen, setTestRolloutModalOpen] = useState(false);
  const [defaultValueModalOpen, setDefaultValueModalOpen] = useState(false);
  const [assignmentEditModalOpen, setAssignmentEditModalOpen] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment>("development");
  const [editingVariant, setEditingVariant] = useState<ConditionalVariant | null>(null);
  const [editingItem, setEditingItem] = useState<{type: 'test' | 'rollout', id: string} | null>(null);

  // Fetch tests and rollouts that include this flag
  useEffect(() => {
    const loadTestsAndRollouts = async () => {
      if (!selectedApp) return;
      
      try {
        const data = await fetchTestsAndRolloutsForFlag(selectedApp.id, flagData.id);
        setTestsAndRollouts(data);
      } catch (error) {
        console.error('Failed to fetch tests and rollouts for flag:', error);
      }
    };

    loadTestsAndRollouts();
  }, [selectedApp, flagData.id]);

  const getActiveTests = (env: Environment) => {
    return testsAndRollouts.tests
      .filter(test => {
        if (test.archived) return false;
        
        // Only include tests that have this flag AND have values for this environment
        if (!test.flagIds.includes(flagData.id)) return false;
        
        // Check if any variant has values for this environment and flag
        if (test.variants && typeof test.variants === 'object') {
          return Object.values(test.variants).some((variant: any) => {
            return variant.values && 
                   variant.values[env] && 
                   variant.values[env][flagData.id] !== undefined;
          });
        }
        
        return false;
      })
      .map(test => ({
        id: test.id,
        name: test.name,
        variants: test.variants || {}
      }));
  };

  const getActiveRollouts = (env: Environment) => {
    return testsAndRollouts.rollouts
      .filter(rollout => {
        if (rollout.archived) return false;
        
        // Only include rollouts that have this flag AND have values for this environment
        if (!rollout.flagIds.includes(flagData.id)) return false;
        
        // Check if rollout has values for this environment and flag
        return rollout.rolloutValues &&
               (rollout.rolloutValues as any)[env] &&
               (rollout.rolloutValues as any)[env][flagData.id] !== undefined;
      })
      .map(rollout => ({
        id: rollout.id,
        name: rollout.name,
        percentage: rollout.percentage || 0
      }));
  };

  const getEnvironmentVariants = (env: Environment): ConditionalVariant[] => {
    return flagData.variants?.[env] || [];
  };

  const handleVariantAdd = (environment: Environment) => {
    setSelectedEnvironment(environment);
    setEditingVariant(null);
    setVariantModalOpen(true);
  };

  const handleVariantEdit = (variant: ConditionalVariant, environment: Environment) => {
    setSelectedEnvironment(environment);
    setEditingVariant(variant);
    setVariantModalOpen(true);
  };

  const handleVariantDelete = async (variant: ConditionalVariant, environment: Environment) => {
    const variantName = variant.name || formatVariantSummary(variant);

    if (!window.confirm(`Are you sure you want to delete the variant "${variantName}"? This action cannot be undone.`)) {
      return;
    }

    const currentVariants = getEnvironmentVariants(environment);
    const updatedVariants = currentVariants.filter((v) => v.id !== variant.id);

    const updatedFlagVariants = {
      ...flagData.variants,
      [environment]: updatedVariants,
    };

    try {
      // Update database
      await updateFlag(flagData.id, {
        variants: updatedFlagVariants,
      });

      // Update local state
      setFlagData((prev) => ({
        ...prev,
        variants: updatedFlagVariants,
      }));

      // Trigger change detection
      markChangesDetected();
    } catch (error) {
      console.error("Failed to delete flag variant:", error);
      alert('Failed to delete variant. Please try again.');
    }
  };

  const formatVariantSummary = (variant: ConditionalVariant): string => {
    const conditions = variant.conditions || [];
    if (conditions.length === 0) {
      return "No conditions";
    }

    // Generate intelligent summaries for common patterns
    if (conditions.length === 1) {
      return formatSingleCondition(conditions[0]);
    }

    // For multiple conditions, show abbreviated summary
    if (conditions.length <= 3) {
      return conditions.map(formatSingleCondition).join(", ");
    }

    // For many conditions, group by type
    const grouped = conditions.reduce((acc, condition) => {
      acc[condition.type] = (acc[condition.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parts = Object.entries(grouped).map(([type, count]) => {
      const typeName = formatConditionType(type);
      return count === 1 ? typeName : `${count} ${typeName}`;
    });

    return parts.join(", ");
  };

  const formatSingleCondition = (condition: any): string => {
    const { type, operator, values } = condition;

    switch (type) {
      case 'environment':
        return `${formatOperator(operator)} ${values.join(", ")}`;

      case 'app_version':
        if (operator === 'greater_than_or_equal') {
          return `v${values[0]}+`;
        }
        if (operator === 'less_than') {
          return `< v${values[0]}`;
        }
        return `${formatOperator(operator)} v${values.join(", ")}`;

      case 'platform':
        return formatOperator(operator) === 'equals'
          ? values.join(", ")
          : `${formatOperator(operator)} ${values.join(", ")}`;

      case 'region':
        return `${formatOperator(operator)} ${values.join(", ")}`;

      case 'cohort':
        return `in ${values.join(", ")}`;

      default:
        return `${formatConditionType(type)} ${formatOperator(operator)} ${values.join(", ")}`;
    }
  };

  const formatConditionType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'environment': 'env',
      'app_version': 'version',
      'os_version': 'OS',
      'platform': 'platform',
      'region': 'region',
      'cohort': 'cohort'
    };
    return typeMap[type] || type;
  };

  const formatOperator = (operator: string): string => {
    const operatorMap: Record<string, string> = {
      'equals': 'is',
      'not_equals': 'not',
      'greater_than': '>',
      'less_than': '<',
      'greater_than_or_equal': '>=',
      'less_than_or_equal': '<=',
      'in': 'in',
      'not_in': 'not in'
    };
    return operatorMap[operator] || operator;
  };

  const handleVariantSave = async (variant: ConditionalVariant) => {
    console.log('Received variant in handleVariantSave:', variant); // Debug log

    const currentVariants = getEnvironmentVariants(selectedEnvironment);
    let updatedVariants;

    if (editingVariant) {
      // Update existing variant
      updatedVariants = currentVariants.map((v) =>
        v.id === editingVariant.id ? variant : v
      );
    } else {
      // Add new variant
      updatedVariants = [...currentVariants, variant];
    }

    // Sort by order
    updatedVariants.sort((a, b) => a.order - b.order);

    const updatedFlagVariants = {
      ...flagData.variants,
      [selectedEnvironment]: updatedVariants,
    };

    console.log('About to save variants:', updatedFlagVariants); // Debug log

    try {
      // Update database
      await updateFlag(flagData.id, {
        variants: updatedFlagVariants,
      });

      // Update local state
      setFlagData((prev) => ({
        ...prev,
        variants: updatedFlagVariants,
      }));

      // Trigger change detection
      markChangesDetected();
      setVariantModalOpen(false);
    } catch (error) {
      console.error("Failed to update flag variants:", error);
    }
  };

  const refreshTestsAndRollouts = async () => {
    if (!selectedApp) return;
    
    console.log('Refreshing tests and rollouts for flag:', flagData.id);
    
    try {
      const data = await fetchTestsAndRolloutsForFlag(selectedApp.id, flagData.id);
      console.log('Refreshed data:', data);
      setTestsAndRollouts(data);
    } catch (error) {
      console.error('Failed to refresh tests and rollouts for flag:', error);
    }
  };

  const handleTestRolloutAdd = (environment: Environment) => {
    setSelectedEnvironment(environment);
    setTestRolloutModalOpen(true);
  };

  const handleTestRolloutAssignmentComplete = () => {
    // Refresh the test/rollout data after assignment
    refreshTestsAndRollouts();
    setTestRolloutModalOpen(false);
  };

  const handleTestRolloutEdit = (type: 'test' | 'rollout', id: string, environment: Environment) => {
    setEditingItem({ type, id });
    setSelectedEnvironment(environment);
    setAssignmentEditModalOpen(true);
  };

  const handleAssignmentEditComplete = () => {
    // Refresh the test/rollout data after editing
    refreshTestsAndRollouts();
    setAssignmentEditModalOpen(false);
    setEditingItem(null);
  };

  const handleDefaultValueEdit = (environment: Environment) => {
    setSelectedEnvironment(environment);
    setDefaultValueModalOpen(true);
  };

  const handleDefaultValueSave = async (newValue: any) => {
    // Update local state
    setFlagData((prev) => ({
      ...prev,
      defaultValues: {
        ...prev.defaultValues,
        [selectedEnvironment]: newValue,
      },
    }));

    // Trigger change detection
    markChangesDetected();
  };

  const handleArchive = async () => {
    try {
      const updatedFlag = await archiveFlag(flagData.id, !archived);
      setFlagData(updatedFlag);
      markChangesDetected();
      setMenuAnchor(null);
    } catch (error) {
      console.error('Failed to archive/unarchive flag:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete "${flagData.displayName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteFlag(flagData.id);
      markChangesDetected();
      // The flag will be removed from the list by the parent component's refresh
      window.location.reload(); // Quick solution - ideally parent should handle this
    } catch (error) {
      console.error('Failed to delete flag:', error);
      alert('Failed to delete flag. Please try again.');
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
      case "date":
        return "secondary";
      case "json":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        overflow: "hidden",
        opacity: archived ? 0.6 : 1,
      }}
    >
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3} alignItems="stretch">
          {/* Column 1: Flag Info */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                  {flagData.displayName}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                >
                  <MoreVert />
                </IconButton>
              </Box>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontFamily: "monospace", mb: 1 }}
              >
                {flagData.key}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Chip
                  label={flagData.type.toLowerCase()}
                  size="small"
                  color={getTypeChipColor(flagData.type)}
                />
                {archived && (
                  <Chip label="Archived" size="small" color="warning" />
                )}
              </Box>

              {flagData.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, flexGrow: 1 }}
                >
                  {flagData.description}
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary">
                Updated {formatTimestamp(flagData.updatedAt)}
              </Typography>
            </Box>
          </Grid>

          {/* Columns 2-4: Environment Columns */}
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={2}>
              {(["production", "staging", "development"] as Environment[]).map((env) => (
                <Grid size={{ xs: 12, md: 4 }} key={env}>
                  <EnvironmentColumn
                    environment={env}
                    flagId={flagData.id}
                    flagType={flagData.type}
                    defaultValue={flagData.defaultValues[env]}
                    variants={getEnvironmentVariants(env)}
                    activeTests={getActiveTests(env) as any}
                    activeRollouts={getActiveRollouts(env)}
                    onVariantAdd={() => handleVariantAdd(env)}
                    onVariantEdit={(variant) => handleVariantEdit(variant, env)}
                    onVariantDelete={(variant) => handleVariantDelete(variant, env)}
                    onTestRolloutAdd={() => handleTestRolloutAdd(env)}
                    onTestRolloutEdit={(type, id) => handleTestRolloutEdit(type, id, env)}
                    onDefaultValueEdit={() => handleDefaultValueEdit(env)}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleArchive}>
          <Archive sx={{ mr: 1 }} />
          {archived ? "Unarchive" : "Archive"}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Variant Creator Modal */}
      <VariantCreatorModal
        open={variantModalOpen}
        onClose={() => setVariantModalOpen(false)}
        onSave={handleVariantSave}
        environment={selectedEnvironment}
        flagType={flagData.type}
        flagId={flagData.id}
        appId={selectedApp?.id}
        existingVariant={editingVariant || undefined}
      />

      {/* Test/Rollout Assignment Modal */}
      <TestRolloutAssignmentModal
        open={testRolloutModalOpen}
        onClose={() => setTestRolloutModalOpen(false)}
        environment={selectedEnvironment}
        flagId={flagData.id}
        flagName={flagData.displayName}
        flagType={flagData.type}
        onComplete={handleTestRolloutAssignmentComplete}
      />

      {/* Default Value Edit Modal */}
      <DefaultValueEditModal
        open={defaultValueModalOpen}
        onClose={() => setDefaultValueModalOpen(false)}
        onSave={handleDefaultValueSave}
        environment={selectedEnvironment}
        flagId={flagData.id}
        flagType={flagData.type}
        currentValue={flagData.defaultValues[selectedEnvironment]}
        flagName={flagData.displayName}
        allDefaultValues={flagData.defaultValues}
      />

      {/* Flag Assignment Edit Modal */}
      {editingItem && (
        <FlagAssignmentEditModal
          open={assignmentEditModalOpen}
          onClose={() => setAssignmentEditModalOpen(false)}
          onSave={handleAssignmentEditComplete}
          type={editingItem.type}
          itemId={editingItem.id}
          flagId={flagData.id}
          flagName={flagData.displayName}
          flagType={flagData.type}
          environment={selectedEnvironment}
        />
      )}
    </Paper>
  );
}