// build: 2026-05-29 17:55:15
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Nivel = 'error' | 'warn' | 'info' | 'debug'

interface LogOpts {
  nivel?:      Nivel
  detalhe?:    string
  contexto?:   Record<string, unknown>
  usuario_id?: number | null
}

/**
 * Salva um log no banco (tabela system_logs).
 * Nunca lança exceção — falha silenciosa para não mascarar o erro original.
 *
 * Uso:
 *   await syslog('api/cotacoes/rapida', 'Erro ao criar cotação', { nivel:'error', detalhe: e.message, contexto: { body } })
 */
export async function syslog(
  origem: string,
  mensagem: string,
  opts: LogOpts = {}
): Promise<void> {
  try {
    await sb.from('system_logs').insert({
      nivel:      opts.nivel      ?? 'error',
      origem,
      mensagem,
      detalhe:    opts.detalhe    ?? null,
      contexto:   opts.contexto   ?? null,
      usuario_id: opts.usuario_id ?? null,
    })
  } catch {
    // Falha silenciosa — log não pode derrubar a requisição original
    console.error('[syslog] Falha ao salvar log:', mensagem)
  }
}

/**
 * Atalhos tipados
 */
export const log = {
  error: (origem: string, mensagem: string, opts?: Omit<LogOpts, 'nivel'>) =>
    syslog(origem, mensagem, { ...opts, nivel: 'error' }),
  warn: (origem: string, mensagem: string, opts?: Omit<LogOpts, 'nivel'>) =>
    syslog(origem, mensagem, { ...opts, nivel: 'warn' }),
  info: (origem: string, mensagem: string, opts?: Omit<LogOpts, 'nivel'>) =>
    syslog(origem, mensagem, { ...opts, nivel: 'info' }),
}
