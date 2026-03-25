'use client'
interface Column { key:string; label:string; width?:string; align?:'left'|'center'|'right'; render?:(r:any)=>React.ReactNode }
interface DataTableProps { columns:Column[]; data:any[]; loading?:boolean; emptyMessage?:string; onRowClick?:(r:any)=>void; actions?:(r:any)=>React.ReactNode }
export default function DataTable({ columns, data, loading, emptyMessage='Nenhum registro encontrado.', onRowClick, actions }: DataTableProps) {
  return (
    <div className="ds-card">
      <div style={{overflowX:'auto'}}>
        <table className="ds-table">
          <thead><tr>
            {columns.map(c=><th key={c.key} style={{width:c.width,textAlign:c.align??'left'}}>{c.label}</th>)}
            {actions&&<th style={{textAlign:'right',width:90}}>Ações</th>}
          </tr></thead>
          <tbody>
            {loading?(
              <tr><td colSpan={columns.length+(actions?1:0)} style={{textAlign:'center',padding:'36px 16px'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <div className="ds-spinner" style={{width:20,height:20}}/>
                  <span style={{color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Carregando...</span>
                </div>
              </td></tr>
            ):data.length===0?(
              <tr><td colSpan={columns.length+(actions?1:0)} style={{padding:0}}>
                <div className="ds-empty"><div className="ds-empty-icon">📋</div><div className="ds-empty-title">{emptyMessage}</div></div>
              </td></tr>
            ):data.map((row,i)=>(
              <tr key={row.id??i} data-clickable={onRowClick?'true':undefined}
                onClick={onRowClick?()=>onRowClick(row):undefined}>
                {columns.map(c=><td key={c.key} style={{textAlign:c.align??'left'}}>{c.render?c.render(row):(row[c.key]??<span style={{color:'var(--t-light)'}}>—</span>)}</td>)}
                {actions&&<td style={{textAlign:'right'}} onClick={e=>e.stopPropagation()}>{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
