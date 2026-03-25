import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { data: doc } = await sb
    .from('doc_gerados')
    .select('*, doc_templates(nome, tipo, css_customizado)')
    .eq('token', token)
    .eq('expirado', 0)
    .single()

  if (!doc) {
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><title>Documento não encontrado</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;}
.box{text-align:center;background:#fff;padding:48px 40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);}
h1{font-size:24px;color:#1a1a1a;margin-bottom:8px;}p{color:#666;margin:0;}</style>
</head>
<body><div class="box"><h1>Documento não encontrado</h1>
<p>O link pode ter expirado ou ser inválido.</p></div></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // Incrementa visualizações
  await sb
    .from('doc_gerados')
    .update({ visualizacoes: (doc.visualizacoes ?? 0) + 1 })
    .eq('token', token)

  const templateCss = (doc.doc_templates as any)?.css_customizado ?? ''
  const titulo      = doc.titulo ?? 'Documento'
  const appUrl      = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const docUrl      = appUrl ? `${appUrl}/doc/${token}` : ''
  const wppMsg      = encodeURIComponent(`Olá! Segue o link do seu documento:\n\n${docUrl}`)

  const docCss = `
*{box-sizing:border-box;}
body{font-family:'Times New Roman',serif;font-size:12pt;color:#1a1a1a;margin:0;padding:20px;background:#f5f5f5;}
.npbar{position:fixed;top:0;left:0;right:0;background:#1A1A2E;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:100;font-family:sans-serif;font-size:13px;gap:10px;}
.npbar .acts{display:flex;gap:10px;align-items:center;flex-shrink:0;}
.btn-p{background:#17A2B8;color:white;border:none;padding:7px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;}
.btn-w{background:#25D366;color:white;border:none;padding:7px 16px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}
.dwrap{margin-top:60px;}
.dpage{max-width:820px;margin:0 auto;background:white;padding:40px 50px;box-shadow:0 2px 20px rgba(0,0,0,.08);border-radius:4px;min-height:400px;}
.doc-contrato{font-family:'Times New Roman',serif;font-size:12pt;color:#1a1a1a;}
.doc-header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px;}
.doc-empresa{font-size:18pt;font-weight:bold;margin:0 0 4px;}
.doc-empresa-info{font-size:10pt;color:#555;margin:2px 0;}
.doc-titulo{font-size:14pt;font-weight:bold;text-transform:uppercase;margin:12px 0 4px;}
.doc-numero{font-size:11pt;color:#555;}
.doc-section{margin-bottom:20px;}
.doc-section h3{font-size:11pt;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:10px;}
.doc-section p,.doc-section li{font-size:11pt;line-height:1.6;margin-bottom:6px;text-align:justify;}
.doc-section ol{padding-left:20px;}
.doc-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11pt;}
.doc-table th{background:#f5f5f5;border:1px solid #ccc;padding:8px 12px;text-align:left;font-weight:bold;}
.doc-table td{border:1px solid #ccc;padding:6px 12px;}
.doc-table-simples{width:50%;margin-left:auto;font-size:11pt;}
.doc-table-simples td{padding:4px 8px;}
.doc-table-simples .total-row td{border-top:2px solid #333;font-size:12pt;}
.doc-assinaturas{margin-top:40px;}
.doc-local-data{text-align:center;margin-bottom:30px;font-size:11pt;}
.doc-ass-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:20px;}
.doc-ass-box{text-align:center;}
.doc-ass-linha{border-bottom:1px solid #333;margin-bottom:8px;height:50px;}
.doc-ass-box p{margin:2px 0;font-size:11pt;}
.doc-ass-sub{font-size:10pt;color:#555;}
.doc-footer{margin-top:30px;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:9pt;color:#888;}
@media print{.npbar{display:none!important;}body{background:white;padding:0;}.dwrap{margin-top:0;}.dpage{box-shadow:none;padding:20px;}}
${templateCss}`

  const wppBtn = docUrl
    ? `<a href="https://wa.me/?text=${wppMsg}" target="_blank" class="btn-w">&#128242; Enviar via WhatsApp</a>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${titulo}</title>
<style>${docCss}</style>
</head>
<body>
<div class="npbar">
  <span>&#128196; ${titulo}</span>
  <div class="acts">
    ${wppBtn}
    <button class="btn-p" onclick="window.print()">&#128424; Imprimir / PDF</button>
  </div>
</div>
<div class="dwrap">
  <div class="dpage">
    ${doc.conteudo_final}
  </div>
</div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
