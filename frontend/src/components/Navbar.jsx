import { useAuth } from '../utils/auth'
import { Link, useNavigate } from 'react-router-dom'

export default function Navbar(){
  const {user,logout}=useAuth()
  const nav=useNavigate()
  return (
    <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 5px',background:'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1e3a5f 100%)',color:'#fff',position:'sticky',top:0,zIndex:20,boxShadow:'0 6px 20px rgba(15,23,42,.18)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
      <Link to="/" style={{color:'#fff',textDecoration:'none',fontWeight:800,fontSize:18,letterSpacing:-.02,display:'flex',alignItems:'center',gap:9}}>
        <span style={{width:32,height:32,borderRadius:9,display:'grid',placeItems:'center',background:'linear-gradient(135deg,#2563eb,#7c3aed)',boxShadow:'0 6px 14px rgba(37,99,235,.35)',fontSize:14}}>✓</span>
        No-Due <span style={{fontWeight:600,opacity:.92}}>Portal</span>
        <span style={{fontSize:10,background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.14)',padding:'2px 7px',borderRadius:999,marginLeft:4,letterSpacing:.04}}>CEK • IHRD</span>
      </Link>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        {user ? <>
          <span style={{fontSize:12,background:'rgba(255,255,255,.10)',border:'1px solid rgba(255,255,255,.14)',padding:'6px 10px',borderRadius:999,display:'flex',alignItems:'center',gap:7}}>
            <span style={{width:7,height:7,borderRadius:999,background:'#22c55e',boxShadow:'0 0 0 4px rgba(34,197,94,.25)'}}/>
            {user.username} <span style={{opacity:.6}}>•</span> <span style={{fontWeight:700,letterSpacing:.03}}>{user.role}</span>
          </span>
          {/* Dashboard/Profile/Inbox moved to sidebar for student/verifier — keep only Admin in top bar */}
          {user.role==='ADMIN' && <Link to="/admin" style={linkStyle}>Admin</Link>}
          {user.role==='ADMIN' && <Link to="/profile" style={linkStyle}>Profile</Link>}
          <button onClick={()=>{logout();nav('/login')}} style={btn}>Logout</button>
        </> : <Link to="/login" style={linkStyleEx}>Login →</Link>}
      </div>
    </nav>
  )
}
const linkStyle={color:'#c7d2fe',textDecoration:'none',fontSize:13,fontWeight:600,padding:'7px 10px',borderRadius:8,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',transition:'all .15s'}
const linkStyleEx={color:'#fff',textDecoration:'none',fontSize:13,fontWeight:700,padding:'8px 14px',borderRadius:10,background:'linear-gradient(135deg,#2563eb,#4f46e5)',boxShadow:'0 6px 14px rgba(37,99,235,.3)'}
const btn={background:'#ef4444',color:'#fff',border:'none',padding:'7px 12px',borderRadius:9,cursor:'pointer',fontWeight:700,boxShadow:'0 4px 12px rgba(239,68,68,.28)'}
