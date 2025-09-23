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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Divider,
  CircularProgress,
  Paper,
} from "@mui/material";
import { Save, Add, Delete, Science } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTestRollout, fetchFlags, fetchCohorts } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useChanges } from "@/lib/changes-context";
import { PageHeader } from "@/components";
import { Condition } from "@/types";
import { ConditionsContainer } from "@/components/features/conditions";

interface TestGroup {
  name: string;
  percentage: number;
}

export default function NewTestPage() {
  const router = useRouter();
  const { selectedApp } = useApp();
  const { markChangesDetected } = useChanges();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [numGroups, setNumGroups] = useState(2);
  const [testGroups, setTestGroups] = useState<TestGroup[]>([
    { name: "Control", percentage: 50 },
    { name: "Treatment", percentage: 50 },
  ]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Data loading
  const [flags, setFlags] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Redirect if no app is selected
  useEffect(() => {
    if (!selectedApp) {
      router.push("/dashboard");
    }
  }, [selectedApp, router]);

  // Load flags and cohorts
  useEffect(() => {
    const loadData = async () => {
      if (!selectedApp) return;

      try {
        setLoadingData(true);
        const [flagsData, cohortsData] = await Promise.all([
          fetchFlags(selectedApp.id),
          fetchCohorts(selectedApp.id),
        ]);
        setFlags(flagsData);
        setCohorts(cohortsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [selectedApp]);

  // Generate even distribution of test groups
  const generateTestGroups = (count: number): TestGroup[] => {
    const percentage = Math.floor(100 / count);
    const remainder = 100 - percentage * count;

    const groups: TestGroup[] = [];
    for (let i = 0; i < count; i++) {
      const groupName =
        i === 0 ? "Control" : count === 2 ? "Treatment" : `Treatment ${i}`;
      const groupPercentage = i === 0 ? percentage + remainder : percentage; // Give remainder to control
      groups.push({ name: groupName, percentage: groupPercentage });
    }
    return groups;
  };

  const handleNumGroupsChange = (newCount: number) => {
    setNumGroups(newCount);
    const newGroups = generateTestGroups(newCount);
    setTestGroups(newGroups);
  };

  const handleGroupNameChange = (index: number, newName: string) => {
    const newGroups = [...testGroups];
    newGroups[index].name = newName;
    setTestGroups(newGroups);
  };

  const addGroup = () => {
    const newGroupCount = testGroups.length + 1;
    setNumGroups(newGroupCount);
    const updatedGroups = generateTestGroups(newGroupCount);
    // Preserve existing names where possible
    const finalGroups = updatedGroups.map((group, index) => ({
      ...group,
      name: index < testGroups.length ? testGroups[index].name : group.name,
    }));
    setTestGroups(finalGroups);
  };

  const removeGroup = () => {
    if (testGroups.length <= 2) return; // Keep at least 2 groups
    const newGroupCount = testGroups.length - 1;
    setNumGroups(newGroupCount);
    const updatedGroups = generateTestGroups(newGroupCount);
    // Preserve existing names where possible
    const finalGroups = updatedGroups.map((group, index) => ({
      ...group,
      name: index < testGroups.length ? testGroups[index].name : group.name,
    }));
    setTestGroups(finalGroups);
  };

  const handleSave = async () => {
    if (!selectedApp) {
      setError("No application selected");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Generate a key from the name (similar to flag normalization)
      const normalizeKey = (str: string): string => {
        return str
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
      };

      const key = normalizeKey(name);

      // Create the data structure expected by /api/tests
      const testData = {
        key,
        name,
        description,
        conditions: conditions,
        variantCount: testGroups.length,
        trafficSplit: testGroups.map((group) => group.percentage),
        variantNames: testGroups.map((group) => group.name),
        appId: selectedApp.id,
      };

      const response = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create test");
      }

      markChangesDetected();
      router.push("/dashboard/tests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setSaving(false);
    }
  };

  const isValid = name && selectedApp;

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
        title="Create A/B Test"
        subtitle="Set up a new A/B test with traffic splitting and variant configuration"
        backHref="/dashboard/tests"
        backLabel="Back to Tests"
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
                    label="Test Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Homepage Layout Test"
                    helperText="Human-readable name for this A/B test"
                    fullWidth
                    required
                  />

                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this test is measuring"
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Test Groups */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 2,
                  }}
                >
                  <Typography variant="h6">Test Groups</Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      startIcon={<Add />}
                      onClick={addGroup}
                      size="small"
                      variant="outlined"
                      disabled={testGroups.length >= 5}
                    >
                      Add Group
                    </Button>
                    <Button
                      startIcon={<Delete />}
                      onClick={removeGroup}
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={testGroups.length <= 2}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Traffic will be automatically split evenly between all groups.
                  You can customize group names.
                </Typography>

                <Stack spacing={2}>
                  {testGroups.map((group, index) => (
                    <Box
                      key={index}
                      sx={{ display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <TextField
                        label={`Group ${index + 1}`}
                        value={group.name}
                        onChange={(e) =>
                          handleGroupNameChange(index, e.target.value)
                        }
                        size="small"
                        sx={{ minWidth: 200 }}
                      />
                      <Chip
                        label={`${group.percentage}%`}
                        color={index === 0 ? "primary" : "secondary"}
                        variant="outlined"
                      />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* Entry Conditions */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <ConditionsContainer
                  conditions={conditions}
                  onChange={setConditions}
                  appId={selectedApp?.id || ""}
                  title="Entry Conditions"
                  description="Define which users are eligible for this test"
                  emptyMessage="No conditions defined. All users are eligible for this test."
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
                    Test Preview
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Summary of your A/B test configuration
                  </Typography>

                  {name ? (
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Test Name
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {name}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Test Groups
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          {testGroups.map((group, index) => (
                            <Chip
                              key={group.name}
                              label={`${group.name} ${group.percentage}%`}
                              size="small"
                              color={index === 0 ? "primary" : "secondary"}
                            />
                          ))}
                        </Stack>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Status
                        </Typography>
                        <Typography variant="body2">
                          Ready to add flags after creation
                        </Typography>
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
                    </Stack>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Science
                        sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Enter test details to see preview
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
                  {saving ? "Creating..." : "Create Test"}
                </Button>
                <Button
                  variant="outlined"
                  component={Link}
                  href="/dashboard/tests"
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
