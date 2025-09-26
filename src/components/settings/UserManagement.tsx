'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  IconButton,
  Avatar,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material'
import {
  PersonAdd,
  Delete,
  AdminPanelSettings,
  Code,
  Email,
  Domain,
  CheckCircle,
  Schedule
} from '@mui/icons-material'
import { useSession } from 'next-auth/react'

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: 'ADMIN' | 'DEVELOPER'
  createdAt: string
  lastActiveAt: string
}

interface AccessListEntry {
  id: string
  type: 'EMAIL' | 'DOMAIN'
  value: string
  role: 'ADMIN' | 'DEVELOPER'
  createdAt: string
  createdBy?: {
    id: string
    email: string
    name: string | null
  }
}

interface UnifiedUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: 'ADMIN' | 'DEVELOPER'
  status: 'ACTIVE' | 'INVITED'
  type?: 'EMAIL' | 'DOMAIN'
  createdAt: string
  lastActiveAt?: string
  invitedBy?: string
}

export default function UserManagement() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [accessList, setAccessList] = useState<AccessListEntry[]>([])
  const [unifiedUsers, setUnifiedUsers] = useState<UnifiedUser[]>([])
  const [newEntry, setNewEntry] = useState({ value: '', role: 'DEVELOPER' as const })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Load data
  useEffect(() => {
    loadUsers()
    loadAccessList()
  }, [])

  // Create unified list whenever users or accessList changes
  useEffect(() => {
    const unified: UnifiedUser[] = []

    // Add active users
    users.forEach(user => {
      unified.push({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: 'ACTIVE',
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt
      })
    })

    // Add invited users (access list entries that don't have corresponding active users)
    accessList.forEach(entry => {
      // Check if this access entry corresponds to an active user
      const isActiveUser = users.some(user => {
        if (entry.type === 'EMAIL') {
          return user.email.toLowerCase() === entry.value.toLowerCase()
        } else {
          // For domain entries, check if user's email domain matches
          const userDomain = '@' + user.email.split('@')[1]
          return userDomain.toLowerCase() === entry.value.toLowerCase()
        }
      })

      // Only add to unified list if not already active
      if (!isActiveUser) {
        unified.push({
          id: entry.id,
          email: entry.value,
          name: null,
          image: null,
          role: entry.role,
          status: 'INVITED',
          type: entry.type,
          createdAt: entry.createdAt,
          invitedBy: entry.createdBy?.name || entry.createdBy?.email || 'System'
        })
      }
    })

    // Sort by created date, newest first
    unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setUnifiedUsers(unified)
  }, [users, accessList])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const loadAccessList = async () => {
    try {
      const response = await fetch('/api/access-list')
      if (response.ok) {
        const data = await response.json()
        setAccessList(data)
      }
    } catch (err) {
      console.error('Failed to load access list:', err)
    }
  }

  const addAccessEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const type = newEntry.value.startsWith('@') ? 'DOMAIN' : 'EMAIL'

      const response = await fetch('/api/access-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          value: newEntry.value,
          role: newEntry.role
        })
      })

      if (response.ok) {
        setNewEntry({ value: '', role: 'DEVELOPER' })
        loadAccessList()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add entry')
      }
    } catch (err) {
      setError('Failed to add entry')
    } finally {
      setIsLoading(false)
    }
  }

  const removeAccessEntry = async (id: string) => {
    try {
      const response = await fetch(`/api/access-list?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        loadAccessList()
      }
    } catch (err) {
      console.error('Failed to remove entry:', err)
    }
  }

  const updateUserRole = async (userId: string, role: 'ADMIN' | 'DEVELOPER') => {
    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role })
      })

      if (response.ok) {
        loadUsers()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update user role')
      }
    } catch (err) {
      setError('Failed to update user role')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getRoleIcon = (role: string) => {
    return role === 'ADMIN' ? <AdminPanelSettings /> : <Code />
  }

  const getRoleColor = (role: string) => {
    return role === 'ADMIN' ? 'primary' : 'default'
  }

  return (
    <Box sx={{ space: 3 }}>
      {/* Add New Access Entry */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add User or Domain Access
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Grant access to specific email addresses or entire domains
          </Typography>

          <form onSubmit={addAccessEntry}>
            <Stack direction="row" spacing={2} alignItems="start">
              <TextField
                label="Email or Domain"
                placeholder="user@example.com or @company.com"
                value={newEntry.value}
                onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
                required
                fullWidth
                helperText="Enter an email address or domain starting with @"
              />

              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={newEntry.role}
                  label="Role"
                  onChange={(e) => setNewEntry({ ...newEntry, role: e.target.value as any })}
                >
                  <MenuItem value="DEVELOPER">Developer</MenuItem>
                  <MenuItem value="ADMIN">Admin</MenuItem>
                </Select>
              </FormControl>

              <Button
                type="submit"
                variant="contained"
                disabled={isLoading}
                startIcon={<PersonAdd />}
                sx={{ minWidth: 100, height: '40px' }}
              >
                Add
              </Button>
            </Stack>
          </form>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Unified Users List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Users ({unifiedUsers.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Active users and pending invitations
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Added/Joined</TableCell>
                  <TableCell>Last Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unifiedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {user.status === 'ACTIVE' ? (
                          <Avatar src={user.image || undefined} sx={{ width: 32, height: 32 }}>
                            {user.name?.[0] || user.email[0].toUpperCase()}
                          </Avatar>
                        ) : (
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.300' }}>
                            {user.type === 'DOMAIN' ? <Domain /> : user.email[0].toUpperCase()}
                          </Avatar>
                        )}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {user.name || user.email}
                          </Typography>
                          {user.name && user.status === 'ACTIVE' && (
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          )}
                          {user.type === 'DOMAIN' && (
                            <Typography variant="caption" color="text.secondary">
                              Domain invitation
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={user.status === 'ACTIVE' ? <CheckCircle /> : <Schedule />}
                        label={user.status === 'ACTIVE' ? 'Active' : 'Invited'}
                        color={user.status === 'ACTIVE' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getRoleIcon(user.role)}
                        label={user.role}
                        color={getRoleColor(user.role) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(user.createdAt)}
                      </Typography>
                      {user.status === 'INVITED' && user.invitedBy && (
                        <Typography variant="caption" color="text.secondary">
                          by {user.invitedBy}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.status === 'ACTIVE' && user.lastActiveAt ? (
                        <Typography variant="body2">
                          {formatDate(user.lastActiveAt)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} alignItems="center">
                        {user.status === 'ACTIVE' ? (
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value as 'ADMIN' | 'DEVELOPER')}
                              disabled={user.id === session?.user?.id}
                            >
                              <MenuItem value="DEVELOPER">Developer</MenuItem>
                              <MenuItem value="ADMIN">Admin</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                            Will be {user.role.toLowerCase()} when they sign in
                          </Typography>
                        )}

                        <IconButton
                          onClick={() => user.status === 'ACTIVE' ?
                            updateUserRole(user.id, user.role) : // This would need a different API for removing users
                            removeAccessEntry(user.id)
                          }
                          size="small"
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {unifiedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No users found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}