'use client'
interface FilterField { type:'text'|'select'; key:string; placeholder?:string; options?:{value:string;label:string}[]; width?:string }
interface FiltersProps { fields:FilterField[]; values:Record<string,string>; onChange:(k:string,v:string)=>void; onClear?:()=>void; extra?:React.ReactNode }
export default function Filters({ fields, values, onChange, onClear, extra }: FiltersProps) {
  const hasFilter = Object.values(values).some(v=>v!=='')
  return (
    <div className="ds-filters">
      {fields.map(f=>(
        <div key={f.key} style={f.width?{width:f.width}:{}}>
          {f.type==='text'?(
            <div className="ds-search">
              <svg className="ds-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={values[f.key]??''} onChange={e=>onChange(f.key,e.target.value)} placeholder={f.placeholder??'Pesquisar...'}/>
            </div>
          ):(
            <select value={values[f.key]??''} onChange={e=>onChange(f.key,e.target.value)} className="ds-select" style={{width:'auto',minWidth:140}}>
              <option value="">{f.placeholder??'Todos'}</option>
              {f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>
      ))}
      {extra}
      {hasFilter&&onClear&&<button onClick={onClear} className="ds-btn ds-btn-ghost ds-btn-sm" style={{color:'var(--t-muted)'}}>✕ Limpar</button>}
    </div>
  )
}
