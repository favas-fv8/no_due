import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../utils/auth'

export default function Profile(){
  const {user,fetchMe}=useAuth()
  const [form,setForm]=useState({})
  const [msg,setMsg]=useState('')
  const [err,setErr]=useState('')
  const [pwOld,setPwOld]=useState('')
  const [pwNew,setPwNew]=useState('')
  const [pwConfirm,setPwConfirm]=useState('')
  const [pwLoading,setPwLoading]=useState(false)
  const nav=useNavigate()

  useEffect(()=>{
    const load=async()=>{
      try{
        const r=await api.get('/profile/')
        setForm(r.data)
      }catch{}
      // also set defaults from user profile if exists
      if(user?.profile){
        setForm(prev=>({...user.profile, ...prev}))
      }
    }
    load()
  },[user])

  if(!user) return <div>Loading</div>

  const role=user.role

  const validateField=(k,v)=>{
    const curYear=new Date().getFullYear()
    if(k==='name'){
      if(!v || !v.trim()) return 'Name is required'
      if(!/^[A-Za-z\s]+$/.test(v)) return 'Name must contain only letters and spaces'
      if(v.trim().length<2 || v.trim().length>50) return 'Name must be 2-50 characters'
    }
    if(k==='address'){
      if(!v || !v.trim()) return 'Address is required'
      if(!/^[A-Za-z0-9\s,.\-/#]+$/.test(v)) return 'Address contains invalid characters (allowed: letters, numbers, spaces, , . - / #)'
      if(v.trim().length<10 || v.trim().length>200) return 'Address must be 10-200 characters'
    }
    if(k==='personal_email'){
      if(!v || !v.trim()) return 'Email is required'
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'Invalid email format'
    }
    if(k==='personal_phone'){
      if(!v || !String(v).trim()) return 'Phone is required'
      if(!/^\d{10}$/.test(String(v).trim())) return 'Phone must be exactly 10 digits (digits only)'
    }
    if(k==='year_of_admission'){
      if(v===''||v==null) return 'Year of admission is required'
      const y=parseInt(v,10)
      if(isNaN(y)) return 'Year must be a number'
      if(y<2000 || y>curYear) return `Year must be between 2000 and ${curYear}`
    }
    return null
  }

  const submit=async e=>{
    e.preventDefault(); setMsg(''); setErr('')
    if(role==='STUDENT'){
      const fields=['name','address','personal_email','personal_phone','year_of_admission']
      for(let k of fields){
        const errMsg=validateField(k, form[k])
        if(errMsg){ setErr(errMsg + ` (${k})`); return }
      }
      // extra required checks
      if(!form.department || !form.division || !form.semester){ setErr('Department/Division/Semester required'); return }
    }
    try{
      // ensure year is integer
      const payload={...form}
      if(payload.year_of_admission) payload.year_of_admission=parseInt(payload.year_of_admission,10)
      const r=await api.post('/profile/', payload)
      setMsg('Profile saved successfully')
      await fetchMe()
      setTimeout(()=>{
        if(r.data.is_complete){
          if(role==='STUDENT') nav('/student')
          else if(['VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL'].includes(role)) nav('/verifier')
        }
      },500)
    }catch(ex){
      const data=ex.response?.data
      if(data && typeof data==='object'){
        const firstKey=Object.keys(data)[0]
        const firstVal=Array.isArray(data[firstKey])? data[firstKey][0] : data[firstKey]
        setErr(`${firstKey}: ${firstVal}`)
      }else{
        setErr(JSON.stringify(data))
      }
    }
  }

  const changePw=async()=>{
    setMsg(''); setErr('')
    if(pwNew!==pwConfirm){ setErr('New passwords do not match.'); return }
    if(pwNew.length<4){ setErr('New password must be at least 4 characters.'); return }
    setPwLoading(true)
    try{
      const {data}=await api.post('/auth/change-password/', {old_password:pwOld, new_password:pwNew})
      setMsg(data.detail || 'Password changed successfully.')
      setPwOld(''); setPwNew(''); setPwConfirm('')
    }catch(ex){
      const d=ex.response?.data
      setErr(d?.detail || (d && typeof d==='object' ? JSON.stringify(d) : (typeof d==='string'?d:'Failed to change password.')))
    }finally{
      setPwLoading(false)
    }
  }

  const update=k=>e=>{
    let v=e.target.value
    // live restrict for phone/year
    if(k==='personal_phone'){ v=v.replace(/\D/g,'').slice(0,10) }
    if(k==='year_of_admission'){ v=v.replace(/\D/g,'').slice(0,4) }
    setForm({...form,[k]:v})
  }

  const isStudent = role==='STUDENT'
  const isVerifier = ['VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL'].includes(role)
  const showSidebar = isStudent || isVerifier

  return (
    <div className="page profile-layout" style={{maxWidth: showSidebar? 1200:580, margin:'5px auto', padding:'5px', display:'flex', gap:5, alignItems:'stretch', flexWrap:'nowrap', flex:1, width:'100%', height:'100%', minHeight:0}}>
      {showSidebar && (
        <aside className="sidebar" style={{width:260, flexShrink:0, position:'sticky', top:5, height:'100%', maxHeight:'100%', background:'linear-gradient(180deg,#0f172a 0%,#1e293b 100%)',borderRadius:16,padding:5,color:'#fff',boxShadow:'0 10px 24px rgba(15,23,42,.16)',border:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',gap:5, overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'6px 6px 10px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
            <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'grid',placeItems:'center',fontWeight:800, fontSize:14}}>👤</div>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:800,fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{user.username}</div>
              <div style={{fontSize:10,opacity:.7}}>{role}</div>
            </div>
          </div>
          <nav style={{display:'flex',flexDirection:'column',gap:6}}>
            {isStudent && <>
              <Link to="/student" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background: location.pathname==='/student'?'#fff':'rgba(255,255,255,.06)',color: location.pathname==='/student'?'#0f172a':'#cbd5e1',fontWeight: location.pathname==='/student'?800:600,fontSize:13,border:'1px solid '+(location.pathname==='/student'?'#e2e8f0':'rgba(255,255,255,.08)'),textDecoration:'none'}}>
                <span>📊</span> Dashboard
              </Link>
              <Link to="/profile" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background: location.pathname==='/profile'?'#fff':'rgba(255,255,255,.06)',color: location.pathname==='/profile'?'#0f172a':'#cbd5e1',fontWeight: location.pathname==='/profile'?800:600,fontSize:13,border:'1px solid '+(location.pathname==='/profile'?'#e2e8f0':'rgba(255,255,255,.08)'),textDecoration:'none'}}>
                <span>👤</span> Profile
              </Link>
              <button onClick={()=>nav('/student',{state:{view:'history'}})} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,.06)',color:'#cbd5e1',fontWeight:600,fontSize:13,border:'1px solid rgba(255,255,255,.08)',cursor:'pointer',textDecoration:'none'}}>
                <span>🕘</span> History
              </button>
            </>}
            {isVerifier && <>
              <Link to="/verifier" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background: location.pathname==='/verifier'?'#fff':'rgba(255,255,255,.06)',color: location.pathname==='/verifier'?'#0f172a':'#cbd5e1',fontWeight: location.pathname==='/verifier'?800:600,fontSize:13,border:'1px solid '+(location.pathname==='/verifier'?'#e2e8f0':'rgba(255,255,255,.08)'),textDecoration:'none'}}>
                <span>📥</span> Inbox
              </Link>
              <Link to="/profile" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background: location.pathname==='/profile'?'#fff':'rgba(255,255,255,.06)',color: location.pathname==='/profile'?'#0f172a':'#cbd5e1',fontWeight: location.pathname==='/profile'?800:600,fontSize:13,border:'1px solid '+(location.pathname==='/profile'?'#e2e8f0':'rgba(255,255,255,.08)'),textDecoration:'none'}}>
                <span>👤</span> Profile
              </Link>
              <button onClick={()=>nav('/verifier',{state:{view:'history'}})} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,.06)',color:'#cbd5e1',fontWeight:600,fontSize:13,border:'1px solid rgba(255,255,255,.08)',cursor:'pointer',textDecoration:'none'}}>
                <span>🕘</span> History
              </button>
            </>}
          </nav>
          <div style={{fontSize:10,opacity:.45,textAlign:'center',paddingTop:8,borderTop:'1px solid rgba(255,255,255,.06)'}}>CEK IHRD • No-Due</div>
        </aside>
      )}
      <div style={{flex:1, minWidth:0, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:5, padding:5}}>
        <button onClick={()=> window.history.length>1 ? nav(-1) : nav(user?.role==='STUDENT' ? '/student' : user?.role==='ADMIN' ? '/admin' : '/verifier')} style={{alignSelf:'flex-start', background:'#fff', color:'#0f172a', border:'1px solid #e2e8f0', padding:'7px 13px', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 12px rgba(15,23,42,.08)', display:'inline-flex', alignItems:'center', gap:6}}>← Back</button>
        <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#4338ca 100%)',borderRadius:16,padding:'14px 16px',color:'#fff',position:'relative',overflow:'hidden',boxShadow:'0 10px 24px rgba(15,23,42,.18)',border:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
          <div style={{position:'absolute',inset:0,background:'radial-gradient(500px 200px at 15% 0%, rgba(255,255,255,.14), transparent 60%)'}}/>
          <div style={{position:'relative',display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:11,background:'rgba(255,255,255,.14)',border:'1px solid rgba(255,255,255,.18)',display:'grid',placeItems:'center',fontSize:18}}>👤</div>
            <div>
              <h2 style={{margin:0,fontSize:18,letterSpacing:-.02}}>Complete Profile — {role}</h2>
              <div style={{fontSize:12,opacity:.85,marginTop:2}}>{user.username} • {user.email || 'no email'}</div>
            </div>
          </div>
          {!user.profile_complete && <div style={{position:'relative',marginTop:12,background:'rgba(251,146,60,.14)',border:'1px solid rgba(251,146,60,.28)',color:'#fed7aa',padding:'8px 10px',borderRadius:10,fontSize:12,display:'flex',gap:8,alignItems:'center'}}><span style={{width:8,height:8,borderRadius:999,background:'#fb923c',boxShadow:'0 0 0 4px rgba(251,146,60,.2)'}}/> Please complete your profile to continue — all validations apply</div>}
        </div>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12,padding:18, background:'#fff',borderRadius:16,border:'1px solid #e2e8f0',boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)', maxWidth:640, width:'100%', margin:'0 auto', boxSizing:'border-box', flexShrink:0}}>

        {role==='STUDENT' && <>
          <input placeholder="Full Name (letters & spaces, 2-50)" value={form.name||''} onChange={update('name')} style={{...inp, width:'100%'}} required maxLength={50}/>
          <div style={{display:'flex',gap:8, flexWrap:'wrap'}}>
            <select value={form.department||''} onChange={update('department')} style={{...inp, flex:'1 1 120px', minWidth:110}} required><option value="">Department</option><option>CS</option><option>EC</option><option>EEE</option><option>MECH</option><option>CIVIL</option></select>
            <select value={form.division||''} onChange={update('division')} style={{...inp, flex:'1 1 90px', minWidth:90}} required><option value="">Division</option><option>A</option><option>B</option><option>C</option></select>
            <select value={form.semester||''} onChange={update('semester')} style={{...inp, flex:'1 1 100px', minWidth:100}} required><option value="">Semester</option>{[...Array(8)].map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select>
          </div>
          <input placeholder="Year of Admission (2000 - current year)" type="text" inputMode="numeric" value={form.year_of_admission||''} onChange={update('year_of_admission')} style={{...inp, width:'100%'}} required/>
          <textarea placeholder="Address (10-200 chars, letters/numbers/,.-/#)" value={form.address||''} onChange={update('address')} style={{...inp, width:'100%', minHeight:72, resize:'vertical'}} required maxLength={200}/>
          <label style={{display:'flex',gap:8,alignItems:'center',fontSize:13, background:'#f8fafc',border:'1px solid #e2e8f0',padding:'8px 10px',borderRadius:8}}><input type="checkbox" checked={!!form.is_hosteller} onChange={e=>setForm({...form,is_hosteller:e.target.checked})}/> Hosteller?</label>
          <input placeholder="Personal Email" type="email" value={form.personal_email||''} onChange={update('personal_email')} style={{...inp, width:'100%'}} required/>
          <input placeholder="Personal Phone (10 digits)" value={form.personal_phone||''} onChange={update('personal_phone')} style={{...inp, width:'100%'}} required maxLength={10}/>
          <div style={{fontSize:11,color:'#64748b',background:'#f8fafc',padding:'8px 10px',borderRadius:8,border:'1px solid #e2e8f0',lineHeight:1.5}}>
            Validations: Name 2-50 letters/spaces • Address 10-200 • Email format • Phone 10 digits • Year 2000-{new Date().getFullYear()}
          </div>
        </>}

        {role==='VERIFIER' && <>
          <input placeholder="Name" value={form.name||''} onChange={update('name')} style={{...inp, width:'100%'}} required/>
          <select value={form.verification_type||''} onChange={update('verification_type')} style={{...inp, width:'100%'}} required>
            <option value="">Verification Type</option><option>Office</option><option>Placement</option><option>PTA</option><option>Bus Maintenance</option><option>Lab</option><option>Library</option><option>Hostel</option>
          </select>
          <div style={{display:'flex',gap:8, flexWrap:'wrap'}}>
            <select value={form.verifying_department||''} onChange={update('verifying_department')} style={{...inp, flex:'1 1 110px', minWidth:110}}><option value="ALL">Dept ALL</option><option>CS</option><option>EC</option><option>EEE</option><option>MECH</option><option>CIVIL</option></select>
            <select value={form.verifying_division||''} onChange={update('verifying_division')} style={{...inp, flex:'1 1 90px', minWidth:90}}><option value="ALL">Div ALL</option><option>A</option><option>B</option><option>C</option></select>
            <select value={form.verifying_semester||''} onChange={update('verifying_semester')} style={{...inp, flex:'1 1 100px', minWidth:100}}><option value="ALL">Sem ALL</option>{[...Array(8)].map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select>
          </div>
        </>}

        {role==='STAFF_ADVISOR' && <>
          <input placeholder="Name" value={form.name||''} onChange={update('name')} style={{...inp, width:'100%'}} required/>
          <div style={{display:'flex',gap:8, flexWrap:'wrap'}}>
            <select value={form.verifying_department||''} onChange={update('verifying_department')} style={{...inp, flex:'1 1 110px', minWidth:110}} required><option value="">Department</option><option>CS</option><option>EC</option><option>EEE</option><option>MECH</option><option>CIVIL</option></select>
            <select value={form.verifying_division||''} onChange={update('verifying_division')} style={{...inp, flex:'1 1 90px', minWidth:90}} required><option value="">Division</option><option>A</option><option>B</option><option>C</option></select>
            <select value={form.verifying_semester||''} onChange={update('verifying_semester')} style={{...inp, flex:'1 1 100px', minWidth:100}} required><option value="">Semester</option>{[...Array(8)].map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select>
          </div>
          <p style={{fontSize:12,color:'#64748b'}}>Verification type fixed to Staff Advisor</p>
        </>}

        {role==='HOD' && <>
          <input placeholder="Name" value={form.name||''} onChange={update('name')} style={{...inp, width:'100%'}} required/>
          <select value={form.verifying_department||''} onChange={update('verifying_department')} style={{...inp, width:'100%'}} required><option value="">Department</option><option>CS</option><option>EC</option><option>EEE</option><option>MECH</option><option>CIVIL</option></select>
          <p style={{fontSize:12,color:'#64748b'}}>Division/Semester = All (HOD)</p>
        </>}

        {role==='PRINCIPAL' && <>
          <input placeholder="Name" value={form.name||''} onChange={update('name')} style={inp} required/>
          <p style={{fontSize:12,color:'#64748b'}}>Principal verifies all departments/divisions/semesters</p>
        </>}

        {role==='ADMIN' && <>
          <p style={{fontSize:13,color:'#64748b'}}>Admin has no profile configuration</p>
          <div style={{marginTop:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:14}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>🔒 Change Password</div>
            <div style={{display:'grid',gap:10}}>
              <input type="password" placeholder="Current Password" value={pwOld} onChange={e=>setPwOld(e.target.value)} style={inp}/>
              <input type="password" placeholder="New Password" value={pwNew} onChange={e=>setPwNew(e.target.value)} style={inp}/>
              <input type="password" placeholder="Confirm New Password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} style={inp}/>
              <button type="button" onClick={changePw} disabled={pwLoading||!pwOld||!pwNew||!pwConfirm} style={{alignSelf:'flex-start',background:'linear-gradient(135deg,#2563eb,#4f46e5)',color:'#fff',border:'none',padding:'11px 16px',borderRadius:11,cursor:'pointer',fontWeight:700,boxShadow:'0 8px 18px rgba(37,99,235,.24)',letterSpacing:.01,opacity:(pwLoading||!pwOld||!pwNew||!pwConfirm)?.6:1}}>
                {pwLoading ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </div>
        </>}

        {msg && <div style={{color:'#065f46',fontSize:13,background:'#ecfdf5',border:'1px solid #a7f3d0',padding:'10px 12px',borderRadius:10,display:'flex',gap:8,alignItems:'center'}}><span style={{width:8,height:8,borderRadius:999,background:'#10b981'}}/> {msg}</div>}
        {err && <div style={{color:'#991b1b',fontSize:12,background:'#fef2f2',border:'1px solid #fecaca',padding:'10px 12px',borderRadius:10,wordBreak:'break-all',lineHeight:1.5}}>{err}</div>}

        {role!=='ADMIN' && <button type="submit" style={{background:'linear-gradient(135deg,#2563eb,#4f46e5)',color:'#fff',border:'none',padding:'12px 14px',borderRadius:11,cursor:'pointer',fontWeight:700,boxShadow:'0 8px 18px rgba(37,99,235,.24)',letterSpacing:.01}}>Save Profile →</button>}
      </form>
      </div>
    </div>
  )
}
const inp={padding:'11px 12px',border:'1px solid #e2e8f0',borderRadius:11,width:'100%',background:'#fff',fontSize:14,boxShadow:'0 1px 0 rgba(15,23,42,.02)'}
