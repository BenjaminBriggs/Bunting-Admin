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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Stack,
  Grid,
  Switch,
  FormControlLabel,
  Collapse,
  IconButton,
  Paper,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
} from "@mui/material";
import {
  Save,
  Archive,
  Delete,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { normalizeKey, validateKey } from "@/lib/utils";
import { TargetingRule } from "@/types/rules";
import { RulesContainer } from "@/components";
import {
  fetchFlag,
  updateFlag,
  deleteFlag,
  type Flag as FlagType,
} from "@/lib/api";
import { useChanges } from "@/lib/changes-context";
import { PageHeader } from "@/components";
import FlagValueInput, {
  getDefaultValueForType,
  processValueForType,
  validateValue,
} from "@/components/features/flags/flag-value-input";

const flagTypes = [
  { value: "bool", label: "Boolean" },
  { value: "string", label: "String" },
  { value: "int", label: "Integer" },
  { value: "double", label: "Double" },
  { value: "date", label: "Date" },
  { value: "json", label: "JSON" },
];

export default function EditFlagPage() {
  const params = useParams();
  const router = useRouter();
  const { markChangesDetected } = useChanges();
  const flagId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [flag, setFlag] = useState<FlagType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [key, setKey] = useState("");
  const [originalKey, setOriginalKey] = useState("");
  const [normalizedKey, setNormalizedKey] = useState("");
  const [type, setType] = useState("bool");
  const [defaultValues, setDefaultValues] = useState({
    development: false,
    staging: false,
    production: false,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [description, setDescription] = useState("");
  const [archived, setArchived] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rules, setRules] = useState<TargetingRule[]>([]);

  useEffect(() => {
    const loadFlag = async () => {
      try {
        setLoading(true);
        const flagData = await fetchFlag(flagId);
        setFlag(flagData);
        setDisplayName(flagData.displayName);
        setKey(flagData.key);
        setOriginalKey(flagData.key);
        setNormalizedKey(flagData.key);
        setType(flagData.type.toLowerCase());
        // Handle both old single defaultValue and new defaultValues
        if (flagData.defaultValues) {
          setDefaultValues({
            development:
              flagData.defaultValues.development ||
              flagData.defaultValue ||
              getDefaultValueForType(flagData.type.toLowerCase() as any),
            staging:
              flagData.defaultValues.staging ||
              flagData.defaultValue ||
              getDefaultValueForType(flagData.type.toLowerCase() as any),
            production:
              flagData.defaultValues.production ||
              flagData.defaultValue ||
              getDefaultValueForType(flagData.type.toLowerCase() as any),
          });
        } else {
          // Legacy support - use single defaultValue for all environments
          setDefaultValues({
            development: flagData.defaultValue,
            staging: flagData.defaultValue,
            production: flagData.defaultValue,
          });
        }
        setDescription(flagData.description || "");
        setArchived(flagData.archived);
        setRules(flagData.rules || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load flag");
      } finally {
        setLoading(false);
      }
    };

    loadFlag();
  }, [flagId]);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    const normalized = normalizeKey(value);
    setKey(value);
    setNormalizedKey(normalized);

    const validation = validateKey(normalized);
    setValidationError(
      validation.valid ? null : validation.error || "Invalid key",
    );
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const newDefaultValue = getDefaultValueForType(newType as any);
    setDefaultValues({
      development: newDefaultValue,
      staging: newDefaultValue,
      production: newDefaultValue,
    });

    // Update existing rule values to match new type
    const updatedRules = rules.map((rule) => ({
      ...rule,
      value: newDefaultValue,
    }));
    setRules(updatedRules);
  };

  const handleEnvironmentValueChange = (environment: string, value: any) => {
    setDefaultValues((prev) => ({ ...prev, [environment]: value }));
  };

  const getCurrentEnvironment = () => {
    const environments = ["development", "staging", "production"];
    return environments[activeTab];
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case "development":
        return "info";
      case "staging":
        return "warning";
      case "production":
        return "success";
      default:
        return "default";
    }
  };

  const handleSave = async () => {
    if (validationError || !flag) return;

    setSaving(true);
    setError(null);

    try {
      // Validate all environment values
      const hasValidationErrors = ["development", "staging", "production"].some(
        (env) => {
          const value = defaultValues[env as keyof typeof defaultValues];
          return !validateValue(value, type as any).isValid;
        },
      );
      if (hasValidationErrors) {
        setError("Please fix validation errors before saving");
        return;
      }

      const processDefaultValues = () => {
        const processed: any = {};
        ["development", "staging", "production"].forEach((env) => {
          const value = defaultValues[env as keyof typeof defaultValues];
          processed[env] = processValueForType(value, type as any);
        });
        return processed;
      };

      await updateFlag(flagId, {
        key: normalizedKey,
        displayName,
        type,
        defaultValues: processDefaultValues(),
        variants: flag.variants || {},
        description,
        archived,
        rules,
      });

      // Trigger change detection
      markChangesDetected();
      router.push("/dashboard/flags");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update flag");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setArchived(!archived);
    // Auto-save when archiving
    setTimeout(handleSave, 100);
  };

  const handleDelete = async () => {
    if (!flag) return;

    if (
      confirm(
        "Are you sure you want to delete this flag? This action cannot be undone.",
      )
    ) {
      try {
        await deleteFlag(flagId);

        // Trigger change detection
        markChangesDetected();
        router.push("/dashboard/flags");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete flag");
      }
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 8,
        }}
      >
        <CircularProgress sx={{ mr: 2 }} />
        <Typography>Loading flag...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: "auto" }}>
          {error}
        </Alert>
        <Button component={Link} href="/dashboard/flags">
          Back to Flags
        </Button>
      </Box>
    );
  }

  if (!flag) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Flag Not Found
        </Typography>
        <Button component={Link} href="/dashboard/flags">
          Back to Flags
        </Button>
      </Box>
    );
  }

  const isValid =
    !validationError &&
    displayName &&
    ["development", "staging", "production"].every((env) => {
      const value = defaultValues[env as keyof typeof defaultValues];
      return validateValue(value, type as any).isValid;
    });
  const hasChanges = (() => {
    if (!flag) return false;

    // Check basic fields
    if (
      displayName !== flag.displayName ||
      normalizedKey !== originalKey ||
      type !== flag.type ||
      description !== (flag.description || "") ||
      archived !== flag.archived ||
      JSON.stringify(rules) !== JSON.stringify(flag.rules || [])
    ) {
      return true;
    }

    // Check default values - compare with both old and new format
    if (flag.defaultValues) {
      return (
        JSON.stringify(defaultValues) !==
        JSON.stringify({
          development: flag.defaultValues.development || "",
          staging: flag.defaultValues.staging || "",
          production: flag.defaultValues.production || "",
        })
      );
    } else {
      // Legacy comparison
      const legacyValue = flag.defaultValue || "";
      return !(
        JSON.stringify(defaultValues.development) ===
          JSON.stringify(legacyValue) &&
        JSON.stringify(defaultValues.staging) === JSON.stringify(legacyValue) &&
        JSON.stringify(defaultValues.production) === JSON.stringify(legacyValue)
      );
    }
  })();

  return (
    <Box>
      <PageHeader
        title="Edit Feature Flag"
        subtitle={`Modify the environment-specific configuration for ${flag.displayName}`}
        backHref="/dashboard/flags"
        backLabel="Back to Flags"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<Archive />}
              onClick={handleArchive}
              color={archived ? "primary" : "warning"}
            >
              {archived ? "Unarchive" : "Archive"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Delete />}
              onClick={handleDelete}
              color="error"
            >
              Delete
            </Button>
          </>
        }
      />

      {archived && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This flag is archived and will not be included in published
          configurations.
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
                  {/* Display Name */}
                  <TextField
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    placeholder="e.g., Store / Use New Paywall Design"
                    helperText="Human-readable name that will appear in the dashboard"
                    fullWidth
                    required
                  />

                  {/* Auto-generated Key Display */}
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Auto-generated Key
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                        bgcolor: "grey.100",
                        p: 1.5,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: validationError ? "error.main" : "divider",
                      }}
                    >
                      {normalizedKey}
                    </Box>
                    {validationError && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 0.5, display: "block" }}
                      >
                        {validationError}
                      </Typography>
                    )}

                    {originalKey !== normalizedKey && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, mb: 1 }}
                        >
                          Key will change from <code>{originalKey}</code> to{" "}
                          <code>{normalizedKey}</code>
                        </Typography>
                        <Typography variant="body2">
                          This will require updating your code that references
                          this flag. Make sure to update all places where you
                          use this flag before publishing.
                        </Typography>
                      </Alert>
                    )}
                  </Box>

                  {/* Type Selection */}
                  <FormControl sx={{ maxWidth: 200 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={type}
                      label="Type"
                      onChange={(e) => handleTypeChange(e.target.value)}
                    >
                      {flagTypes.map((flagType) => (
                        <MenuItem key={flagType.value} value={flagType.value}>
                          {flagType.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Divider />

                  {/* Description */}
                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this flag controls and when it should be used"
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
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Conditional Variants (Optional)
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Define targeting rules that override the environment defaults
                  based on user conditions
                </Typography>
                <RulesContainer
                  rules={rules}
                  onChange={setRules}
                  flagType={type as any}
                  defaultValue={(() => {
                    const currentEnv = getCurrentEnvironment();
                    const value =
                      defaultValues[currentEnv as keyof typeof defaultValues];
                    if (type === "bool") return value === "true";
                    if (type === "int") return parseInt(value) || 0;
                    if (type === "double") return parseFloat(value) || 0.0;
                    if (type === "json") {
                      const error =
                        jsonErrors[currentEnv as keyof typeof jsonErrors];
                      return error ? value : JSON.parse(value);
                    }
                    return value;
                  })()}
                  appId={flag?.appId}
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
                  How this environment-first flag will appear in your
                  configuration
                </Typography>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Display Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {displayName}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Key
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
                      {normalizedKey}
                    </Box>
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
                          [normalizedKey]: {
                            type,
                            defaultValues: (() => {
                              const processed: any = {};
                              ["development", "staging", "production"].forEach(
                                (env) => {
                                  const value =
                                    defaultValues[
                                      env as keyof typeof defaultValues
                                    ];
                                  processed[env] = processValueForType(
                                    value,
                                    type as any,
                                  );
                                },
                              );
                              return processed;
                            })(),
                            variants:
                              rules.length > 0
                                ? {
                                    development: rules.map((rule) => ({
                                      conditions: rule.conditions.map(
                                        (condition) => ({
                                          field: condition.type,
                                          operator: condition.operator,
                                          value: condition.values,
                                        }),
                                      ),
                                      value: rule.value,
                                    })),
                                    staging: [],
                                    production: [],
                                  }
                                : {},
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
                    {displayName !== flag.displayName && (
                      <Typography variant="body2">
                        • Display name: <code>{flag.displayName}</code> →{" "}
                        <code>{displayName}</code>
                      </Typography>
                    )}
                    {normalizedKey !== originalKey && (
                      <Typography variant="body2">
                        • Key: <code>{originalKey}</code> →{" "}
                        <code>{normalizedKey}</code>
                      </Typography>
                    )}
                    {type !== flag.type && (
                      <Typography variant="body2">
                        • Type: <code>{flag.type}</code> → <code>{type}</code>
                      </Typography>
                    )}
                    {(() => {
                      // Check if default values changed
                      let defaultValuesChanged = false;
                      if (flag.defaultValues) {
                        defaultValuesChanged =
                          JSON.stringify(defaultValues) !==
                          JSON.stringify({
                            development: flag.defaultValues.development || "",
                            staging: flag.defaultValues.staging || "",
                            production: flag.defaultValues.production || "",
                          });
                      } else {
                        const legacyValue = flag.defaultValue || "";
                        defaultValuesChanged = !(
                          JSON.stringify(defaultValues.development) ===
                            JSON.stringify(legacyValue) &&
                          JSON.stringify(defaultValues.staging) ===
                            JSON.stringify(legacyValue) &&
                          JSON.stringify(defaultValues.production) ===
                            JSON.stringify(legacyValue)
                        );
                      }

                      return defaultValuesChanged ? (
                        <Typography variant="body2">
                          • Environment default values updated
                        </Typography>
                      ) : null;
                    })()}
                    {description !== (flag.description || "") && (
                      <Typography variant="body2">
                        • Description updated
                      </Typography>
                    )}
                    {archived !== flag.archived && (
                      <Typography variant="body2">
                        • Status: {flag.archived ? "Archived" : "Active"} →{" "}
                        {archived ? "Archived" : "Active"}
                      </Typography>
                    )}
                    {JSON.stringify(rules) !==
                      JSON.stringify(flag.rules || []) && (
                      <Typography variant="body2">
                        • Targeting rules updated ({rules.length} rule
                        {rules.length !== 1 ? "s" : ""})
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
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
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
                href="/dashboard/flags"
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
