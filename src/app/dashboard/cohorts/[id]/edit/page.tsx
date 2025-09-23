"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Stack,
  Grid,
  Chip,
  Alert,
  Paper,
} from "@mui/material";
import { ArrowBack, Save, Delete } from "@mui/icons-material";
import Link from "next/link";
import {
  fetchCohort,
  updateCohort,
  deleteCohort,
  type Cohort,
} from "@/lib/api";
import { useChanges } from "@/lib/changes-context";
import { Condition } from "@/types";
import { ConditionsContainer } from "@/components/features/conditions";

export default function EditCohortPage() {
  const params = useParams();
  const router = useRouter();
  const { markChangesDetected } = useChanges();
  const cohortId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [originalIdentifier, setOriginalIdentifier] = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([]);

  useEffect(() => {
    const loadCohort = async () => {
      try {
        setLoading(true);
        const cohortData = await fetchCohort(cohortId);
        setCohort(cohortData);
        setName(cohortData.name);
        setOriginalName(cohortData.name);
        setIdentifier(cohortData.key);
        setOriginalIdentifier(cohortData.key);
        setDescription(cohortData.description || "");
        setConditions(cohortData.conditions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cohort");
      } finally {
        setLoading(false);
      }
    };

    loadCohort();
  }, [cohortId]);

  const handleSave = async () => {
    if (!cohort) return;

    try {
      setSaving(true);
      const updateData = {
        description,
        conditions: conditions,
      };

      const updatedCohort = await updateCohort(cohort.id, updateData);
      setCohort(updatedCohort);
      setDescription(updatedCohort.description || "");
      setSuccessMessage("Cohort updated successfully!");

      // Trigger change detection
      markChangesDetected();

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cohort");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!cohort) return;

    if (
      confirm(
        "Are you sure you want to delete this cohort? This action cannot be undone.",
      )
    ) {
      try {
        await deleteCohort(cohortId);

        // Trigger change detection
        markChangesDetected();
        router.push("/dashboard/cohorts");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete cohort",
        );
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <Typography>Loading cohort...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button component={Link} href="/dashboard/cohorts">
          Back to Cohorts
        </Button>
      </Box>
    );
  }

  if (!cohort) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Cohort Not Found
        </Typography>
        <Button component={Link} href="/dashboard/cohorts">
          Back to Cohorts
        </Button>
      </Box>
    );
  }

  const isValid = name;
  const hasChanges =
    description !== (cohort?.description || "") ||
    JSON.stringify(conditions) !== JSON.stringify(cohort?.conditions || []);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            startIcon={<ArrowBack />}
            component={Link}
            href="/dashboard/cohorts"
            sx={{ mr: 2 }}
          >
            Back to Cohorts
          </Button>
          <Box>
            <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
              Edit Cohort
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modify the rule group configuration for {cohort.name}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<Delete />}
          onClick={handleDelete}
          color="error"
        >
          Delete
        </Button>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Configuration */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Basic Configuration
                </Typography>

                <Stack spacing={3}>
                  {/* Name - Read Only */}
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Cohort Name
                    </Typography>
                    <Box
                      sx={{
                        fontSize: "1rem",
                        bgcolor: "grey.50",
                        p: 1.5,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {name}
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: "block" }}
                    >
                      Cohort name cannot be changed after creation to maintain
                      consistency
                    </Typography>
                  </Box>

                  {/* Identifier Display */}
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Cohort Identifier
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                        bgcolor: "grey.50",
                        p: 1.5,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {identifier}
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: "block" }}
                    >
                      Used in code to reference this cohort
                    </Typography>
                  </Box>

                  {/* Description */}
                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the purpose of this cohort"
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Targeting Rules */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <ConditionsContainer
                  conditions={conditions}
                  onChange={setConditions}
                  appId={cohort?.appId || ""}
                  title="Targeting Conditions"
                  description="Define the criteria that determine which users belong to this cohort"
                  emptyMessage="No conditions defined. All users will be included in this cohort."
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Preview & Actions */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Preview
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  How this rule group will appear in your configuration
                </Typography>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {name}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Identifier
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                        bgcolor: "grey.100",
                        p: 1,
                        borderRadius: 1,
                        mt: 0.5,
                      }}
                    >
                      {identifier}
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Conditions
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {conditions.length === 0
                        ? "No targeting conditions defined"
                        : `${conditions.length} targeting condition${conditions.length === 1 ? "" : "s"}`}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      JSON Configuration
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        bgcolor: "grey.100",
                        p: 1.5,
                        borderRadius: 1,
                        mt: 0.5,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {JSON.stringify(
                        {
                          [identifier]: {
                            conditions: conditions.map((condition) => ({
                              field: condition.type,
                              operator: condition.operator,
                              values: condition.values,
                            })),
                            ...(description && { description }),
                          },
                        },
                        null,
                        2,
                      )}
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Change Summary */}
            {hasChanges && (
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Pending Changes
                  </Typography>
                  <Stack spacing={1}>
                    {name !== originalName && (
                      <Typography variant="body2">
                        • Name: <code>{originalName}</code> →{" "}
                        <code>{name}</code>
                      </Typography>
                    )}
                    {identifier !== originalIdentifier && (
                      <Typography variant="body2">
                        • Identifier: <code>{originalIdentifier}</code> →{" "}
                        <code>{identifier}</code>
                      </Typography>
                    )}
                    {description !== (cohort.description || "") && (
                      <Typography variant="body2">
                        • Description updated
                      </Typography>
                    )}
                    {JSON.stringify(conditions) !==
                      JSON.stringify(cohort?.conditions || []) && (
                      <Typography variant="body2">
                        • Targeting conditions updated
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!isValid || !hasChanges || saving}
                fullWidth
                size="large"
              >
                {saving
                  ? "Saving..."
                  : !hasChanges
                    ? "No Changes to Save"
                    : "Save Changes"}
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href="/dashboard/cohorts"
                fullWidth
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
