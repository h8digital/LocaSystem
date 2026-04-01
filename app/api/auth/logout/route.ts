import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'


export const runtime = 'nodejs'
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('locasystem_user')
  return NextResponse.json({ ok: true })
}