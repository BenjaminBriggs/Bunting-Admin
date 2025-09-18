// Helper functions for testing and managing access control

import { db } from './db'

export async function addUserToAccessList(
  email: string,
  role: 'ADMIN' | 'DEVELOPER' = 'DEVELOPER',
  createdById?: string
) {
  return await db.accessList.create({
    data: {
      type: 'EMAIL',
      value: email.toLowerCase(),
      role,
      createdById
    }
  })
}

export async function addDomainToAccessList(
  domain: string,
  role: 'ADMIN' | 'DEVELOPER' = 'DEVELOPER',
  createdById?: string
) {
  // Ensure domain starts with @
  const domainValue = domain.startsWith('@') ? domain : `@${domain}`

  return await db.accessList.create({
    data: {
      type: 'DOMAIN',
      value: domainValue.toLowerCase(),
      role,
      createdById
    }
  })
}

export async function removeFromAccessList(email: string) {
  return await db.accessList.deleteMany({
    where: {
      OR: [
        { type: 'EMAIL', value: email.toLowerCase() },
        { type: 'DOMAIN', value: email.toLowerCase() }
      ]
    }
  })
}

export async function listAccessEntries() {
  return await db.accessList.findMany({
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function listUsers() {
  return await db.user.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

// For testing - clear all access entries (dangerous!)
export async function clearAccessList() {
  return await db.accessList.deleteMany({})
}

// For testing - clear all users except first user
export async function clearUsers() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' }
  })

  if (users.length > 1) {
    // Keep the first user, delete the rest
    const [firstUser, ...otherUsers] = users
    return await db.user.deleteMany({
      where: {
        id: { in: otherUsers.map(u => u.id) }
      }
    })
  }

  return { count: 0 }
}