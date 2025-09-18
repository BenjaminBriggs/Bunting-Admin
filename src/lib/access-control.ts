import { db } from './db'

export async function checkUserAccess(email: string): Promise<boolean> {
  if (!email) return false

  // Check direct email match
  const emailAccess = await db.accessList.findFirst({
    where: {
      type: 'EMAIL',
      value: email.toLowerCase()
    }
  })

  if (emailAccess) return true

  // Check domain match
  const domain = email.split('@')[1]
  if (!domain) return false

  const domainAccess = await db.accessList.findFirst({
    where: {
      type: 'DOMAIN',
      value: `@${domain}`
    }
  })

  return !!domainAccess
}

export async function getUserRoleFromAccessList(email: string): Promise<'ADMIN' | 'DEVELOPER'> {
  if (!email) return 'DEVELOPER'

  // Check email first (more specific)
  const emailAccess = await db.accessList.findFirst({
    where: {
      type: 'EMAIL',
      value: email.toLowerCase()
    }
  })

  if (emailAccess) return emailAccess.role as 'ADMIN' | 'DEVELOPER'

  // Check domain
  const domain = email.split('@')[1]
  if (domain) {
    const domainAccess = await db.accessList.findFirst({
      where: {
        type: 'DOMAIN',
        value: `@${domain}`
      }
    })

    if (domainAccess) return domainAccess.role as 'ADMIN' | 'DEVELOPER'
  }

  return 'DEVELOPER'
}

export async function isFirstUser(): Promise<boolean> {
  const userCount = await db.user.count()
  return userCount === 0
}

export async function createOrUpdateUser(userData: {
  id?: string
  email: string
  name?: string | null
  image?: string | null
}): Promise<{ id: string; role: 'ADMIN' | 'DEVELOPER' }> {
  const { email, name, image } = userData

  // Check if this is the first user
  const firstUser = await isFirstUser()

  // Determine role
  let role: 'ADMIN' | 'DEVELOPER'
  if (firstUser) {
    // First user is always admin
    role = 'ADMIN'
  } else {
    // Get role from access list
    role = await getUserRoleFromAccessList(email)
  }

  // Create or update user
  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name,
      image,
      role,
      lastActiveAt: new Date(),
    },
    create: {
      email: email.toLowerCase(),
      name,
      image,
      role,
      lastActiveAt: new Date(),
    },
  })

  return {
    id: user.id,
    role: user.role as 'ADMIN' | 'DEVELOPER'
  }
}

export async function updateUserActivity(userId: string): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    })
  } catch (error) {
    console.error('Failed to update user activity:', error)
    // Don't throw - this is not critical
  }
}