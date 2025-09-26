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
  Alert,
  Chip,
  IconButton,
  CircularProgress,
  Autocomplete,
  Slider,
  Paper,
} from "@mui/material";
import { Save, Archive } from "@mui/icons-material";
import Link from "next/link";
import {
  fetchTestRollout,
  updateTestRollout,
  archiveTestRollout,
  fetchFlags,
} from "@/lib/api";
import { useChanges } from "@/lib/changes-context";
import { Condition, TestVariant } from "@/types";
import { ConditionsContainer } from "@/components/features/conditions";
import PageHeader from "@/components/ui/page-header";

interface Variant {
  name: string;
  percentage: number;
}

export default function EditTestPage() {
  const params = useParams();
  const router = useRouter();
  const { markChangesDetected } = useChanges();
  const testId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<any>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetFlags, setTargetFlags] = useState<string[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [archived, setArchived] = useState(false);

  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // First fetch the test data to get the appId
        const testData = await fetchTestRollout(testId);

        // Then fetch flags using the appId from test data
        const flagsData = await fetchFlags(testData.appId);

        setTest(testData);
        setFlags(flagsData);
        setName(testData.name);
        setDescription(testData.description || "");
        setTargetFlags(testData.flagIds || []);
        setArchived(testData.archived);

        // Convert variants object to array
        if (testData.variants && typeof testData.variants === "object") {
          const variantArray = Object.entries(testData.variants).map(
            ([name, data]: [string, any]) => ({
              name,
              percentage: data.percentage || 0,
            }),
          );
          setVariants(variantArray);
        }

        setConditions(testData.conditions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load test");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [testId]);

  const updateVariantName = (index: number, name: string) => {
    const newVariants = [...variants];
    newVariants[index].name = name;
    setVariants(newVariants);
  };

  const getTotalPercentage = () => {
    return variants.reduce((sum, variant) => sum + variant.percentage, 0);
  };

  const handleSave = async () => {
    if (!test) return;

    try {
      setSaving(true);
      setError(null);

      await updateTestRollout(testId, {
        name,
        description,
        variants: variants.reduce(
          (acc, variant) => {
            acc[variant.name] = {
              percentage: variant.percentage,
              values: {
                development: "",
                staging: "",
                production: "",
              },
            };
            return acc;
          },
          {} as Record<string, TestVariant>,
        ),
        conditions: conditions,
        flagIds: targetFlags,
        archived,
      });

      markChangesDetected();
      router.push("/dashboard/tests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update test");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (type: "cancel" | "complete") => {
    if (!test) return;

    try {
      await archiveTestRollout(testId, type);
      markChangesDetected();
      router.push("/dashboard/tests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive test");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ mr: 2 }} />
        <Typography>Loading test...</Typography>
      </Box>
    );
  }

  if (error && !test) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: "auto" }}>
          {error}
        </Alert>
        <Button component={Link} href="/dashboard/tests">
          Back to Tests
        </Button>
      </Box>
    );
  }

  if (!test) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Test Not Found
        </Typography>
        <Button component={Link} href="/dashboard/tests">
          Back to Tests
        </Button>
      </Box>
    );
  }

  const isValid = name;
  const hasChanges = test
    ? name !== test.name ||
      description !== (test.description || "") ||
      JSON.stringify(targetFlags.sort()) !==
        JSON.stringify((test.flagIds || []).sort()) ||
      JSON.stringify(variants) !==
        JSON.stringify(
          Object.entries(test.variants || {}).map(
            ([name, data]: [string, any]) => ({
              name,
              percentage: data.percentage || 0,
            }),
          ),
        )
    : false;

  return (
    <Box>
      <PageHeader
        title="Edit A/B Test"
        subtitle="Modify the configuration and settings for this test"
        backHref="/dashboard/tests"
        backLabel="Back to Tests"
      />

      {archived && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This test is archived and no longer active.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Configuration */}
        <Grid size={{ xs: 12, md: 8 }}>
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
                    placeholder="e.g., Homepage Layout Test"
                    helperText="Test name cannot be changed after creation"
                    fullWidth
                    disabled
                    InputProps={{
                      readOnly: true,
                    }}
                  />

                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this test is measuring"
                    multiline
                    rows={3}
                    fullWidth
                    disabled={archived}
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Test Groups */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Test Groups
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  You can customize group names, but traffic allocation is fixed
                  from test creation.
                </Typography>

                <Stack spacing={2}>
                  {variants.map((variant, index) => (
                    <Box
                      key={index}
                      sx={{ display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <TextField
                        label={`Group ${index + 1}`}
                        value={variant.name}
                        onChange={(e) =>
                          updateVariantName(index, e.target.value)
                        }
                        size="small"
                        sx={{ minWidth: 200 }}
                        disabled={archived}
                      />
                      <Chip
                        label={`${variant.percentage}%`}
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
                  appId={test?.appId || ""}
                  disabled={archived}
                  title="Entry Conditions"
                  description="Define which users are eligible for this test"
                  emptyMessage="No conditions defined. All users are eligible for this test."
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Preview & Actions */}
        <Grid size={{ xs: 6, md: 8 }}>
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
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}
                      >
                        {variants.map((variant, index) => (
                          <Chip
                            key={variant.name}
                            label={`${variant.name} ${variant.percentage}%`}
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
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={archived ? "Archived" : "Active"}
                          color={archived ? "default" : "success"}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Target Flags
                      </Typography>
                      <Typography variant="body2">
                        {targetFlags.length} flag
                        {targetFlags.length === 1 ? "" : "s"} affected
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
                </CardContent>
              </Card>

              {/* Actions */}
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                  onClick={handleSave}
                  disabled={!isValid || !hasChanges || saving || archived}
                  fullWidth
                  size="large"
                >
                  {saving
                    ? "Saving..."
                    : !hasChanges
                      ? "No Changes to Save"
                      : "Save Changes"}
                </Button>

                {!archived && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={() => handleArchive("cancel")}
                      color="error"
                      fullWidth
                      startIcon={<Archive />}
                    >
                      Cancel Test (0%)
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => handleArchive("complete")}
                      color="success"
                      fullWidth
                      startIcon={<Archive />}
                    >
                      Complete Test (100%)
                    </Button>
                  </>
                )}

                <Button
                  variant="outlined"
                  component={Link}
                  href="/dashboard/tests"
                  fullWidth
                >
                  Back to Tests
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
