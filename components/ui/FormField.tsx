'use client'
interface FormFieldProps {
  label:string; required?:boolean; hint?:string; error?:string
  children:React.ReactNode; className?:string; style?:React.CSSProperties
}
export function FormField({ label, required, hint, error, children, className='', style }: FormFieldProps) {
  return (
    <div className={className} style={{display:'flex',flexDirection:'column',gap:3,...(style||{})}}>
      <label className="ds-label">{label}{required&&<span style={{color:'var(--c-danger)',marginLeft:2}}>*</span>}</label>
      {children}
      {hint&&!error&&<p className="ds-hint">{hint}</p>}
      {error&&<p className="ds-error">{error}</p>}
    </div>
  )
}
export const inputCls    = 'ds-input'
export const selectCls   = 'ds-select'
export const textareaCls = 'ds-textarea'
