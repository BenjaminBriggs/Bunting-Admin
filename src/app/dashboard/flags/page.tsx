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
  MenuItem
} from '@mui/material';
import { 
  Add, 
  Search, 
  FilterList, 
  Flag, 
  MoreVert, 
  Archive, 
  Edit 
} from '@mui/icons-material';
import Link from 'next/link';

// Mock data for now
const mockFlags = [
  {
    id: '1',
    key: 'store/use_new_paywall_design',
    displayName: 'Store / Use New Paywall Design',
    type: 'bool' as const,
    defaultValue: false,
    description: 'Enable the new paywall UI design',
    archived: false,
    updatedAt: '2025-09-11T15:30:00Z'
  },
  {
    id: '2', 
    key: 'onboarding/show_welcome_banner',
    displayName: 'Onboarding / Show Welcome Banner',
    type: 'bool' as const,
    defaultValue: true,
    description: 'Display welcome banner for new users',
    archived: false,
    updatedAt: '2025-09-11T14:20:00Z'
  },
  {
    id: '3',
    key: 'checkout/retry_limit',
    displayName: 'Checkout / Retry Limit',
    type: 'int' as const,
    defaultValue: 3,
    description: 'Maximum number of payment retry attempts',
    archived: true,
    updatedAt: '2025-09-10T10:15:00Z'
  }
];

export default function FlagsPage() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Feature Flags
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
        >
          New Flag
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              placeholder="Search flags..."
              variant="outlined"
              size="small"
              sx={{ flexGrow: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="outlined" startIcon={<FilterList />}>
              Filter
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Flags List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {mockFlags.map((flag) => (
          <Card 
            key={flag.id} 
            sx={{ 
              opacity: flag.archived ? 0.6 : 1,
              border: flag.archived ? '1px dashed' : '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexGrow: 1 }}>
                  <Flag sx={{ color: 'primary.main', mt: 0.5 }} />
                  
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 500 }}>
                        {flag.displayName}
                      </Typography>
                      {flag.archived && (
                        <Chip 
                          icon={<Archive />}
                          label="Archived"
                          size="small"
                          variant="outlined"
                          color="default"
                        />
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: 'monospace',
                          bgcolor: 'grey.100',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1
                        }}
                      >
                        {flag.key}
                      </Typography>
                      <Chip 
                        label={flag.type}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                      <Typography variant="body2" color="text.secondary">
                        Default: <code>{JSON.stringify(flag.defaultValue)}</code>
                      </Typography>
                    </Box>
                    
                    {flag.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {flag.description}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton 
                    size="small"
                    component={Link}
                    href={`/dashboard/flags/${flag.id}/edit`}
                  >
                    <Edit />
                  </IconButton>
                  
                  <IconButton size="small">
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}

        {mockFlags.length === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <Flag sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No feature flags
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Get started by creating your first feature flag
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<Add />}
                component={Link}
                href="/dashboard/flags/new"
              >
                Create Flag
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}