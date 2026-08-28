import { useState } from 'react'
import { useAuth } from '../utils/auth'
import { useNavigate } from 'react-router-dom'

const ROLES = [
  {value:'', label:'Select Role'},
  {value:'ADMIN', label:'Admin'},
  {value:'STUDENT', label:'Student'},
  {value:'VERIFIER', label:'Verifier'},
  {value:'STAFF_ADVISOR', label:'Staff Advisor'},
  {value:'HOD', label:'HOD'},
  {value:'PRINCIPAL', label:'Principal'},
]

export default function Login(){
  const [u,setU]=useState(''); const [p,setP]=useState(''); const [role,setRole]=useState(''); const [err,setErr]=useState(''); const [loading,setLoading]=useState(false)
  const {login}=useAuth(); const nav=useNavigate()
  const submit=async e=>{
    e.preventDefault(); setErr(''); 
    if(!role){ setErr('Please select your role.'); return; }
    setLoading(true)
    try{
      const user=await login(u,p,role)
      if(user.role==='ADMIN') nav('/admin')
      else if(user.role==='STUDENT') nav(user.profile_complete?'/student':'/profile')
      else if(['VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL'].includes(user.role)) nav(user.profile_complete?'/verifier':'/profile')
      else nav('/')
    }catch(ex){ 
      const data=ex.response?.data
      const msg = data?.detail || data?.non_field_errors?.[0] || JSON.stringify(data) || 'Login failed. Check username/password/role.'
      setErr(msg)
    }
    setLoading(false)
  }
  return (
    <div className="login-page" style={{
      flex:1,
      minHeight:0,
      margin:0,
      padding:'5px 25px 5px 5px',
      display:'flex',
      alignItems:'center',
      justifyContent:'flex-end',
      position:'relative',
      backgroundImage: `url('/images/home-page3.jpg')`,
      backgroundSize:'cover',
      backgroundPosition:'center',
      backgroundRepeat:'no-repeat',
      overflow:'hidden'
    }}>
      <div className="page" style={{position:'relative', width:'100%', maxWidth:440, background:'#fff',borderRadius:18,boxShadow:'0 20px 48px rgba(15,23,42,.22), 0 8px 20px rgba(15,23,42,.14)',overflow:'hidden',border:'1px solid rgba(226,232,240,.9)'}}>
        <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 45%,#4f46e5 100%)',padding:'22px 22px 18px',color:'#fff',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,background:'radial-gradient(300px 120px at 20% 0%, rgba(255,255,255,.14), transparent 60%)'}}/>
          <div style={{position:'relative'}}>
            <img src="/images/College-of-Engineering-Karunagappally logo.png" alt="CEK Logo" style={{width:42,height:42,borderRadius:11,background:'#fff',objectFit:'contain',boxShadow:'0 8px 20px rgba(0,0,0,.18)'}} />
            <h2 style={{margin:'10px 0 0',fontSize:20,letterSpacing:-.02,lineHeight:1.1}}>No-Due Portal</h2>
            <p style={{margin:'4px 0 0',fontSize:13,opacity:.85,fontWeight:500}}>Sign in with your role • CEK IHRD</p>
          </div>
        </div>
        <div style={{padding:20, background:'linear-gradient(180deg, rgba(255,255,255,.98), #fff)'}}>
          <p style={{textAlign:'center',fontSize:13,color:'#475569',margin:0,lineHeight:1.5}}>Select your role and enter credentials given by Admin</p>
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12,marginTop:16}}>
            <select value={role} onChange={e=>setRole(e.target.value)} style={{...inp, cursor:'pointer', background:'#fff'}} required>
              {ROLES.map(r=> <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input placeholder="Username / ID (e.g. stu1)" value={u} onChange={e=>setU(e.target.value)} style={inp} required/>
            <input placeholder="Password" type="password" value={p} onChange={e=>setP(e.target.value)} style={inp} required/>
            {err && <div style={{color:'#b91c1c',fontSize:12,background:'#fef2f2',padding:10,borderRadius:10,border:'1px solid #fecaca',whiteSpace:'pre-wrap',lineHeight:1.5}}>{err}</div>}
            <button type="submit" disabled={loading} style={{background: role?'linear-gradient(135deg,#2563eb,#4f46e5)':'#94a3b8',color:'#fff',border:'none',padding:'11px 14px',borderRadius:11,cursor: loading?'wait':'pointer',fontWeight:700,boxShadow: role?'0 8px 18px rgba(37,99,235,.28)':'none',letterSpacing:.01}}>{loading?'Signing in…':'Login →'}</button>
          </form>
          <p style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:14,lineHeight:1.5}}>401? Check (1) role, (2) Active status in Admin, (3) password. Admin can Reset Password to reactivate.</p>
        </div>
      </div>
    </div>
  )
}
const inp={padding:'11px 12px',border:'1px solid #e2e8f0',borderRadius:11,fontSize:14,background:'#fff',boxShadow:'0 1px 0 rgba(15,23,42,.02)'}
