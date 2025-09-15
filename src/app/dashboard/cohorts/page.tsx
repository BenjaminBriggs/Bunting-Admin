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
  IconButton,
  Alert,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import {
  Add,
  Search,
  Group,
  Edit,
  People,
} from "@mui/icons-material";
import Link from "next/link";
import { fetchCohorts, type Cohort } from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

export default function CohortsPage() {
  const { selectedApp } = useApp();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadCohorts = async () => {
      if (!selectedApp) return;

      try {
        setLoading(true);
        const cohortsData = await fetchCohorts(selectedApp.id);
        setCohorts(cohortsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cohorts");
      } finally {
        setLoading(false);
      }
    };

    loadCohorts();
  }, [selectedApp]);

  const filteredCohorts = cohorts.filter(
    (cohort) =>
      cohort.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cohort.key.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading && cohorts.length === 0) {
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
            Cohorts
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
            Create reusable rule groups for targeting specific user segments
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          href="/dashboard/cohorts/new"
          disabled={!selectedApp}
        >
          New Cohort
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search cohorts..."
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

      {/* Cohorts List */}
      {filteredCohorts.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Group sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {searchTerm
                ? "No cohorts match your search"
                : "No cohorts created"}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm
                ? "Try adjusting your search terms"
                : "Create your first cohort to define reusable targeting rules"}
            </Typography>
            {!searchTerm && selectedApp && (
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                href="/dashboard/cohorts/new"
              >
                Create Cohort
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredCohorts.map((cohort) => (
            <Card key={cohort.id}>
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 2,
                      flexGrow: 1,
                    }}
                  >
                    <Group sx={{ color: "primary.main", mt: 0.5 }} />

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="h6"
                          component="h3"
                          sx={{ fontWeight: 500 }}
                        >
                          {cohort.name}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          mb: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            bgcolor: "grey.100",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          {cohort.key}
                        </Typography>
                        <Chip
                          label="Rule Group"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>

                      {/* Conditions Display */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Targeting Rules
                        </Typography>
                        {cohort.conditions && Array.isArray(cohort.conditions) && cohort.conditions.length > 0 ? (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {cohort.conditions.map((condition: any, index: number) => (
                              <Chip
                                key={index}
                                label={`${condition.field} ${condition.operator} ${condition.value}`}
                                size="small"
                                variant="outlined"
                                color="default"
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                            No conditions defined
                          </Typography>
                        )}
                      </Box>

                      {cohort.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          {cohort.description}
                        </Typography>
                      )}


                      <Typography variant="caption" color="text.secondary">
                        Updated {formatTimestamp(cohort.updatedAt)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <IconButton
                      size="small"
                      component={Link}
                      href={`/dashboard/cohorts/${cohort.id}/edit`}
                    >
                      <Edit />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
