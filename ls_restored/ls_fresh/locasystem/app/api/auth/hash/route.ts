import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const { senha } = await req.json()
  const bcrypt = await import('bcryptjs')
  const hash = await bcrypt.hash(senha, 12)
  return NextResponse.json({ hash })
}
