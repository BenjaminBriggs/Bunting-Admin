"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  Autocomplete,
  TextField,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Add, Science, Rocket } from "@mui/icons-material";
import { Environment, DBTestRollout } from "@/types";
import { fetchTests, fetchRollouts } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useRouter } from "next/navigation";
import FlagTestAssignmentModal from "./flag-test-assignment-modal";

interface TestRolloutAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  environment: Environment;
  flagId: string;
  flagName: string;
  flagType: string;
  onComplete?: () => void;
}


export default function TestRolloutAssignmentModal({
  open,
  onClose,
  environment,
  flagId,
  flagName,
  flagType,
  onComplete,
}: TestRolloutAssignmentModalProps) {
  const router = useRouter();
  const { selectedApp } = useApp();
  const [availableTests, setAvailableTests] = useState<DBTestRollout[]>([]);
  const [availableRollouts, setAvailableRollouts] = useState<DBTestRollout[]>([]);
  const [selectedTestsRollouts, setSelectedTestsRollouts] = useState<DBTestRollout[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configureValuesModalOpen, setConfigureValuesModalOpen] = useState(false);

  useEffect(() => {
    const loadTestsAndRollouts = async () => {
      if (!open || !selectedApp) return;
      
      setDataLoading(true);
      setError(null);
      
      try {
        const [testsData, rolloutsData] = await Promise.all([
          fetchTests(selectedApp.id),
          fetchRollouts(selectedApp.id)
        ]);
        
        setAvailableTests(testsData);
        setAvailableRollouts(rolloutsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tests and rollouts');
      } finally {
        setDataLoading(false);
      }
    };

    loadTestsAndRollouts();
  }, [open, selectedApp]);

  const handleSave = async () => {
    if (selectedTestsRollouts.length === 0) return;
    
    // Open the configure values modal
    setConfigureValuesModalOpen(true);
  };

  const handleValuesConfigured = () => {
    // This will be called when values are successfully configured
    setConfigureValuesModalOpen(false);
    setSelectedTestsRollouts([]);
    onClose();
    onComplete?.(); // Notify parent to refresh data
  };

  const handleCreateNew = (type: "test" | "rollout") => {
    const path = type === "test" ? "/dashboard/tests/new" : "/dashboard/rollouts/new";
    onClose(); // Close the modal first
    router.push(`${path}?flagId=${flagId}`);
  };

  const allOptions = [...availableTests, ...availableRollouts].filter(
    item => !item.archived
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Assign to Tests & Rollouts - {environment.charAt(0).toUpperCase() + environment.slice(1)}
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            Assign <strong>{flagName}</strong> to existing tests or rollouts in the{" "}
            <strong>{environment}</strong> environment. This flag will be included 
            in the selected test/rollout configurations.
          </Alert>

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {dataLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress sx={{ mr: 2 }} />
              <Typography>Loading tests and rollouts...</Typography>
            </Box>
          )}

          {/* Search and Select */}
          {!dataLoading && !error && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Select Existing Tests & Rollouts
              </Typography>
              <Autocomplete
              multiple
              options={allOptions}
              getOptionLabel={(option) => `${option.name} (${option.type.toLowerCase()})`}
              value={selectedTestsRollouts}
              onChange={(_, newValue) => setSelectedTestsRollouts(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search for tests or rollouts..."
                  helperText="Select active tests and rollouts to include this flag"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    color={option.type === "TEST" ? "primary" : "secondary"}
                    icon={option.type === "TEST" ? <Science /> : <Rocket />}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {option.type === "TEST" ? <Science /> : <Rocket />}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {option.name}
                      </Typography>
                      {option.description && (
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      )}
                    </Box>
                    <Chip 
                      label={option.type.toLowerCase()} 
                      size="small" 
                      color={option.type === "TEST" ? "primary" : "secondary"}
                    />
                  </Box>
                </Box>
              )}
            />
          </Box>
          )}

          <Divider />

          {/* Create New Options */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Or Create New
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Science />}
                onClick={() => handleCreateNew("test")}
                fullWidth
              >
                Create New A/B Test
              </Button>
              <Button
                variant="outlined"
                startIcon={<Rocket />}
                onClick={() => handleCreateNew("rollout")}
                fullWidth
              >
                Create New Rollout
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              These will open in new tabs with this flag pre-selected
            </Typography>
          </Box>

          {/* Summary */}
          {selectedTestsRollouts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Selected ({selectedTestsRollouts.length})
              </Typography>
              <Stack spacing={1}>
                {selectedTestsRollouts.map((item) => (
                  <Box key={item.id} sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {item.type === "TEST" ? <Science color="primary" /> : <Rocket color="secondary" />}
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.name}
                      </Typography>
                      <Chip 
                        label={item.type.toLowerCase()} 
                        size="small" 
                        color={item.type === "TEST" ? "primary" : "secondary"}
                      />
                    </Box>
                    {item.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={selectedTestsRollouts.length === 0}
        >
          Continue to Configure Values
        </Button>
      </DialogActions>
      
      {/* Flag Test Assignment Modal - Second Step */}
      <FlagTestAssignmentModal
        open={configureValuesModalOpen}
        onClose={() => setConfigureValuesModalOpen(false)}
        onSave={handleValuesConfigured}
        environment={environment}
        flagId={flagId}
        flagName={flagName}
        flagType={flagType}
        selectedTests={selectedTestsRollouts.filter(item => item.type === 'TEST')}
        selectedRollouts={selectedTestsRollouts.filter(item => item.type === 'ROLLOUT')}
      />
    </Dialog>
  );
}