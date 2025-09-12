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
} from "@mui/material";
import {
  Add,
  Search,
  FilterList,
  Flag,
  MoreVert,
  Archive,
  Edit,
} from "@mui/icons-material";
import Link from "next/link";
import { fetchFlags, type Flag as FlagType } from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

export default function FlagsPage() {
  const { selectedApp } = useApp();
  const [flags, setFlags] = useState<FlagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);

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

  const filteredFlags = flags.filter((flag) => {
    const matchesSearch =
      flag.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchived = showArchived || !flag.archived;
    return matchesSearch && matchesArchived;
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

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
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
          sx={{ flexGrow: 1 }}
          size="small"
        />

        <Button
          variant={showArchived ? "contained" : "outlined"}
          startIcon={<Archive />}
          onClick={() => setShowArchived(!showArchived)}
          size="small"
        >
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
      </Box>

      {/* Flags List */}
      {filteredFlags.length === 0 ? (
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredFlags.map((flag) => (
            <Card key={flag.id} variant="outlined">
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" component="h3">
                        {flag.displayName}
                      </Typography>
                      {flag.archived && (
                        <Chip label="Archived" size="small" color="default" />
                      )}
                    </Box>

                    {flag.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {flag.description}
                      </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary">
                      Updated {formatTimestamp(flag.updatedAt)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                      {JSON.stringify(flag.defaultValue)}
                    </Typography>

                    <IconButton
                      component={Link}
                      href={`/dashboard/flags/${flag.id}/edit`}
                      size="small"
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
