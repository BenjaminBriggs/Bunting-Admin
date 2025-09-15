"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  Grid,
  CardActions,
} from "@mui/material";
import {
  Add,
  Search,
  Science,
  TrendingUp,
  Pause,
  PlayArrow,
  Archive,
} from "@mui/icons-material";
import Link from "next/link";
import { fetchTests, type TestRollout } from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

export default function TestsPage() {
  const { selectedApp } = useApp();
  const [tests, setTests] = useState<TestRollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadTests = async () => {
      if (!selectedApp) return;

      try {
        setLoading(true);
        const testsData = await fetchTests(selectedApp.id);
        setTests(testsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tests");
      } finally {
        setLoading(false);
      }
    };

    loadTests();
  }, [selectedApp]);

  const filteredTests = tests.filter(
    (test) =>
      test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.key.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getVariantNames = (test: TestRollout) => {
    if (!test.variants) return [];
    return Object.keys(test.variants);
  };

  const getTestStatus = (test: TestRollout) => {
    if (test.archived) return "Archived";
    if (test.flagIds.length === 0) return "Not Started";
    return "Active";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "success";
      case "Not Started":
        return "warning";
      case "Archived":
        return "default";
      default:
        return "default";
    }
  };

  if (loading && tests.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            A/B Tests
            {selectedApp && (
              <Typography
                component="span"
                variant="h5"
                color="text.secondary"
                sx={{ ml: 2 }}
              >
                · {selectedApp.name}
              </Typography>
            )}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage A/B tests across multiple feature flags
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          href="/dashboard/tests/new"
          disabled={!selectedApp}
        >
          Create Test
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search tests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          fullWidth
          size="small"
        />
      </Box>

      {/* Tests List */}
      {filteredTests.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Science sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {searchTerm ? "No tests match your search" : "No tests yet"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm
                ? "Try adjusting your search terms"
                : "Create your first A/B test to start experimenting"}
            </Typography>
            {!searchTerm && selectedApp && (
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                href="/dashboard/tests/new"
              >
                Create Test
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredTests.map((test) => (
            <Grid item xs={12} md={6} lg={4} key={test.id}>
              <Card
                sx={{
                  height: "100%",
                  transition: "all 0.2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        mr: 2,
                        bgcolor: "primary.main",
                        fontSize: "1.2rem",
                      }}
                    >
                      <Science />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="h4">
                        {test.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {test.key}
                      </Typography>
                    </Box>
                    <Chip
                      label={getTestStatus(test)}
                      size="small"
                      color={getStatusColor(getTestStatus(test))}
                    />
                  </Box>

                  {test.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {test.description}
                    </Typography>
                  )}

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Variants:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {getVariantNames(test).map((variantName) => {
                        const variant = test.variants?.[variantName];
                        return (
                          <Chip
                            key={variantName}
                            label={`${variantName} (${variant?.percentage || 0}%)`}
                            size="small"
                            variant="outlined"
                          />
                        );
                      })}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {test.flagIds.length} flags affected
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Updated {formatTimestamp(test.updatedAt)}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Archive />}
                    component={Link}
                    href={`/dashboard/tests/${test.id}/edit`}
                  >
                    Manage
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
