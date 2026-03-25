'use client'
interface Tab { key:string; label:string; icon?:string; count?:number }
interface TabsProps { tabs:Tab[]; active:string; onChange:(k:string)=>void; variant?:'line'|'pill' }
export default function Tabs({ tabs, active, onChange, variant='line' }: TabsProps) {
  if(variant==='pill') return (
    <div style={{display:'inline-flex',background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',padding:2,gap:2}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>onChange(t.key)} style={{
          display:'flex',alignItems:'center',gap:5,padding:'4px 12px',
          borderRadius:'var(--r-xs)',fontSize:'var(--fs-md)',fontWeight:active===t.key?600:400,
          border:'none',cursor:'pointer',transition:'all 150ms',fontFamily:'var(--font)',
          background:active===t.key?'var(--bg-card)':'transparent',
          color:active===t.key?'var(--c-primary)':'var(--t-secondary)',
          boxShadow:active===t.key?'var(--shadow-sm)':'none',
        }}>{t.icon} {t.label}</button>
      ))}
    </div>
  )
  return (
    <div className="ds-tabs">
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>onChange(t.key)} className={`ds-tab${active===t.key?' active':''}`}>
          {t.icon} {t.label}
          {t.count!==undefined&&<span style={{fontSize:'var(--fs-xs)',padding:'1px 5px',borderRadius:2,background:active===t.key?'var(--c-primary-light)':'var(--bg-header)',color:active===t.key?'var(--c-primary-text)':'var(--t-muted)'}}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
