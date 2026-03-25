import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { docx_base64, tags } = await req.json()
    if (!docx_base64) return NextResponse.json({ ok: false, error: 'Base64 do DOCX não informado' })

    const PizZip = (await import('pizzip')).default
    const Docxtemplater = (await import('docxtemplater')).default

    const buffer = Buffer.from(docx_base64, 'base64')
    const zip = new PizZip(buffer)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

    doc.render(tags)

    const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    const b64 = out.toString('base64')

    return NextResponse.json({ ok: true, docx_base64: b64 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
