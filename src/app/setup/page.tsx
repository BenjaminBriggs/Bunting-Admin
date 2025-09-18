"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Stack,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Container,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createApp, type App } from "@/lib/api";
import { Apps, Storage, Check, Flag } from "@mui/icons-material";

interface SetupData {
  appName: string;
  appIdentifier: string;
  artifactUrl: string;
  storageType: "minio" | "aws" | "r2" | "b2" | "custom";
  storageConfig: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  fetchPolicy: {
    minIntervalHours: number;
    hardTtlDays: number;
  };
}

const steps = [
  "Application Details",
  "Storage Configuration",
  "Review & Create",
];

export default function SetupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<SetupData>({
    appName: "",
    appIdentifier: "",
    artifactUrl: "",
    storageType: process.env.NODE_ENV === "development" ? "minio" : "aws",
    storageConfig: {
      bucket: "",
      region: "us-east-1",
      endpoint: "",
      accessKeyId: "",
      secretAccessKey: "",
    },
    fetchPolicy: {
      minIntervalHours: 6,
      hardTtlDays: 7,
    },
  });

  // Check authentication
  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }
  }, [status, router]);

  // Auto-generate app identifier from name
  const handleNameChange = (name: string) => {
    const identifier = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "");

    setSetupData((prev) => {
      const newArtifactUrl = generateArtifactUrl(
        prev.storageType,
        prev.storageConfig,
        identifier,
      );
      return {
        ...prev,
        appName: name,
        appIdentifier: identifier,
        artifactUrl: newArtifactUrl,
      };
    });
  };

  const generateArtifactUrl = (
    type: "minio" | "aws" | "r2" | "b2" | "custom",
    config: any,
    appIdentifier: string,
  ) => {
    if (!appIdentifier) return "";

    switch (type) {
      case "minio":
        // MinIO endpoint with bucket
        const endpoint = config.endpoint || "http://localhost:9000";
        return `${endpoint}/${config.bucket}/configs/${appIdentifier}/`;

      case "aws":
        // Standard AWS S3 URL format
        return `https://${config.bucket}.s3.${config.region}.amazonaws.com/configs/${appIdentifier}/`;

      case "r2":
        // Cloudflare R2 URL format
        if (config.bucket && config.region) {
          return `https://${config.bucket}.${config.region}.r2.cloudflarestorage.com/configs/${appIdentifier}/`;
        }
        return "";

      case "b2":
        // Backblaze B2 URL format
        if (config.endpoint && config.bucket) {
          return `${config.endpoint}/file/${config.bucket}/configs/${appIdentifier}/`;
        }
        return "";

      case "custom":
        // Custom S3-compatible endpoint
        if (config.endpoint && config.bucket) {
          return `${config.endpoint}/${config.bucket}/configs/${appIdentifier}/`;
        }
        return "";

      default:
        return "";
    }
  };

  const handleStorageTypeChange = (
    type: "minio" | "aws" | "r2" | "b2" | "custom",
  ) => {
    let defaultConfig = {
      bucket: "",
      region: "us-east-1",
      endpoint: "",
      accessKeyId: "",
      secretAccessKey: "",
    };

    switch (type) {
      case "minio":
        defaultConfig = {
          bucket: "bunting-configs",
          region: "us-east-1",
          endpoint: "http://localhost:9000",
          accessKeyId: "admin",
          secretAccessKey: "admin123",
        };
        break;

      case "aws":
        defaultConfig = {
          bucket: "",
          region: "us-east-1",
          endpoint: "",
          accessKeyId: "",
          secretAccessKey: "",
        };
        break;

      case "r2":
        defaultConfig = {
          bucket: "",
          region: "", // R2 uses account ID as region
          endpoint: "",
          accessKeyId: "",
          secretAccessKey: "",
        };
        break;

      case "b2":
        defaultConfig = {
          bucket: "",
          region: "us-west-002", // Default B2 region
          endpoint: "", // Will be set based on bucket
          accessKeyId: "",
          secretAccessKey: "",
        };
        break;

      case "custom":
        defaultConfig = {
          bucket: "",
          region: "us-east-1",
          endpoint: "",
          accessKeyId: "",
          secretAccessKey: "",
        };
        break;
    }

    const newArtifactUrl = generateArtifactUrl(
      type,
      defaultConfig,
      setupData.appIdentifier,
    );

    setSetupData((prev) => ({
      ...prev,
      storageType: type,
      storageConfig: defaultConfig,
      artifactUrl: newArtifactUrl,
    }));
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate app details
      if (!setupData.appName.trim()) {
        setError("Application name is required");
        return;
      }
      if (!setupData.appIdentifier.trim()) {
        setError("Application identifier is required");
        return;
      }
    }

    if (activeStep === 1) {
      // Validate storage config
      if (!setupData.storageConfig.bucket.trim()) {
        setError("Bucket name is required");
        return;
      }
      if (!setupData.storageConfig.region.trim()) {
        setError("Region is required");
        return;
      }
    }

    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);

      const appData = {
        name: setupData.appName,
        identifier: setupData.appIdentifier,
        artifactUrl:
          setupData.artifactUrl ||
          `https://cdn.example.com/configs/${setupData.appIdentifier}/`,
        publicKeys: [
          {
            kid: "default",
            pem: "-----BEGIN PUBLIC KEY-----\n[Your public key here]\n-----END PUBLIC KEY-----",
          },
        ],
        fetchPolicy: {
          min_interval_seconds: setupData.fetchPolicy.minIntervalHours * 3600,
          hard_ttl_days: setupData.fetchPolicy.hardTtlDays,
        },
        storageConfig: {
          bucket: setupData.storageConfig.bucket,
          region: setupData.storageConfig.region,
          endpoint: setupData.storageConfig.endpoint || undefined,
          accessKeyId: setupData.storageConfig.accessKeyId || undefined,
          secretAccessKey: setupData.storageConfig.secretAccessKey || undefined,
        },
      };

      await createApp(appData);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create application",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            <TextField
              label="Application Name"
              value={setupData.appName}
              onChange={(e) => handleNameChange(e.target.value)}
              fullWidth
              required
              helperText="A friendly name for your application"
            />

            <TextField
              label="Application Identifier"
              value={setupData.appIdentifier}
              onChange={(e) =>
                setSetupData((prev) => ({
                  ...prev,
                  appIdentifier: e.target.value,
                }))
              }
              fullWidth
              required
              helperText="Unique identifier used by the SDK (auto-generated from name)"
            />

            <TextField
              label="Artifact URL"
              value={setupData.artifactUrl}
              onChange={(e) =>
                setSetupData((prev) => ({
                  ...prev,
                  artifactUrl: e.target.value,
                }))
              }
              fullWidth
              helperText="Auto-generated from storage config - this is where your SDK will fetch configs"
              InputProps={{
                readOnly: true,
              }}
              sx={{
                "& .MuiInputBase-input": {
                  backgroundColor: "action.hover",
                },
              }}
            />
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Choose Storage Backend</Typography>

            <Stack
              direction="row"
              spacing={2}
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant={
                    setupData.storageType === "minio" ? "contained" : "outlined"
                  }
                  onClick={() => handleStorageTypeChange("minio")}
                  startIcon={<Storage />}
                >
                  MinIO (Local Dev)
                </Button>
              )}
              <Button
                variant={
                  setupData.storageType === "aws" ? "contained" : "outlined"
                }
                onClick={() => handleStorageTypeChange("aws")}
                startIcon={<Storage />}
              >
                AWS S3
              </Button>
              <Button
                variant={
                  setupData.storageType === "r2" ? "contained" : "outlined"
                }
                onClick={() => handleStorageTypeChange("r2")}
                startIcon={<Storage />}
              >
                Cloudflare R2
              </Button>
              <Button
                variant={
                  setupData.storageType === "b2" ? "contained" : "outlined"
                }
                onClick={() => handleStorageTypeChange("b2")}
                startIcon={<Storage />}
              >
                Backblaze B2
              </Button>
              <Button
                variant={
                  setupData.storageType === "custom" ? "contained" : "outlined"
                }
                onClick={() => handleStorageTypeChange("custom")}
                startIcon={<Storage />}
              >
                Custom S3-Compatible
              </Button>
            </Stack>

            {setupData.storageType === "minio" && (
              <Alert severity="info">
                <strong>Local Development Setup</strong>
                <br />
                Using MinIO running on localhost:9000 with default admin
                credentials. Perfect for development and testing.
              </Alert>
            )}

            {setupData.storageType === "r2" && (
              <Alert severity="info">
                <strong>Cloudflare R2 Configuration</strong>
                <br />
                Use your Cloudflare account ID as the region. Get API tokens
                from the Cloudflare dashboard.
              </Alert>
            )}

            {setupData.storageType === "b2" && (
              <Alert severity="info">
                <strong>Backblaze B2 Configuration</strong>
                <br />
                Create an application key in your Backblaze B2 console. Use your
                application key ID and key.
              </Alert>
            )}

            {setupData.storageType === "custom" && (
              <Alert severity="info">
                <strong>Custom S3-Compatible Storage</strong>
                <br />
                For any S3-compatible storage provider. Enter the full endpoint
                URL and credentials.
              </Alert>
            )}

            <TextField
              label="Bucket Name"
              value={setupData.storageConfig.bucket}
              onChange={(e) =>
                setSetupData((prev) => {
                  const newConfig = {
                    ...prev.storageConfig,
                    bucket: e.target.value,
                  };
                  const newArtifactUrl = generateArtifactUrl(
                    prev.storageType,
                    newConfig,
                    prev.appIdentifier,
                  );
                  return {
                    ...prev,
                    storageConfig: newConfig,
                    artifactUrl: newArtifactUrl,
                  };
                })
              }
              fullWidth
              required
            />

            <TextField
              label="Region"
              value={setupData.storageConfig.region}
              onChange={(e) =>
                setSetupData((prev) => {
                  const newConfig = {
                    ...prev.storageConfig,
                    region: e.target.value,
                  };
                  const newArtifactUrl = generateArtifactUrl(
                    prev.storageType,
                    newConfig,
                    prev.appIdentifier,
                  );
                  return {
                    ...prev,
                    storageConfig: newConfig,
                    artifactUrl: newArtifactUrl,
                  };
                })
              }
              fullWidth
              required
            />

            {(setupData.storageType === "minio" ||
              setupData.storageType === "b2" ||
              setupData.storageType === "custom") && (
              <TextField
                label="Endpoint"
                value={setupData.storageConfig.endpoint}
                onChange={(e) =>
                  setSetupData((prev) => {
                    const newConfig = {
                      ...prev.storageConfig,
                      endpoint: e.target.value,
                    };
                    const newArtifactUrl = generateArtifactUrl(
                      prev.storageType,
                      newConfig,
                      prev.appIdentifier,
                    );
                    return {
                      ...prev,
                      storageConfig: newConfig,
                      artifactUrl: newArtifactUrl,
                    };
                  })
                }
                fullWidth
                required={setupData.storageType !== "aws"}
                helperText="Full endpoint URL (e.g., http://localhost:9000)"
              />
            )}

            {setupData.storageType !== "minio" && (
              <>
                <TextField
                  label="Access Key ID (Optional)"
                  value={setupData.storageConfig.accessKeyId}
                  onChange={(e) =>
                    setSetupData((prev) => ({
                      ...prev,
                      storageConfig: {
                        ...prev.storageConfig,
                        accessKeyId: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                  helperText="Leave empty to use environment variables or IAM roles"
                />

                <TextField
                  label="Secret Access Key (Optional)"
                  type="password"
                  value={setupData.storageConfig.secretAccessKey}
                  onChange={(e) =>
                    setSetupData((prev) => ({
                      ...prev,
                      storageConfig: {
                        ...prev.storageConfig,
                        secretAccessKey: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                  helperText="Leave empty to use environment variables or IAM roles"
                />
              </>
            )}
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Review Configuration</Typography>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Application
                </Typography>
                <Typography variant="body1">{setupData.appName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ID: {setupData.appIdentifier}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  Config URL: {setupData.artifactUrl}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Storage
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip
                    label={setupData.storageType.toUpperCase()}
                    size="small"
                    color={
                      setupData.storageType === "minio"
                        ? "secondary"
                        : "primary"
                    }
                  />
                </Stack>
                <Typography variant="body2">
                  Bucket: {setupData.storageConfig.bucket}
                </Typography>
                <Typography variant="body2">
                  Region: {setupData.storageConfig.region}
                </Typography>
                {setupData.storageConfig.endpoint && (
                  <Typography variant="body2">
                    Endpoint: {setupData.storageConfig.endpoint}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Fetch Policy
                </Typography>
                <Typography variant="body2">
                  Minimum interval: {setupData.fetchPolicy.minIntervalHours}{" "}
                  hours
                </Typography>
                <Typography variant="body2">
                  Hard TTL: {setupData.fetchPolicy.hardTtlDays} days
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        );

      default:
        return null;
    }
  };

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (status !== 'authenticated') {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <img
            src="/images/Icon.png"
            alt="Bunting"
            style={{
              height: "200px",
              width: "auto",
              objectFit: "contain",
              cursor: "pointer",
            }}
          />
          <Typography
            variant="h2"
            component="h1"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            Welcome to Bunting
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
            Self-hosted feature flags for Apps
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Let's set up your first application for feature flag management
          </Typography>
        </Box>

        <Card elevation={8}>
          <CardContent sx={{ p: 4 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {renderStepContent(activeStep)}

            <Box
              sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}
            >
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                size="large"
              >
                Back
              </Button>

              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleCreate}
                  disabled={loading}
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <Check />
                  }
                  size="large"
                >
                  {loading ? "Creating Application..." : "Create Application"}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext} size="large">
                  Next
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
