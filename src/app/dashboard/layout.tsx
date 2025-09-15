"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Drawer,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Divider,
  Badge,
} from "@mui/material";
import {
  Flag,
  Settings,
  BarChart,
  KeyboardArrowDown,
  Add,
  Apps,
  History,
  Science,
  Rocket,
} from "@mui/icons-material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangesProvider, useChanges } from "@/lib/changes-context";
import { AppProvider, useApp } from "@/lib/app-context";

const drawerWidth = 256;

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasChanges, getChangeCount } = useChanges();
  const { apps, selectedApp, setSelectedApp } = useApp();

  const [appMenuAnchor, setAppMenuAnchor] = useState<null | HTMLElement>(null);

  const menuItems = [
    {
      path: "/dashboard/flags",
      label: "Feature Flags",
      icon: <Flag />,
    },
    {
      path: "/dashboard/tests",
      label: "Tests",
      icon: <Science />,
    },
    {
      path: "/dashboard/rollouts",
      label: "Rollouts",
      icon: <Rocket />,
    },
    {
      path: "/dashboard/cohorts",
      label: "Cohorts",
      icon: <BarChart />,
    },
    {
      path: "/dashboard/releases",
      label: "Releases",
      icon: <History />,
      badge: true, // This will show the changes badge
    },
  ];

  const settingsItem = {
    path: "/dashboard/settings",
    label: "Settings",
    icon: <Settings />,
  };

  const isSelected = (path: string) => {
    return pathname?.startsWith(path) || false;
  };

  const handleAppMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAppMenuAnchor(event.currentTarget);
  };

  const handleAppMenuClose = () => {
    setAppMenuAnchor(null);
  };

  const handleAppSelect = (app: any) => {
    setSelectedApp(app);
    handleAppMenuClose();
  };

  const handleAddApplication = () => {
    handleAppMenuClose();
    // Always use the setup flow for new applications
    router.push("/setup");
  };

  return (
    <Box sx={{ display: "flex" }}>
      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: 1,
            borderColor: "divider",
          },
        }}
        variant="permanent"
        anchor="left"
      >
        {/* Logo at Top */}
        <Box
          sx={{
            p: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <img
              src="/images/Logotype.png"
              alt="Bunting"
              style={{
                height: "32px",
                width: "auto",
                objectFit: "contain",
                cursor: "pointer",
              }}
            />
          </Link>
        </Box>

        {/* App Selector */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <ListItemButton
            onClick={handleAppMenuClick}
            sx={{
              borderRadius: 1,
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <Typography variant="h6" component="h1">
              <ListItemText
                primary={selectedApp ? selectedApp.name : "Select Application"}
              />
            </Typography>
            <KeyboardArrowDown />
          </ListItemButton>
        </Box>
        {/* Main Menu */}
        <List sx={{ flexGrow: 1 }}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.path}>
              {/* Add divider before releases (index 2) */}
              {index === 4 && <Divider sx={{ my: 1 }} />}
              <ListItem disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.path}
                  selected={isSelected(item.path)}
                >
                  <ListItemIcon>
                    {item.badge && hasChanges ? (
                      <Badge badgeContent={getChangeCount()} color="primary">
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
        {/* Settings at Bottom */}
        <List>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              href={settingsItem.path}
              selected={isSelected(settingsItem.path)}
            >
              <ListItemIcon>{settingsItem.icon}</ListItemIcon>
              <ListItemText primary={settingsItem.label} />
            </ListItemButton>
          </ListItem>
        </List>
        {/* App Menu Dropdown */}
        <Menu
          anchorEl={appMenuAnchor}
          open={Boolean(appMenuAnchor)}
          onClose={handleAppMenuClose}
          PaperProps={{
            sx: { minWidth: 220 },
          }}
        >
          {apps.map((app) => (
            <MenuItem
              key={app.id}
              onClick={() => handleAppSelect(app)}
              selected={selectedApp?.id === app.id}
            >
              <ListItemText
                primary={app.name}
                secondary={`${app._count?.flags || 0} flags, ${app._count?.cohorts || 0} cohorts`}
              />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={handleAddApplication}>
            <ListItemIcon>
              <Add />
            </ListItemIcon>
            <ListItemText primary="Add Application" />
          </MenuItem>
        </Menu>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          p: 3,
          minHeight: "100vh",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <ChangesProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </ChangesProvider>
    </AppProvider>
  );
}
