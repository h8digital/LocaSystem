// build: 2026-06-08 — Middleware de autenticação para rotas de API
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export interface UserSession {
  id: number
  nome: string
  email: string
  perfil: string
  comissao: number
}

// Verificar sessão — retorna o usuário ou null
export async function getSessionUser(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get('locasystem_user')?.value
    if (!raw) return null
    const user = JSON.parse(raw)
    if (!user?.id || !user?.perfil) return null
    return user as UserSession
  } catch {
    return null
  }
}

// Exigir sessão — retorna Response de erro se não autenticado
export async function requireAuth(): Promise<{ user: UserSession } | { error: NextResponse }> {
  const user = await getSessionUser()
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'Não autorizado. Faça login para continuar.' },
        { status: 401 }
      )
    }
  }
  return { user }
}

// Exigir perfil admin
export async function requireAdmin(): Promise<{ user: UserSession } | { error: NextResponse }> {
  const result = await requireAuth()
  if ('error' in result) return result
  if (result.user.perfil !== 'admin') {
    return {
      error: NextResponse.json(
        { ok: false, error: 'Acesso restrito a administradores.' },
        { status: 403 }
      )
    }
  }
  return result
}
