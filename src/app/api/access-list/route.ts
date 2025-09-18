import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const createAccessEntrySchema = z.object({
  type: z.enum(['EMAIL', 'DOMAIN']),
  value: z.string().min(1),
  role: z.enum(['ADMIN', 'DEVELOPER'])
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessList = await db.accessList.findMany({
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

    return NextResponse.json(accessList)
  } catch (error) {
    console.error('Failed to fetch access list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, value, role } = createAccessEntrySchema.parse(body)

    // Validate input based on type
    if (type === 'EMAIL') {
      if (!value.includes('@')) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    } else if (type === 'DOMAIN') {
      if (!value.startsWith('@')) {
        return NextResponse.json({ error: 'Domain must start with @' }, { status: 400 })
      }
    }

    // Check for duplicates
    const existing = await db.accessList.findFirst({
      where: {
        type,
        value: value.toLowerCase()
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Entry already exists' }, { status: 400 })
    }

    const accessEntry = await db.accessList.create({
      data: {
        type,
        value: value.toLowerCase(),
        role,
        createdById: session.user.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(accessEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    console.error('Failed to create access entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID parameter required' }, { status: 400 })
    }

    await db.accessList.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete access entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}