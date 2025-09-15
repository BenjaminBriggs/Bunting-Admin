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
  CircularProgress,
  Autocomplete,
  Slider,
  Paper,
} from "@mui/material";
import { Save, Rocket } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRollout, fetchCohorts } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useChanges } from "@/lib/changes-context";
import { TargetingRule } from "@/types/rules";
import { PageHeader, RulesContainer } from "@/components";

export default function NewRolloutPage() {
  const router = useRouter();
  const { selectedApp } = useApp();
  const { markChangesDetected } = useChanges();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState(10);
  const [conditions, setConditions] = useState<TargetingRule[]>([]);

  // Data loading
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Redirect if no app is selected
  useEffect(() => {
    if (!selectedApp) {
      router.push("/dashboard");
    }
  }, [selectedApp, router]);

  // Load cohorts for rule building
  useEffect(() => {
    const loadData = async () => {
      if (!selectedApp) return;

      try {
        setLoadingData(true);
        const cohortsData = await fetchCohorts(selectedApp.id);
        setCohorts(cohortsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [selectedApp]);

  const handlePercentageChange = (_: Event, newValue: number | number[]) => {
    const newPercentage = Array.isArray(newValue) ? newValue[0] : newValue;
    setPercentage(newPercentage);
  };

  const generateRolloutKey = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
      .trim()
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^[^a-z]/g, 'rollout_') // Ensure starts with letter
      .substring(0, 50); // Limit length
  };

  const handleSave = async () => {
    if (!selectedApp) {
      setError("No application selected");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const key = generateRolloutKey(name);

      await createRollout({
        appId: selectedApp.id,
        key,
        name,
        description,
        percentage,
        conditions:
          conditions.length > 0
            ? conditions.flatMap((rule) => rule.conditions)
            : [],
      });

      markChangesDetected();
      router.push("/dashboard/rollouts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rollout");
    } finally {
      setSaving(false);
    }
  };

  const isValid = name && percentage >= 0 && percentage <= 100 && selectedApp;

  const getPercentageColor = () => {
    if (percentage === 0) return "warning";
    if (percentage === 100) return "success";
    return "primary";
  };

  if (loadingData) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ mr: 2 }} />
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Create Rollout"
        subtitle="Set up a gradual feature rollout structure. Assign flags after creation."
        backHref="/dashboard/rollouts"
        backLabel="Back to Rollouts"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Configuration */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            {/* Basic Configuration */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Basic Configuration
                </Typography>

                <Stack spacing={3}>
                  <TextField
                    label="Rollout Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., New Dashboard Rollout"
                    helperText="Human-readable name for this rollout"
                    fullWidth
                    required
                  />

                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what features are being rolled out"
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Rollout Percentage */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Rollout Percentage
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Control what percentage of eligible users will receive the new
                  features
                </Typography>

                <Box sx={{ px: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography variant="subtitle1">Current Rollout</Typography>
                    <Typography
                      variant="h4"
                      color={`${getPercentageColor()}.main`}
                    >
                      {percentage}%
                    </Typography>
                  </Box>

                  <Slider
                    value={percentage}
                    onChange={handlePercentageChange}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: "0%" },
                      { value: 25, label: "25%" },
                      { value: 50, label: "50%" },
                      { value: 75, label: "75%" },
                      { value: 100, label: "100%" },
                    ]}
                    sx={{
                      color:
                        percentage === 0
                          ? "warning.main"
                          : percentage === 100
                            ? "success.main"
                            : "primary.main",
                      "& .MuiSlider-thumb": {
                        width: 20,
                        height: 20,
                      },
                      "& .MuiSlider-track": {
                        height: 6,
                      },
                      "& .MuiSlider-rail": {
                        height: 6,
                      },
                    }}
                  />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mt: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {percentage === 0 &&
                        "Rollout paused - no users will see new features"}
                      {percentage > 0 &&
                        percentage < 100 &&
                        `${percentage}% of eligible users will see new features`}
                      {percentage === 100 &&
                        "Full rollout - all eligible users will see new features"}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Entry Conditions */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Entry Conditions (Optional)
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Define which users are eligible for this rollout. If no
                  conditions are set, all users are eligible.
                </Typography>
                <RulesContainer
                  rules={conditions}
                  onChange={setConditions}
                  flagType="bool"
                  defaultValue={true}
                  appId={selectedApp?.id || ""}
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Preview & Actions */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: "sticky", top: 24 }}>
            <Stack spacing={3}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Rollout Preview
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Summary of your rollout configuration
                  </Typography>

                  {name ? (
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Rollout Name
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {name}
                        </Typography>
                      </Box>


                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Rollout Status
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mt: 0.5,
                          }}
                        >
                          <Chip
                            label={`${percentage}%`}
                            size="small"
                            color={getPercentageColor()}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {percentage === 0 && "Paused"}
                            {percentage > 0 && percentage < 100 && "Active"}
                            {percentage === 100 && "Complete"}
                          </Typography>
                        </Box>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Entry Conditions
                        </Typography>
                        <Typography variant="body2">
                          {conditions.length === 0
                            ? "All users eligible"
                            : `${conditions.length} targeting rule${conditions.length === 1 ? "" : "s"}`}
                        </Typography>
                      </Box>

                      {/* Visual Progress Bar */}
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mb: 1, display: "block" }}
                        >
                          Progress Visualization
                        </Typography>
                        <Paper
                          variant="outlined"
                          sx={{ p: 2, bgcolor: "grey.50" }}
                        >
                          <Box
                            sx={{
                              width: "100%",
                              height: 8,
                              bgcolor: "grey.200",
                              borderRadius: 1,
                              overflow: "hidden",
                            }}
                          >
                            <Box
                              sx={{
                                width: `${percentage}%`,
                                height: "100%",
                                bgcolor:
                                  percentage === 0
                                    ? "warning.main"
                                    : percentage === 100
                                      ? "success.main"
                                      : "primary.main",
                                transition: "width 0.3s ease",
                              }}
                            />
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              mt: 1,
                              display: "block",
                              textAlign: "center",
                            }}
                          >
                            {percentage}% of eligible users
                          </Typography>
                        </Paper>
                      </Box>
                    </Stack>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Rocket
                        sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Enter rollout details to see preview
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                  onClick={handleSave}
                  disabled={!isValid || saving}
                  fullWidth
                  size="large"
                >
                  {saving ? "Creating..." : "Create Rollout"}
                </Button>
                <Button
                  variant="outlined"
                  component={Link}
                  href="/dashboard/rollouts"
                  fullWidth
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
