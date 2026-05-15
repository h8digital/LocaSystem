import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

// Converte DOCX para HTML usando pizzip + xmldom (sem depender de mammoth)
async function docxToHtml(buffer: Buffer): Promise<string> {
  const PizZip = (await import('pizzip')).default
  const { DOMParser } = await import('@xmldom/xmldom')

  const zip = new PizZip(buffer)

  // Extrair document.xml
  const docXml = zip.file('word/document.xml')?.asText()
  if (!docXml) throw new Error('Arquivo DOCX inválido ou corrompido.')

  const parser = new DOMParser()
  const doc = parser.parseFromString(docXml, 'text/xml')

  function getText(node: any): string {
    let t = ''
    for (let i = 0; i < node.childNodes.length; i++) {
      const c = node.childNodes[i]
      if (c.localName === 't') t += c.textContent || ''
      else t += getText(c)
    }
    return t
  }

  function isBold(rpr: any): boolean {
    if (!rpr) return false
    for (let i = 0; i < rpr.childNodes.length; i++) {
      if (rpr.childNodes[i].localName === 'b') return true
    }
    return false
  }

  function isItalic(rpr: any): boolean {
    if (!rpr) return false
    for (let i = 0; i < rpr.childNodes.length; i++) {
      if (rpr.childNodes[i].localName === 'i') return true
    }
    return false
  }

  function getStyle(ppr: any): string {
    if (!ppr) return ''
    for (let i = 0; i < ppr.childNodes.length; i++) {
      const n = ppr.childNodes[i]
      if (n.localName === 'pStyle') return n.getAttribute('w:val') || ''
    }
    return ''
  }

  function getAlign(ppr: any): string {
    if (!ppr) return ''
    for (let i = 0; i < ppr.childNodes.length; i++) {
      const n = ppr.childNodes[i]
      if (n.localName === 'jc') return n.getAttribute('w:val') || ''
    }
    return ''
  }

  function parseRun(run: any): string {
    let text = ''
    let rpr: any = null
    for (let i = 0; i < run.childNodes.length; i++) {
      const n = run.childNodes[i]
      if (n.localName === 'rPr') rpr = n
      if (n.localName === 't') text += n.textContent || ''
      if (n.localName === 'br') text += '<br/>'
    }
    if (!text) return ''
    if (isBold(rpr) && isItalic(rpr)) text = `<strong><em>${text}</em></strong>`
    else if (isBold(rpr)) text = `<strong>${text}</strong>`
    else if (isItalic(rpr)) text = `<em>${text}</em>`
    return text
  }

  function parseParagraph(para: any): string {
    let ppr: any = null
    let content = ''
    for (let i = 0; i < para.childNodes.length; i++) {
      const n = para.childNodes[i]
      if (n.localName === 'pPr') ppr = n
      if (n.localName === 'r') content += parseRun(n)
    }

    if (!content.trim()) return '<p>&nbsp;</p>'

    const style = getStyle(ppr)
    const align = getAlign(ppr)
    const alignStyle = align === 'center' ? ' style="text-align:center"' : align === 'right' ? ' style="text-align:right"' : align === 'both' ? ' style="text-align:justify"' : ''

    if (style === 'Heading1' || style === 'heading1' || /^[Hh]eading1$|^[Tt]tulo1$/.test(style)) return `<h1${alignStyle}>${content}</h1>`
    if (style === 'Heading2' || /^[Hh]eading2/.test(style)) return `<h2${alignStyle}>${content}</h2>`
    if (style === 'Heading3' || /^[Hh]eading3/.test(style)) return `<h3${alignStyle}>${content}</h3>`
    return `<p${alignStyle}>${content}</p>`
  }

  function parseTable(table: any): string {
    let html = '<table style="width:100%;border-collapse:collapse;margin:10px 0;">'
    let firstRow = true
    for (let i = 0; i < table.childNodes.length; i++) {
      const row = table.childNodes[i]
      if (row.localName !== 'tr') continue
      html += '<tr>'
      for (let j = 0; j < row.childNodes.length; j++) {
        const cell = row.childNodes[j]
        if (cell.localName !== 'tc' && cell.localName !== 'th') continue
        const tag = firstRow ? 'th' : 'td'
        const style = firstRow
          ? 'border:1px solid #ccc;padding:8px 12px;background:#f5f5f5;font-weight:bold;text-align:left;'
          : 'border:1px solid #ccc;padding:6px 12px;'
        let cellContent = ''
        for (let k = 0; k < cell.childNodes.length; k++) {
          if (cell.childNodes[k].localName === 'p') cellContent += getText(cell.childNodes[k])
        }
        html += `<${tag} style="${style}">${cellContent}</${tag}>`
      }
      html += '</tr>'
      firstRow = false
    }
    html += '</table>'
    return html
  }

  // Processar body
  const body = doc.getElementsByTagName('w:body')[0]
  if (!body) throw new Error('Estrutura do documento não encontrada.')

  let html = ''
  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i]
    if (node.localName === 'p') html += parseParagraph(node)
    if (node.localName === 'tbl') html += parseTable(node)
  }

  return html
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ ok:false, error:'Nenhum arquivo enviado' })
    if (!file.name.endsWith('.docx')) return NextResponse.json({ ok:false, error:'Apenas arquivos .docx são aceitos' })

    const buffer = Buffer.from(await file.arrayBuffer())
    const html = await docxToHtml(buffer)

    return NextResponse.json({ ok:true, html, warnings:[] })
  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message })
  }
}
