'use client';

import { 
  Box, 
  Drawer, 
  AppBar, 
  Toolbar, 
  List, 
  Typography, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { 
  Flag, 
  Settings, 
  BarChart, 
  Description 
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const drawerWidth = 256;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    {
      path: '/dashboard/flags',
      label: 'Feature Flags',
      icon: <Flag />,
    },
    {
      path: '/dashboard/cohorts',
      label: 'Cohorts',
      icon: <BarChart />,
    },
    {
      path: '/dashboard/publish',
      label: 'Publish',
      icon: <Description />,
    },
    {
      path: '/dashboard/settings',
      label: 'Settings',
      icon: <Settings />,
    },
  ];

  const isSelected = (path: string) => {
    return pathname?.startsWith(path) || false;
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Flag sx={{ color: 'primary.main' }} />
            <Typography variant="h6" component="h1">
              Bunting Admin
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">App:</Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Select Application</InputLabel>
              <Select
                value=""
                label="Select Application"
                disabled
              >
                <MenuItem value="">Select Application</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={isSelected(item.path)}
              >
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        {children}
      </Box>
    </Box>
  );
}