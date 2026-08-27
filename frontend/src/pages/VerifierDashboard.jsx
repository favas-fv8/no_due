import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../utils/auth'

export default function VerifierDashboard(){
  const [reqs,setReqs]=useState([])
  const [filter,setFilter]=useState('PENDING')
  const [msg,setMsg]=useState('')
  const [selected,setSelected]=useState(null)
  const [detail,setDetail]=useState(null)
  const [remark,setRemark]=useState('')
  const [profile,setProfile]=useState(null)
  const location=useLocation()
  const {user}=useAuth()
  const [view,setView]=useState(location.state?.view==='history' ? 'history' : 'inbox')
  const [logs,setLogs]=useState([])

  // fetch verifier profile to know verification_type for strict inbox filtering
  useEffect(()=>{
    api.get('/auth/me/').then(r=> setProfile(r.data.profile || r.data)).catch(()=>{
      // fallback to /profile/ if auth/me fails
      api.get('/profile/').then(r2=> setProfile(r2.data)).catch(()=>{})
    })
  },[])

  // load audit logs for the History tab
  useEffect(()=>{
    api.get('/submissions/audit/').then(r=> setLogs(r.data)).catch(()=>{})
  },[])

  const load=async()=>{
    const r=await api.get('/verification/inbox/', {params: filter?{status:filter}:{}})
    setReqs(r.data)
  }
  useEffect(()=>{load()},[filter])

  // auto-dismiss inbox messages like 'Marked Approved' / 'Marked Rejected' after few seconds
  useEffect(()=>{
    if(msg){
      const t=setTimeout(()=>setMsg(''), 4000)
      return ()=>clearTimeout(t)
    }
  },[msg])

  const [searchId,setSearchId]=useState('')
  const [searchResult,setSearchResult]=useState(null)
  const [searchLoading,setSearchLoading]=useState(false)
  const [selectedYear,setSelectedYear]=useState('')
  const curYear = new Date().getFullYear()
  const yearOptions = Array.from({length: curYear-2000+1}, (_,i)=> String(2000+i)).reverse()

  const handleSearch=async()=>{
    const q=searchId.trim()
    if(!q){ setMsg('Please enter Student User ID (username) to search'); return }
    setSearchLoading(true); setSearchResult(null)
    try{
      const params={student_id:q}
      if(selectedYear) params.year = selectedYear
      const r=await api.get('/verification/search/', {params})
      setSearchResult(r.data)
      setMsg(`Found student ${r.data.student.username} (${r.data.student.profile?.department||''}/${r.data.student.profile?.division||''})`)
      // auto-select first request if any to show detail
      if(r.data.requests && r.data.requests.length>0){
        // optionally open first request
      }
    }catch(e){
      const detail=e.response?.data?.detail || 'Search failed'
      const status=e.response?.status
      if(status===404){
        setMsg(detail)
      }else if(status===403){
        setMsg(detail)
      }else{
        setMsg(detail)
      }
      setSearchResult(null)
    }finally{ setSearchLoading(false) }
  }
  const clearSearch=()=>{
    setSearchId(''); setSelectedYear(''); setSearchResult(null); setMsg('')
    load()
  }

  const open=async(id)=>{
    const r=await api.get(`/verification/request/${id}/`)
    setDetail(r.data); setSelected(id)
  }
  const action=async(act)=>{
    try{
      const r=await api.post(`/verification/request/${selected}/action/`, {action:act, remark})
      setMsg(r.data.detail); setRemark(''); load(); open(selected)
    }catch(e){ setMsg(e.response?.data?.detail||JSON.stringify(e.response?.data))}
  }

  // strict inbox filtering: only show requests matching verifier's verification_type
  // e.g. if profile.verification_type == 'lab' -> only LAB cards
  const typeToSection = {
    'office': 'OFFICE',
    'placement': 'PLACEMENT',
    'pta': 'PTA',
    'bus': 'BUS',
    'bus maintenance': 'BUS',
    'hostel': 'HOSTEL',
    'lab': 'LAB',
    'library': 'LIBRARY',
    'staff advisor': 'STAFF_ADVISOR',
    'hod': 'HOD',
    'principal': 'PRINCIPAL',
  }
  const vt = (profile?.verification_type || '').trim().toLowerCase()
  const allowedSection = typeToSection[vt]
  const displayReqs = allowedSection ? reqs.filter(r => r.section === allowedSection) : reqs
  // History tab: show only this user's relevant audit logs (by their verification section)
  const historyLogs = allowedSection ? logs.filter(l => l.section === allowedSection) : logs

  return (
    <div className="page verifier-layout" style={{maxWidth:1200,margin:'5px auto',padding:'5px',display:'flex',gap:5,alignItems:'stretch', flexWrap:'nowrap', flex:1, width:'100%', height:'100%', minHeight:0}}>
      {/* Sidebar — Inbox + Profile for verifier/hod/staff/principal — fills height between header and footer */}
      <aside className="sidebar" style={{width:260, flexShrink:0, position:'sticky', top:5, height:'100%', maxHeight:'100%', background:'linear-gradient(180deg,#0f172a 0%, #1e293b 100%)',borderRadius:16,padding:5,color:'#fff',boxShadow:'0 10px 24px rgba(15,23,42,.16)',border:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',gap:5, overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 6px 10px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'grid',placeItems:'center',fontWeight:800,boxShadow:'0 6px 14px rgba(37,99,235,.28)'}}>📥</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:800,fontSize:13,letterSpacing:-.01,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{profile?.name || profile?.username || 'Verifier'}</div>
            <div style={{fontSize:11,opacity:.75,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><span>{profile?.verification_type || 'Verifier'}</span>•<span>{profile?.verifying_department || '-'}</span></div>
          </div>
        </div>
        <nav style={{display:'flex',flexDirection:'column',gap:6}}>
          <button onClick={()=>setView('inbox')} style={{display:'flex',alignItems:'center',gap:9, padding:'10px 12px',borderRadius:10,background: view==='inbox'?'#fff':'rgba(255,255,255,.06)',color: view==='inbox'?'#0f172a':'#cbd5e1',fontWeight: view==='inbox'?800:600,fontSize:13,boxShadow: view==='inbox'?'0 4px 12px rgba(0,0,0,.12)':'none',border:'1px solid '+(view==='inbox'?'#e2e8f0':'rgba(255,255,255,.08)'),cursor:'pointer',textDecoration:'none'}}>
            <span style={{width:22,height:22,borderRadius:7,background: view==='inbox'?'#eff6ff':'rgba(255,255,255,.08)',border:'1px solid '+(view==='inbox'?'#bfdbfe':'rgba(255,255,255,.08)'),display:'grid',placeItems:'center',fontSize:12}}>📥</span> Inbox
            {view==='inbox' && <span style={{marginLeft:'auto',fontSize:10,background:'#2563eb',color:'#fff',padding:'2px 6px',borderRadius:999, fontWeight:700}}>{displayReqs.length}</span>}
          </button>
          <Link to="/profile" style={{display:'flex',alignItems:'center',gap:9, padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,.06)',color:'#cbd5e1',fontWeight:600,fontSize:13,border:'1px solid rgba(255,255,255,.08)',textDecoration:'none'}}>
            <span style={{width:22,height:22,borderRadius:7,background:'rgba(255,255,255,.08)',display:'grid',placeItems:'center',fontSize:12}}>👤</span> Profile
            <span style={{marginLeft:'auto',opacity:.6, fontSize:12}}>→</span>
          </Link>
          <button onClick={()=>setView('history')} style={{display:'flex',alignItems:'center',gap:9, padding:'10px 12px',borderRadius:10,background: view==='history'?'#fff':'rgba(255,255,255,.06)',color: view==='history'?'#0f172a':'#cbd5e1',fontWeight: view==='history'?800:600,fontSize:13,boxShadow: view==='history'?'0 4px 12px rgba(0,0,0,.12)':'none',border:'1px solid '+(view==='history'?'#e2e8f0':'rgba(255,255,255,.08)'),cursor:'pointer',textDecoration:'none'}}>
            <span style={{width:22,height:22,borderRadius:7,background:'rgba(255,255,255,.08)',display:'grid',placeItems:'center',fontSize:12}}>🕘</span> History
            {view==='history' && <span style={{marginLeft:'auto',opacity:.6, fontSize:12}}>•</span>}
          </button>
        </nav>
        <div style={{fontSize:10,opacity:.6,textAlign:'center',paddingTop:4,borderTop:'1px solid rgba(255,255,255,.06)'}}>CEK IHRD • No-Due Portal</div>
      </aside>

      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:5, height:'100%', minHeight:0, overflowY:'auto'}}>
        {view==='inbox' && (<>
        <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#4338ca 100%)',borderRadius:16,padding:'10px 12px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,boxShadow:'0 10px 24px rgba(15,23,42,.18)',border:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:30,height:30,borderRadius:9,background:'rgba(255,255,255,.14)',border:'1px solid rgba(255,255,255,.18)',display:'grid',placeItems:'center',fontSize:16}}>📥</span>
            <div>
              <h3 style={{margin:0,letterSpacing:-.02, fontSize:15}}>Verifier Workspace</h3>
              <div style={{fontSize:11,opacity:.82,marginTop:1}}>{profile?.name || profile?.username || ''} • {profile?.verification_type || ''} {profile?.verifying_department ? `• ${profile.verifying_department}/${profile.verifying_division}/Sem ${profile.verifying_semester}`:''}</div>
            </div>
          </div>
          <div style={{fontSize:11,background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.14)',padding:'6px 10px',borderRadius:999, fontWeight:600}}>{allowedSection || 'ALL'} • {displayReqs.length} in inbox</div>
        </div>
        <div className="verifier-grid" style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:5, flex:1, minHeight:0}}>
        <div style={{background:'#fff',borderRadius:16,padding:12,boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)',border:'1px solid #e2e8f0',minHeight:0, overflowY:'auto'}}>
          <h3 style={{margin:'2px 0 10px',letterSpacing:-.01, color:'#0f172a'}}>Inbox</h3>
        {/* Search by Student User ID - verifier scoped + year filter following existing constrains */}
        <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
          <input value={searchId} onChange={e=>setSearchId(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} placeholder="Search by Student User ID (e.g. stu1)" style={{flex:1, minWidth:140, padding:'7px 10px',border:'1px solid #cbd5e1',borderRadius:6,fontSize:12}}/>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{padding:'7px 8px',border:'1px solid #cbd5e1',borderRadius:6,fontSize:12, minWidth:110, background:'#fff'}}>
            <option value="">All Years</option>
            {yearOptions.map(y=> <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleSearch} disabled={searchLoading} style={{padding:'7px 12px',background: searchLoading?'#94a3b8':'#0f172a',color:'#fff',border:'none',borderRadius:6,fontSize:12,cursor: searchLoading?'not-allowed':'pointer', fontWeight:600}}>{searchLoading?'...':'Search'}</button>
          <button onClick={clearSearch} style={{padding:'7px 10px',background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:6,fontSize:12,cursor:'pointer'}}>Clear</button>
        </div>
        {selectedYear && <div style={{fontSize:10,color:'#475569',marginBottom:6, background:'#fefce8',border:'1px solid #fde68a',padding:'4px 8px',borderRadius:6}}>Year filter: <b>{selectedYear}</b> (student's Year of Admission must match)</div>}
        {searchResult && (
          <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:'#1e40af',marginBottom:6, display:'flex',alignItems:'center',gap:6}}>🔍 Search Result — <span style={{background:'#fff',border:'1px solid #bfdbfe',padding:'2px 6px',borderRadius:6, fontSize:11}}>{searchResult.student.username}</span></div>
            {/* Single line: name, id, department, division, semester, year — good layout */}
            <div style={{display:'flex',flexWrap:'wrap',gap:5,alignItems:'center', background:'#fff',border:'1px solid #bfdbfe',borderRadius:7,padding:'6px 8px'}}>
              <span style={{fontWeight:700,fontSize:11, color:'#0f172a', background:'#f8fafc',border:'1px solid #cbd5e1',padding:'2px 7px',borderRadius:10}}>{searchResult.student.profile?.name || searchResult.student.username}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#e0f2fe',color:'#0c4a6e',border:'1px solid #bae6fd',fontWeight:600}}>ID: {searchResult.student.username}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#dcfce7',color:'#14532d',border:'1px solid #86efac',fontWeight:600}}>{searchResult.student.profile?.department || '-'}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',fontWeight:600}}>Div {searchResult.student.profile?.division || '-'}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#ede9fe',color:'#5b21b6',border:'1px solid #ddd6fe',fontWeight:600}}>Sem {searchResult.student.profile?.semester || '-'}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#ffedd5',color:'#9a3412',border:'1px solid #fed7aa',fontWeight:600}}>Year: {searchResult.student.profile?.year_of_admission || '-'}</span>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background: searchResult.student.profile?.is_hosteller?'#fce7f3':'#f1f5f9',color: searchResult.student.profile?.is_hosteller?'#9d174d':'#334155',border:'1px solid #e2e8f0',fontWeight:600}}>{searchResult.student.profile?.is_hosteller?'Hosteller':'Day Scholar'}</span>
            </div>
            <div style={{fontSize:10,color:'#64748b',marginTop:4, textAlign:'center'}}>{searchResult.student.profile?.personal_email || ''} {searchResult.student.profile?.personal_email && searchResult.student.profile?.personal_phone ? ' • ' : ''} {searchResult.student.profile?.personal_phone || ''}</div>
            {/* Only show verifier's verification_type data, not all verification data */}
            {(() => {
              const sec = searchResult.submission?.sections?.[0]
              if(!sec) return null
              return (
                <div style={{marginTop:8, background:'#fff',border:'1px solid #cbd5e1',borderRadius:6,padding:8}}>
                  <div style={{fontSize:11,fontWeight:700, color:'#1e293b'}}>Your Verification Type — <span style={{color:'#2563eb'}}>{allowedSection || sec.section}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6, padding:'6px 8px',background: sec.status==='APPROVED'?'#ecfdf5': sec.status==='REJECTED'?'#fef2f2': sec.status==='NOT_REQUIRED'?'#f1f5f9':'#fffbeb',border:'1px solid #e2e8f0',borderRadius:6}}>
                    <span style={{fontSize:11,fontWeight:600}}>{sec.section}</span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background: sec.status==='APPROVED'?'#16a34a': sec.status==='REJECTED'?'#ef4444': sec.status==='NOT_REQUIRED'?'#94a3b8':'#d97706',color:'#fff',fontWeight:700}}>{sec.status}</span>
                  </div>
                  {sec.remark && <div style={{fontSize:11,color:'#ef4444',marginTop:4}}>Remark: {sec.remark}</div>}
                  <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Updated: {sec.updated_at? new Date(sec.updated_at).toLocaleString() : '-' } {sec.files?.length ? `• Files: ${sec.files.length}`:''}</div>
                  {sec.files?.length>0 && <div style={{fontSize:11,marginTop:4}}>{sec.files.map(f=> <a key={f.id} href={f.file} target="_blank" rel="noreferrer" style={{color:'#2563eb',fontSize:11}}>{f.original_name} </a>)}</div>}
                </div>
              )
            })()}
            {searchResult.requests?.length>0 ? (
              <div style={{marginTop:8}}>
                <div style={{fontSize:11,fontWeight:600}}>Requests in your scope ({searchResult.requests.length}):</div>
                {searchResult.requests.map(r=>(
                  <div key={r.id} onClick={()=>open(r.id)} style={{marginTop:4,padding:'6px 8px',background:'#fff',border:`1px solid ${selected===r.id?'#2563eb':'#e2e8f0'}`,borderRadius:6,cursor:'pointer'}}>
                    <div style={{fontSize:12,fontWeight:600}}>{r.section} — {r.status}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{fontSize:11,color:'#64748b',marginTop:6}}>No pending requests for your verification type for this student.</div>
            )}
          </div>
        )}
        <div style={{display:'flex',gap:6,marginBottom:10}}>
          {['PENDING','APPROVED','REJECTED',''].map(s=> <button key={s} onClick={()=>setFilter(s)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:filter===s?'#2563eb':'#fff',color:filter===s?'#fff':'#000',fontSize:12}}>{s||'ALL'}</button>)}
        </div>
        {msg && <div style={{fontSize:12,padding:'6px 8px',borderRadius:6,marginBottom:8,background: msg.toLowerCase().includes('reject')||msg.toLowerCase().includes('no access')||msg.toLowerCase().includes('does not exist') ? '#fef2f2' : msg.toLowerCase().includes('approv') || msg.toLowerCase().includes('accept') || msg.toLowerCase().includes('found') ? '#dcfce7' : '#fffbeb', color: msg.toLowerCase().includes('reject')||msg.toLowerCase().includes('no access')||msg.toLowerCase().includes('does not exist') ? '#b91c1c' : msg.toLowerCase().includes('approv') || msg.toLowerCase().includes('accept') || msg.toLowerCase().includes('found') ? '#166534' : '#92400e', border:`1px solid ${msg.toLowerCase().includes('reject')||msg.toLowerCase().includes('no access')||msg.toLowerCase().includes('does not exist') ? '#fecaca' : msg.toLowerCase().includes('approv') || msg.toLowerCase().includes('accept') || msg.toLowerCase().includes('found') ? '#86efac' : '#fde68a'}`}}>{msg}</div>}
        {profile?.verification_type && <div style={{fontSize:11, color:'#334155', background:'#f1f5f9', border:'1px solid #e2e8f0', padding:'4px 8px', borderRadius:6, marginBottom:8}}>Showing only <b>{allowedSection || profile.verification_type}</b> requests (your verification type)</div>}
        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'70vh',overflowY:'auto'}}>
          {displayReqs.length===0 ? <p style={{fontSize:13,color:'#64748b'}}>{allowedSection ? `No ${allowedSection} requests` : 'No requests'}</p> : displayReqs.map(r=>(
            <div key={r.id} onClick={()=>open(r.id)} style={{padding:10,border:`1px solid ${selected===r.id?'#2563eb':'#e2e8f0'}`,borderRadius:8,cursor:'pointer',background:selected===r.id?'#eff6ff':'#fff'}}>
              <div style={{fontWeight:600,fontSize:13, color:'#0f172a'}}>{r.section} — <span style={{color:'#2563eb'}}>{r.student_name}</span></div>
              {/* Single line student info: name, id, dept, division, semester, year */}
              <div style={{display:'flex',flexWrap:'wrap',gap:5,alignItems:'center',marginTop:5, background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:7,padding:'5px 7px'}}>
                <span style={{fontWeight:700,fontSize:11, color:'#0f172a', background:'#fff',border:'1px solid #cbd5e1',padding:'2px 7px',borderRadius:10}}>{r.student_name}</span>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#e0f2fe',color:'#0c4a6e',border:'1px solid #bae6fd',fontWeight:600}}>ID: {r.student_username}</span>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#dcfce7',color:'#14532d',border:'1px solid #86efac',fontWeight:600}}>{r.student_profile?.department || '-'}</span>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',fontWeight:600}}>Div {r.student_profile?.division || '-'}</span>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#ede9fe',color:'#5b21b6',border:'1px solid #ddd6fe',fontWeight:600}}>Sem {r.student_profile?.semester || '-'}</span>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#ffedd5',color:'#9a3412',border:'1px solid #fed7aa',fontWeight:600}}>Year: {r.student_profile?.year_of_admission || '-'}</span>
              </div>
              <div style={{fontSize:11,marginTop:6, display:'flex',gap:6,alignItems:'center'}}><span style={{background: r.status==='APPROVED'?'#16a34a': r.status==='REJECTED'?'#ef4444':'#d97706',color:'#fff',padding:'2px 8px',borderRadius:10,fontSize:10,fontWeight:700}}>{r.status}</span> <span style={{color:'#64748b',fontSize:11}}>{new Date(r.created_at).toLocaleString()}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:'#fff',borderRadius:16,padding:16,boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)',border:'1px solid #e2e8f0',minHeight:0, overflowY:'auto'}}>
        {!detail ? <p style={{color:'#64748b'}}>Select a request</p> : (
          <>
            <h3 style={{margin:0, color:'#0f172a'}}>{detail.section} — {detail.student_name}</h3>
            {/* Single line: name, id, department, division, semester, year — good layout */}
            <div style={{display:'flex',flexWrap:'wrap',gap:5,alignItems:'center',marginTop:8, background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px'}}>
              <span style={{fontWeight:700,fontSize:12, color:'#0f172a', background:'#fff',border:'1px solid #cbd5e1',padding:'2px 8px',borderRadius:10}}>{detail.student_name}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#e0f2fe',color:'#0c4a6e',border:'1px solid #bae6fd',fontWeight:600}}>ID: {detail.student_username}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#dcfce7',color:'#14532d',border:'1px solid #86efac',fontWeight:600}}>{detail.student_profile?.department || '-'}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',fontWeight:600}}>Div {detail.student_profile?.division || '-'}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#ede9fe',color:'#5b21b6',border:'1px solid #ddd6fe',fontWeight:600}}>Sem {detail.student_profile?.semester || '-'}</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#ffedd5',color:'#9a3412',border:'1px solid #fed7aa',fontWeight:600}}>Year: {detail.student_profile?.year_of_admission || '-'}</span>
            </div>
            <p style={{marginTop:8, fontSize:13}}>Status: <b style={{color: detail.section_status.status==='APPROVED'?'#16a34a': detail.section_status.status==='REJECTED'?'#ef4444':'#d97706'}}>{detail.section_status.status}</b></p>
            {detail.section_status.remark && <p style={{fontSize:13,color:'#ef4444'}}>Remark: {detail.section_status.remark}</p>}
            {detail.section_status.files?.length>0 ? <div>
              <h4>Proof Files — {detail.section}</h4>
              {detail.section_status.files.map(f=> <div key={f.id} style={{marginBottom:6}}><a href={f.file} target="_blank" rel="noreferrer" style={{color:'#2563eb'}}>{f.original_name} ({f.file_type}, {(f.size/1024).toFixed(1)}KB)</a></div>)}
            </div> : <p style={{fontSize:13,color:'#64748b'}}>No files for this section (request type)</p>}

            {detail.status==='PENDING' && (
              <div style={{marginTop:16,borderTop:'1px solid #e2e8f0',paddingTop:12}}>
                <textarea placeholder="Optional remark" value={remark} onChange={e=>setRemark(e.target.value)} style={{width:'100%',padding:8,border:'1px solid #e2e8f0',borderRadius:8}} rows={3}/>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={()=>action('APPROVE')} style={{background:'#16a34a',color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer'}}>Approve</button>
                  <button onClick={()=>action('REJECT')} style={{background:'#ef4444',color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer'}}>Reject</button>
                </div>
              </div>
            )}

            {(() => {
              const filteredLogs = allowedSection ? detail.logs?.filter(l => l.section === allowedSection) : detail.logs
              return filteredLogs?.length>0 && (
                <div style={{marginTop:16}}>
                  <h4>Audit History {allowedSection ? `— ${allowedSection} only` : ''}</h4>
                  {allowedSection && <div style={{fontSize:11, color:'#64748b', marginBottom:4}}>Showing only <b>{allowedSection}</b> audit history (your verification type)</div>}
                  {filteredLogs.map(l=> <div key={l.id} style={{fontSize:12,padding:'4px 0',borderBottom:'1px solid #f1f5f9'}}>{new Date(l.timestamp).toLocaleString()} — {l.section} — {l.action} by {l.performed_by_username} {l.from_status}→{l.to_status} {l.remark && `| ${l.remark}`}</div>)}
                </div>
              )
            })()}
          </>
        )}
        </div>
      </div>
        </>)}
        {view==='history' && (
        <section style={{background:'#fff',borderRadius:16,boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)',border:'1px solid #e2e8f0',padding:16}}>
          <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:6,marginBottom:10,color:'#0f172a'}}><span>🕘</span> History / Audit <span style={{marginLeft:'auto',fontSize:11,background:'#f1f5f9',border:'1px solid #e2e8f0',padding:'2px 8px',borderRadius:999}}>{historyLogs.length}</span></div>
          <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:360, overflowY:'auto', paddingRight:4}}>
            {historyLogs.length===0 ? <p style={{fontSize:13,color:'#94a3b8',background:'#f8fafc',padding:12,borderRadius:8,textAlign:'center'}}>No activity yet</p> : historyLogs.slice(0,30).map(l=>(
              <div key={l.id} style={{display:'flex',flexDirection:'column',gap:3,padding:'8px 10px',background:'#fff',borderRadius:8,border:'1px solid #e2e8f0',color:'#0f172a'}}>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontWeight:700,fontSize:11,background:'#f1f5f9',border:'1px solid #e2e8f0',padding:'2px 6px',borderRadius:999}}>{l.section}</span>
                  <span style={{fontSize:10,background: l.to_status==='APPROVED'?'#dcfce7': l.to_status==='REJECTED'?'#fee2e2':'#fef3c7',color: l.to_status==='APPROVED'?'#065f46': l.to_status==='REJECTED'?'#991b1b':'#92400e',padding:'2px 6px',borderRadius:999,border:'1px solid #e2e8f0'}}>{l.action}</span>
                  <span style={{fontSize:10,color:'#64748b',marginLeft:'auto'}}>{new Date(l.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{fontSize:11,color:'#334155',display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{color:'#2563eb',fontWeight:600}}>{l.performed_by_username}</span>
                  <span style={{color:'#94a3b8'}}>{l.from_status}→{l.to_status}</span>
                  {l.remark && <span style={{color:'#ef4444',fontSize:10,background:'#fef2f2',padding:'1px 6px',borderRadius:999,border:'1px solid #fecaca'}}>{l.remark}</span>}
                </div>
                <div style={{fontSize:10,color:'#94a3b8'}}>{new Date(l.timestamp).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </section>
        )}
      </div>
    </div>
  )
}
