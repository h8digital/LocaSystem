'use client'
import { useEffect } from 'react'
const widths: Record<string,number> = {sm:440,md:560,lg:740,xl:920}
interface SlidePanelProps {
  open:boolean; onClose:()=>void; title:string; subtitle?:string
  width?:string; children:React.ReactNode; footer?:React.ReactNode
}
export default function SlidePanel({ open, onClose, title, subtitle, width='md', children, footer }: SlidePanelProps) {
  useEffect(()=>{ document.body.style.overflow=open?'hidden':''; return()=>{document.body.style.overflow=''} },[open])
  if(!open) return null
  return (
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',justifyContent:'flex-end'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)',animation:'fadeIn 200ms ease'}}/>
      <div className="ds-panel" style={{position:'relative',display:'flex',flexDirection:'column',width:'100%',maxWidth:widths[width]??560,height:'100%',animation:'slideInRight 220ms ease'}}>
        {/* Header */}
        <div className="slide-header">
          <div>
            <div className="slide-title">{title}</div>
            {subtitle&&<div className="slide-subtitle">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="slide-close"
            onMouseEnter={e=>{(e.currentTarget as any).style.background='var(--c-danger-light)';(e.currentTarget as any).style.color='var(--c-danger)'}}
            onMouseLeave={e=>{(e.currentTarget as any).style.background='transparent';(e.currentTarget as any).style.color='var(--t-muted)'}}>×</button>
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>{children}</div>
        {/* Footer */}
        {footer&&<div className="slide-footer">{footer}</div>}
      </div>
    </div>
  )
}
