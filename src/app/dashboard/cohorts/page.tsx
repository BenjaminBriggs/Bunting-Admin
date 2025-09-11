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
  LinearProgress
} from '@mui/material';
import { 
  Add, 
  Search, 
  FilterList, 
  BarChart, 
  MoreVert, 
  Edit,
  People
} from '@mui/icons-material';
import Link from 'next/link';

// Mock data for cohorts
const mockCohorts = [
  {
    id: '1',
    name: 'Beta Users',
    identifier: 'beta_users',
    description: 'Users enrolled in beta testing program',
    percentage: 10,
    userCount: 1250,
    salt: 'abc123def456',
    updatedAt: '2025-09-11T15:30:00Z'
  },
  {
    id: '2',
    name: 'Premium Subscribers',
    identifier: 'premium_subscribers',
    description: 'Users with active premium subscriptions',
    percentage: 25,
    userCount: 3200,
    salt: 'xyz789uvw012',
    updatedAt: '2025-09-11T14:20:00Z'
  },
  {
    id: '3',
    name: 'Early Adopters',
    identifier: 'early_adopters',
    description: 'Users who signed up in the first month',
    percentage: 5,
    userCount: 680,
    salt: 'mno345pqr678',
    updatedAt: '2025-09-10T10:15:00Z'
  }
];

export default function CohortsPage() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Cohorts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage user groups for percentage-based feature rollouts
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Add />}
          component={Link}
          href="/dashboard/cohorts/new"
        >
          New Cohort
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              placeholder="Search cohorts..."
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

      {/* Cohorts List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {mockCohorts.map((cohort) => (
          <Card key={cohort.id}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexGrow: 1 }}>
                  <BarChart sx={{ color: 'primary.main', mt: 0.5 }} />
                  
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 500 }}>
                        {cohort.name}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
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
                        {cohort.identifier}
                      </Typography>
                      <Chip 
                        label={`${cohort.percentage}%`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <People sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {cohort.userCount.toLocaleString()} users
                        </Typography>
                      </Box>
                    </Box>

                    {/* Percentage Visualization */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Rollout Percentage
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {cohort.percentage}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={cohort.percentage} 
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                    
                    {cohort.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {cohort.description}
                      </Typography>
                    )}

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Salt: 
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontFamily: 'monospace',
                          ml: 1,
                          bgcolor: 'grey.50',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5
                        }}
                      >
                        {cohort.salt}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton 
                    size="small"
                    component={Link}
                    href={`/dashboard/cohorts/${cohort.id}/edit`}
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

        {mockCohorts.length === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <BarChart sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No cohorts defined
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Create your first cohort to enable percentage-based rollouts
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<Add />}
                component={Link}
                href="/dashboard/cohorts/new"
              >
                Create Cohort
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}