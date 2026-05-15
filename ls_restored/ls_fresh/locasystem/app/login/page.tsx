'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function LoginPage() {
  const [email,setEmail]=useState(''); const [senha,setSenha]=useState('')
  const [loading,setLoading]=useState(false); const [erro,setErro]=useState('')
  const router=useRouter()
  async function login(e:React.FormEvent) {
    e.preventDefault(); setLoading(true); setErro('')
    const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha})})
    const data=await res.json()
    if(data.ok) router.push('/dashboard')
    else { setErro(data.error??'E-mail ou senha incorretos'); setLoading(false) }
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'linear-gradient(135deg,#1E2A38 0%,#2C3E50 100%)'}}>
      {/* Topbar */}
      <div style={{background:'rgba(0,0,0,0.2)',height:42,display:'flex',alignItems:'center',padding:'0 20px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <span style={{color:'rgba(255,255,255,0.8)',fontSize:14,fontWeight:700,fontFamily:"'Roboto',sans-serif"}}>⚙️ LocaSystem</span>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{width:'100%',maxWidth:360}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{width:56,height:56,background:'#17A2B8',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 12px',boxShadow:'0 4px 14px rgba(23,162,184,0.4)'}}>⚙️</div>
            <h1 style={{color:'#fff',fontSize:20,fontWeight:700,marginBottom:4,fontFamily:"'Roboto',sans-serif"}}>LocaSystem</h1>
            <p style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>Sistema de Gestão de Locações</p>
          </div>
          <div style={{background:'#fff',borderRadius:6,boxShadow:'0 8px 24px rgba(0,0,0,0.3)',padding:'24px 24px 20px',border:'1px solid rgba(255,255,255,0.1)'}}>
            <h2 style={{fontSize:14,fontWeight:700,color:'#212529',marginBottom:18}}>Acesso ao Sistema</h2>
            {erro&&<div className="ds-alert-error" style={{marginBottom:14}}>{erro}</div>}
            <form onSubmit={login} style={{display:'flex',flexDirection:'column',gap:13}}>
              <div>
                <label className="ds-label">E-mail</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="ds-input" placeholder="seu@email.com" required autoFocus style={{height:32}}/>
              </div>
              <div>
                <label className="ds-label">Senha</label>
                <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="ds-input" placeholder="••••••••" required style={{height:32}}/>
              </div>
              <button type="submit" disabled={loading} className="ds-btn ds-btn-primary" style={{width:'100%',height:34,fontSize:14,fontWeight:700,marginTop:4}}>
                {loading?<span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:"currentColor",animation:"dot-pulse 1.2s ease-in-out infinite",verticalAlign:"middle",marginRight:4,opacity:.7}}/>Entrando...</span>:'Entrar'}
              </button>
            </form>
          </div>
          <p style={{textAlign:'center',marginTop:14,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>&copy; {new Date().getFullYear()} LocaSystem · Kanoff Soluções</p>
        </div>
      </div>
    </div>
  )
}
