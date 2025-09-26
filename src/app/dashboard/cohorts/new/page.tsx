"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Stack,
  Grid,
  Alert,
  Chip,
  LinearProgress,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import { Save } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCohort } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useChanges } from "@/lib/changes-context";
import { Condition } from "@/types";
import { PageHeader } from "@/components";
import { ConditionsContainer } from "@/components/features/conditions";

// Normalize cohort identifier
function normalizeCohortId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function NewCohortPage() {
  const router = useRouter();
  const { selectedApp } = useApp();
  const { markChangesDetected } = useChanges();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Redirect if no app is selected
  useEffect(() => {
    if (!selectedApp) {
      router.push("/dashboard");
    }
  }, [selectedApp, router]);

  const handleNameChange = (value: string) => {
    setName(value);
    setIdentifier(normalizeCohortId(value));
  };

  const handleSave = async () => {
    if (!selectedApp) {
      setError("No application selected");
      return;
    }

    try {
      setSaving(true);
      const cohortData = {
        appId: selectedApp.id,
        key: identifier,
        name,
        description,
        conditions: conditions,
      };

      const newCohort = await createCohort(cohortData);

      // Trigger change detection
      markChangesDetected();
      router.push(`/dashboard/cohorts/${newCohort.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cohort");
    } finally {
      setSaving(false);
    }
  };

  const isValid = name && selectedApp;

  return (
    <Box>
      <PageHeader
        title="Create Cohort"
        subtitle="Create a reusable rule group for targeting specific user segments"
        backHref="/dashboard/cohorts"
        backLabel="Back to Cohorts"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Main Configuration */}
        <Box sx={{ flex: '1 1 auto', maxWidth: { xs: '100%', md: '66.67%' } }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Basic Configuration
              </Typography>

              <Stack spacing={3}>
                {/* Name */}
                <TextField
                  label="Cohort Name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Beta Users"
                  helperText="Human-readable name for this cohort"
                  fullWidth
                  required
                />

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

          <Card>
            <CardContent sx={{ p: 3 }}>
              {/* Targeting Conditions */}
              <ConditionsContainer
                conditions={conditions}
                onChange={setConditions}
                appId={selectedApp?.id || ""}
                title="Targeting Conditions"
                description="Define the criteria that determine which users belong to this cohort"
                emptyMessage="No conditions defined. All users will be included in this cohort."
              />
            </CardContent>
          </Card>
        </Box>

        {/* Preview & Actions */}
        <Box sx={{ flex: '0 0 auto', width: { xs: '100%', md: '33.33%' } }}>
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
                  How this cohort will appear in your configuration
                </Typography>

                {name ? (
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
                        Auto-generated Identifier
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
                ) : (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Enter a cohort name to see preview
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!isValid || saving}
                fullWidth
              >
                {saving ? "Creating..." : "Create Cohort"}
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
        </Box>
      </Box>
    </Box>
  );
}
