// build: 2026-05-26 01:22:45 UTC
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'


export const runtime = 'nodejs'
export async function GET() {
  const cookieStore = await cookies()
  const userCookie  = cookieStore.get('locasystem_user')
  if (!userCookie) return NextResponse.json({ user: null }, { status: 401 })
  try {
    const user = JSON.parse(userCookie.value)
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}