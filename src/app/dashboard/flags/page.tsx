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
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Divider,
  Stack,
} from "@mui/material";
import {
  Add,
  Search,
  Flag,
  MoreVert,
  Edit,
  DragIndicator,
  Science,
  Rocket,
} from "@mui/icons-material";
import Link from "next/link";
import { fetchFlags, type Flag as FlagType } from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { FlagRow } from "@/components";

export default function FlagsPage() {
  const { selectedApp } = useApp();
  const [flags, setFlags] = useState<FlagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadFlags = async () => {
      if (!selectedApp) return;

      try {
        setLoading(true);
        const flagsData = await fetchFlags(selectedApp.id);
        setFlags(flagsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load flags");
      } finally {
        setLoading(false);
      }
    };

    loadFlags();
  }, [selectedApp]);

  const activeFlags = flags.filter((flag) => {
    const matchesSearch =
      flag.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && !flag.archived;
  });

  const archivedFlags = flags.filter((flag) => {
    const matchesSearch =
      flag.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && flag.archived;
  });

  const getTypeChipColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "bool":
        return "success";
      case "string":
        return "info";
      case "int":
      case "double":
        return "warning";
      case "json":
        return "secondary";
      case "date":
        return "error";
      default:
        return "default";
    }
  };

  if (loading && flags.length === 0) {
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
            Feature Flags
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
            Manage your feature flags and their targeting rules
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          href="/dashboard/flags/new"
          disabled={!selectedApp}
        >
          Create Flag
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search flags..."
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

      {/* Flags Display */}
      {activeFlags.length === 0 && archivedFlags.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Flag sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {searchTerm ? "No flags match your search" : "No flags yet"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm
                ? "Try adjusting your search terms"
                : "Create your first feature flag to get started"}
            </Typography>
            {!searchTerm && selectedApp && (
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                href="/dashboard/flags/new"
              >
                Create Flag
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Box>
          {/* Active Flags */}
          {activeFlags.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Active Flags ({activeFlags.length})
              </Typography>
              <Stack spacing={1}>
                {activeFlags.map((flag) => (
                  <FlagRow key={flag.id} flag={flag} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Archived Flags */}
          {archivedFlags.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                Archived Flags ({archivedFlags.length})
              </Typography>
              <Stack spacing={1}>
                {archivedFlags.map((flag) => (
                  <FlagRow key={flag.id} flag={flag} archived />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
