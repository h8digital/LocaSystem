// build: 2026-05-26 01:37:21 UTC
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'


export const runtime = 'nodejs'
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('locasystem_user')
  return NextResponse.json({ ok: true })
}