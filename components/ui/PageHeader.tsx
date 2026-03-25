interface PageHeaderProps { title:string; subtitle?:string; actions?:React.ReactNode }
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="ds-page-header">
      <div>
        <div className="ds-page-title">{title}</div>
        {subtitle&&<div className="ds-page-subtitle">{subtitle}</div>}
      </div>
      {actions&&<div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>{actions}</div>}
    </div>
  )
}
