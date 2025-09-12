import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Grid,
  CardActions,
} from "@mui/material";
import { Add, Flag, BarChart, Description } from "@mui/icons-material";
import Link from "next/link";

export default function DashboardPage() {
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
            Manage your feature flags and rollout configurations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          href="/dashboard/flags/new"
        >
          New Flag
        </Button>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Flag sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Active Flags</Typography>
              </Box>
              <Typography variant="h3" component="div">
                0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No flags created yet
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <BarChart sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Cohorts</Typography>
              </Box>
              <Typography variant="h3" component="div">
                0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No cohorts defined
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Description sx={{ mr: 2, color: "primary.main" }} />
                <Typography variant="h6">Last Publish</Typography>
              </Box>
              <Typography variant="h3" component="div">
                Never
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No configurations published
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Get started by creating your first feature flag or cohort
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card
                variant="outlined"
                sx={{ height: "100%", cursor: "pointer" }}
              >
                <CardContent sx={{ textAlign: "center", p: 3 }}>
                  <Flag sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Create Feature Flag
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Define a new feature flag with rules and targeting
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                  <Button
                    variant="outlined"
                    component={Link}
                    href="/dashboard/flags/new"
                  >
                    Get Started
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card
                variant="outlined"
                sx={{ height: "100%", cursor: "pointer" }}
              >
                <CardContent sx={{ textAlign: "center", p: 3 }}>
                  <BarChart
                    sx={{ fontSize: 48, color: "primary.main", mb: 2 }}
                  />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Create Cohort
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Define user groups for percentage rollouts
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                  <Button
                    variant="outlined"
                    component={Link}
                    href="/dashboard/cohorts/new"
                  >
                    Get Started
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
