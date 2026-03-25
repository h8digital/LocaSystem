'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import { Table, TableCell, TableHeader, TableKit } from '@tiptap/extension-table'
import { useEffect, useCallback } from 'react'

interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  onInsertTag?: (insertFn: (tag: string) => void) => void
  minHeight?: string
}

type Level = 1 | 2 | 3

export default function RichEditor({ value, onChange, onInsertTag, minHeight = '400px' }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      TableKit,
    ],
    content: value || '',
    onUpdate: ({ editor }) => { onChange(editor.getHTML()) },
    editorProps: {
      attributes: {
        class: 'focus:outline-none rich-editor-content',
        style: `min-height:${minHeight}; font-family: Times New Roman, serif; font-size: 12pt; padding: 32px 40px; line-height: 1.6; color: #1a1a1a;`,
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value])

  const insertTag = useCallback((tag: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(tag).run()
  }, [editor])

  useEffect(() => {
    if (onInsertTag) onInsertTag(insertTag)
  }, [insertTag, onInsertTag])

  if (!editor) return (
    <div className="border border-gray-200 rounded-xl p-8 text-center text-gray-400 bg-gray-50">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#FF6B35] rounded-full animate-spin mx-auto mb-2" />
      Carregando editor visual...
    </div>
  )

  const tb = (active: boolean, onClick: () => void, title: string, content: React.ReactNode) => (
    <button type="button" title={title} onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${active ? 'bg-[#FF6B35] text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
      {content}
    </button>
  )

  const sep = () => <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" />

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-2 border-b border-gray-100 bg-gray-50/80 sticky top-0 z-10">
        {/* Estilo do texto */}
        <select
          value={
            editor.isActive('heading',{level:1})?'h1':
            editor.isActive('heading',{level:2})?'h2':
            editor.isActive('heading',{level:3})?'h3':'p'
          }
          onMouseDown={e=>e.preventDefault()}
          onChange={e => {
            const v = e.target.value
            if(v==='p') editor.chain().focus().setParagraph().run()
            else editor.chain().focus().setHeading({level:parseInt(v.replace('h','')) as Level}).run()
          }}
          className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-[#FF6B35] mr-1 h-7">
          <option value="p">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>

        {sep()}

        {/* Formatação */}
        {tb(editor.isActive('bold'),()=>editor.chain().focus().toggleBold().run(),'Negrito (Ctrl+B)',<strong>B</strong>)}
        {tb(editor.isActive('italic'),()=>editor.chain().focus().toggleItalic().run(),'Itálico (Ctrl+I)',<em>I</em>)}
        {tb(editor.isActive('underline'),()=>editor.chain().focus().toggleUnderline().run(),'Sublinhado',<u>U</u>)}
        {tb(editor.isActive('strike'),()=>editor.chain().focus().toggleStrike().run(),'Tachado',<s>S</s>)}

        {sep()}

        {/* Alinhamento */}
        {tb(editor.isActive('textAlign', {textAlign:'left'}),  ()=>editor.chain().focus().setTextAlign('left').run(),  'Alinhar esquerda', '⬅')}
        {tb(editor.isActive('textAlign', {textAlign:'center'}), ()=>editor.chain().focus().setTextAlign('center').run(), 'Centralizar', '↔')}
        {tb(editor.isActive('textAlign', {textAlign:'right'}),  ()=>editor.chain().focus().setTextAlign('right').run(),  'Alinhar direita', '➡')}
        {tb(editor.isActive('textAlign', {textAlign:'justify'}),()=>editor.chain().focus().setTextAlign('justify').run(),'Justificar', '⣿')}

        {sep()}

        {/* Listas */}
        {tb(editor.isActive('bulletList'),  ()=>editor.chain().focus().toggleBulletList().run(),  'Lista tópicos', '•≡')}
        {tb(editor.isActive('orderedList'), ()=>editor.chain().focus().toggleOrderedList().run(), 'Lista numerada','1.')}

        {sep()}

        {/* Tabela */}
        <button type="button" title="Inserir tabela 3x3"
          onMouseDown={e=>{e.preventDefault();editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}}
          className="h-7 px-2 flex items-center gap-1 rounded text-xs font-medium hover:bg-gray-100 text-gray-600 border border-gray-200">
          ⊞ Tabela
        </button>

        {editor.isActive('table') && <>
          <button type="button" onMouseDown={e=>{e.preventDefault();editor.chain().focus().addColumnAfter().run()}} className="h-7 px-1.5 rounded text-xs hover:bg-gray-100 text-gray-500 border border-gray-200" title="Adicionar coluna">+Col</button>
          <button type="button" onMouseDown={e=>{e.preventDefault();editor.chain().focus().addRowAfter().run()}} className="h-7 px-1.5 rounded text-xs hover:bg-gray-100 text-gray-500 border border-gray-200" title="Adicionar linha">+Lin</button>
          <button type="button" onMouseDown={e=>{e.preventDefault();editor.chain().focus().deleteTable().run()}} className="h-7 px-1.5 rounded text-xs hover:bg-red-50 text-red-400 border border-red-100" title="Remover tabela">🗑</button>
        </>}

        {sep()}

        {tb(false,()=>editor.chain().focus().setHorizontalRule().run(),'Linha divisória','—')}

        {sep()}
        {tb(false,()=>editor.chain().focus().undo().run(),'Desfazer','↩')}
        {tb(false,()=>editor.chain().focus().redo().run(),'Refazer','↪')}
      </div>

      {/* Área de edição */}
      <div className="overflow-auto" style={{maxHeight:'550px'}}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .rich-editor-content p { margin: 0 0 8px; }
        .rich-editor-content h1 { font-size: 18pt; font-weight: bold; margin: 14px 0 8px; }
        .rich-editor-content h2 { font-size: 14pt; font-weight: bold; margin: 12px 0 6px; }
        .rich-editor-content h3 { font-size: 12pt; font-weight: bold; margin: 10px 0 5px; }
        .rich-editor-content ul,.rich-editor-content ol { padding-left: 24px; margin-bottom: 8px; }
        .rich-editor-content li { margin-bottom: 3px; }
        .rich-editor-content hr { border: none; border-top: 1px solid #ccc; margin: 14px 0; }
        .rich-editor-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        .rich-editor-content th { background: #f5f5f5; border: 1px solid #ccc; padding: 7px 11px; font-weight: bold; }
        .rich-editor-content td { border: 1px solid #ccc; padding: 5px 11px; }
        .rich-editor-content .selectedCell:after { background: rgba(255,107,53,0.1); }
      `}</style>
    </div>
  )
}
