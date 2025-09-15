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
  Slider,
  IconButton,
} from "@mui/material";
import {
  Add,
  Search,
  Rocket,
  PlayArrow,
  Pause,
  CheckCircle,
  Cancel,
  Edit,
} from "@mui/icons-material";
import Link from "next/link";
import {
  fetchRollouts,
  updateRolloutPercentage,
  archiveTestRollout,
  type TestRollout,
} from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

export default function RolloutsPage() {
  const { selectedApp } = useApp();
  const [rollouts, setRollouts] = useState<TestRollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingRollouts, setUpdatingRollouts] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const loadRollouts = async () => {
      if (!selectedApp) return;

      try {
        setLoading(true);
        const rolloutsData = await fetchRollouts(selectedApp.id);
        setRollouts(rolloutsData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load rollouts",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRollouts();
  }, [selectedApp]);

  const filteredRollouts = rollouts.filter(
    (rollout) =>
      rollout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rollout.key.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handlePercentageChange = async (
    rolloutId: string,
    newPercentage: number,
  ) => {
    setUpdatingRollouts((prev) => new Set(prev).add(rolloutId));

    try {
      const updated = await updateRolloutPercentage(rolloutId, newPercentage);
      setRollouts((prev) =>
        prev.map((r) => (r.id === rolloutId ? updated : r)),
      );
    } catch (err) {
      console.error("Failed to update rollout percentage:", err);
      // Could add error toast here
    } finally {
      setUpdatingRollouts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(rolloutId);
        return newSet;
      });
    }
  };

  const handleArchive = async (
    rolloutId: string,
    type: "cancel" | "complete",
  ) => {
    try {
      const updated = await archiveTestRollout(rolloutId, type);
      setRollouts((prev) =>
        prev.map((r) => (r.id === rolloutId ? updated : r)),
      );
    } catch (err) {
      console.error("Failed to archive rollout:", err);
    }
  };

  const getRolloutStatus = (rollout: TestRollout) => {
    if (rollout.archived) return "Archived";
    if (rollout.flagIds.length === 0) return "Not Started";
    if (rollout.percentage === 0) return "Paused";
    if (rollout.percentage === 100) return "Complete";
    return "Active";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "success";
      case "Complete":
        return "primary";
      case "Paused":
        return "warning";
      case "Not Started":
        return "default";
      case "Archived":
        return "default";
      default:
        return "default";
    }
  };

  if (loading && rollouts.length === 0) {
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
            Rollouts
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
            Gradually release features to a percentage of your users
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          href="/dashboard/rollouts/new"
          disabled={!selectedApp}
        >
          Create Rollout
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search rollouts..."
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

      {/* Rollouts List */}
      {filteredRollouts.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Rocket sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {searchTerm ? "No rollouts match your search" : "No rollouts yet"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm
                ? "Try adjusting your search terms"
                : "Create your first rollout to start gradual feature releases"}
            </Typography>
            {!searchTerm && selectedApp && (
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                href="/dashboard/rollouts/new"
              >
                Create Rollout
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredRollouts.map((rollout) => (
            <Grid item xs={12} key={rollout.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        mr: 2,
                        bgcolor: "primary.main",
                        fontSize: "1.2rem",
                      }}
                    >
                      <Rocket />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 2 }}
                      >
                        <Typography variant="h6" component="h4">
                          {rollout.name}
                        </Typography>
                        <Chip
                          label={getRolloutStatus(rollout)}
                          size="small"
                          color={getStatusColor(getRolloutStatus(rollout))}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {rollout.key} · {rollout.flagIds.length} flags affected
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {!rollout.archived && (
                        <>
                          <IconButton
                            size="small"
                            onClick={() => handleArchive(rollout.id, "cancel")}
                            color="error"
                            title="Cancel (0%)"
                          >
                            <Cancel />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleArchive(rollout.id, "complete")
                            }
                            color="success"
                            title="Complete (100%)"
                          >
                            <CheckCircle />
                          </IconButton>
                        </>
                      )}
                      <IconButton
                        size="small"
                        component={Link}
                        href={`/dashboard/rollouts/${rollout.id}/edit`}
                      >
                        <Edit />
                      </IconButton>
                    </Box>
                  </Box>

                  {rollout.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 3 }}
                    >
                      {rollout.description}
                    </Typography>
                  )}

                  {/* Percentage Slider */}
                  <Box sx={{ px: 2, mb: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <Typography variant="subtitle2">
                        Rollout Percentage
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {rollout.percentage}%
                      </Typography>
                    </Box>

                    <Slider
                      value={rollout.percentage || 0}
                      onChange={(_, value) => {
                        // Optimistic update for smooth UX
                        setRollouts((prev) =>
                          prev.map((r) =>
                            r.id === rollout.id
                              ? { ...r, percentage: value as number }
                              : r,
                          ),
                        );
                      }}
                      onChangeCommitted={(_, value) => {
                        handlePercentageChange(rollout.id, value as number);
                      }}
                      disabled={
                        rollout.archived || updatingRollouts.has(rollout.id)
                      }
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
                          rollout.percentage === 0
                            ? "warning.main"
                            : rollout.percentage === 100
                              ? "success.main"
                              : "primary.main",
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Updated {formatTimestamp(rollout.updatedAt)}
                    </Typography>
                    {updatingRollouts.has(rollout.id) && (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Updating...
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
