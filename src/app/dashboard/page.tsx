"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Grid,
  CardActions,
  CircularProgress,
  Alert,
  Avatar,
} from "@mui/material";
import { 
  Add, 
  Flag, 
  BarChart, 
  Apps, 
  TrendingUp,
  Science,
  Rocket
} from "@mui/icons-material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchApps, type App } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatTimestamp } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { setSelectedApp } = useApp();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadApps = async () => {
      try {
        setLoading(true);
        const appsData = await fetchApps();
        setApps(appsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load apps");
      } finally {
        setLoading(false);
      }
    };

    loadApps();
  }, []);

  const handleAppClick = (app: App) => {
    setSelectedApp(app);
    router.push("/dashboard/flags");
  };

  const getTotalStats = () => {
    return apps.reduce(
      (acc, app) => ({
        flags: acc.flags + (app._count?.flags || 0),
        cohorts: acc.cohorts + (app._count?.cohorts || 0),
        testRollouts: acc.testRollouts + (app._count?.test_rollouts || 0),
      }),
      { flags: 0, cohorts: 0, testRollouts: 0 }
    );
  };

  const totalStats = getTotalStats();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
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
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Overview of all your applications, feature flags, A/B tests, and rollouts
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          href="/setup"
        >
          New Application
        </Button>
      </Box>

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Apps sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Applications</Typography>
              </Box>
              <Typography variant="h3" component="div">
                {apps.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total applications
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Flag sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Feature Flags</Typography>
              </Box>
              <Typography variant="h3" component="div">
                {totalStats.flags}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across all apps
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <BarChart sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Cohorts</Typography>
              </Box>
              <Typography variant="h3" component="div">
                {totalStats.cohorts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                User targeting groups
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Science sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Tests & Rollouts</Typography>
              </Box>
              <Typography variant="h3" component="div">
                {totalStats.testRollouts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active experiments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Applications */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
          Applications
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Click on an application to manage its feature flags, tests, rollouts, and cohorts
        </Typography>

        {apps.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: "center", py: 8 }}>
              <Apps sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No applications yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first application to start managing feature flags
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                href="/setup"
              >
                Create Application
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {apps.map((app) => (
              <Grid item xs={12} md={6} lg={4} key={app.id}>
                <Card 
                  sx={{ 
                    height: "100%", 
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: 4,
                    }
                  }}
                  onClick={() => handleAppClick(app)}
                >
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          width: 40, 
                          height: 40, 
                          mr: 2, 
                          bgcolor: "primary.main",
                          fontSize: "1.2rem"
                        }}
                      >
                        {app.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" component="h4">
                          {app.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {app.identifier}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" color="primary.main">
                          {app._count?.flags || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Flags
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" color="primary.main">
                          {app._count?.cohorts || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Cohorts
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" color="primary.main">
                          {app._count?.test_rollouts || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Tests
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      Updated {formatTimestamp(app.updatedAt)}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<Flag />}>
                      Flags
                    </Button>
                    <Button size="small" startIcon={<Science />}>
                      Tests
                    </Button>
                    <Button size="small" startIcon={<Rocket />}>
                      Rollouts
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
