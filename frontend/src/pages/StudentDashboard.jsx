import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../utils/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const SECTIONS = [
  {key:'OFFICE', label:'1. Office', type:'file', accept:'.pdf', desc:'Upload fee-payment proof as PDF'},
  {key:'PLACEMENT', label:'2. Placement', type:'file', accept:'image/*', desc:'Upload placement/training bill (image)'},
  {key:'PTA', label:'3. PTA', type:'file', accept:'image/*', desc:'Upload PTA fee bill (image)'},
  {key:'BUS', label:'4. Bus Maintenance', type:'file', accept:'image/*', desc:'Upload bus fee bill (image)'},
  {key:'LAB', label:'5. Lab', type:'request', desc:'Send request to Lab verifier'},
  {key:'HOSTEL', label:'6. Hostel', type:'file', accept:'image/*', desc:'Upload up to 5 bill images (hosteller only)', hostel:true},
  {key:'LIBRARY', label:'7. Library', type:'request', desc:'Send request to Library verifier'},
  {key:'STAFF_ADVISOR', label:'8. Staff Advisor', type:'request', desc:'Send to Staff Advisor (auto-matched)'},
  {key:'HOD', label:'9. HOD', type:'request', desc:'Send to HOD (auto-matched)'},
  {key:'PRINCIPAL', label:'10. Principal', type:'request', desc:'Send to Principal'},
  {key:'FINAL', label:'11. Final Status', type:'final', desc:'Overall no-due status'},
]

const fmtSize = (bytes) => {
  if(bytes < 1024) return bytes + ' B'
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB'
  return (bytes/1024/1024).toFixed(2) + ' MB'
}

export default function StudentDashboard(){
  const [data,setData]=useState(null)
  const [logs,setLogs]=useState([])
  const [msg,setMsg]=useState('')
  const [selected,setSelected]=useState({}) // {key: File[]}
  const [uploading,setUploading]=useState({}) // {key: bool}
  const [profile,setProfile]=useState(null)
  const location=useLocation()
  const [view,setView]=useState(location.state?.view==='history' ? 'history' : 'dashboard')

  const load=async()=>{
    try{
      const r=await api.get('/submissions/my/')
      setData(r.data)
      const l=await api.get('/submissions/audit/')
      setLogs(l.data)
      try{
        const pr=await api.get('/auth/me/')
        if(pr.data?.profile) setProfile(pr.data.profile)
        else if(pr.data?.name) setProfile(pr.data)
      }catch{}
      try{
        const pp=await api.get('/profile/')
        if(pp.data && pp.data.name) setProfile(pp.data)
      }catch{}
    }catch(e){ setMsg(e.response?.data?.detail || 'Failed to load')}
  }
  useEffect(()=>{load()},[])

  // auto-dismiss feedback messages after few seconds (e.g. 'Upload successful')
  useEffect(()=>{
    if(!msg) return
    const t=setTimeout(()=> setMsg(''), 4000)
    return ()=> clearTimeout(t)
  },[msg])

  const getSection=(k)=>{
    if(!data) return null
    return data.sections.find(s=>s.section===k)
  }

  const onFileSelect=(key, e)=>{
    const files = Array.from(e.target.files || [])
    if(!files.length) return
    // client-side validation preview
    const isHostel = key==='HOSTEL'
    const sec = getSection(key)
    const st = sec?.status
    const existing = sec?.files?.length || 0
    // When status is REJECTED, allow reupload: treat existing as 0 (old files will be replaced)
    const effectiveExisting = (isHostel && st==='REJECTED') ? 0 : existing
    const alreadySelected = (selected[key] || []).length
    if(isHostel && effectiveExisting + alreadySelected + files.length > 5){
      setMsg(`Hostel allows max 5 files. ${st==='REJECTED' ? 'You can select up to 5 files to reupload' : `Already have ${existing}, you selected ${files.length}.`}`)
      e.target.value=''
      return
    }
    if(!isHostel && files.length>1){
      // for single-file sections keep only first
      setSelected(prev=>({...prev, [key]: [files[0]]}))
    } else {
      // hostel: append? replace selection
      // if already selected has some, append up to 5
      // For REJECTED hostel, allow up to 5 new files (old will be replaced on upload)
      setSelected(prev=>{
        const prevFiles = prev[key] || []
        const limit = isHostel ? (st==='REJECTED' ? 5 : 5 - existing) : 5
        const combined = isHostel ? [...prevFiles, ...files].slice(0, limit) : files
        return {...prev, [key]: combined}
      })
    }
    e.target.value=''
    setMsg('')
  }

  const clearSelected=(key)=>{
    setSelected(prev=>{ const c={...prev}; delete c[key]; return c })
  }
  const removeOne=(key, idx)=>{
    setSelected(prev=>{
      const arr=[...(prev[key]||[])]
      arr.splice(idx,1)
      if(!arr.length){ const c={...prev}; delete c[key]; return c }
      return {...prev, [key]: arr}
    })
  }

  const upload=async(key)=>{
    const files = selected[key]
    if(!files || !files.length){
      setMsg('Please choose a file first.')
      return
    }
    // client size check 10MB
    for(let f of files){
      if(f.size > 10*1024*1024){
        setMsg(`${f.name} exceeds 10MB limit (${fmtSize(f.size)}).`)
        return
      }
    }
    setUploading(prev=>({...prev, [key]: true}))
    setMsg('')
    const fd=new FormData()
    for(let f of files) fd.append('file', f)
    try{
      const r=await api.post(`/submissions/upload/${key}/`, fd, {headers:{'Content-Type':'multipart/form-data'}})
      setMsg(r.data.detail + (r.data.assigned_to?` → ${r.data.assigned_to}`:''))
      clearSelected(key)
      load()
    }catch(e){ setMsg(e.response?.data?.detail || JSON.stringify(e.response?.data))}
    setUploading(prev=>({...prev, [key]: false}))
  }

  const sendReq=async(key)=>{
    setMsg('')
    try{
      const r=await api.post(`/submissions/request/${key}/`)
      setMsg(r.data.detail + (r.data.assigned_to?` → ${r.data.assigned_to}`:''))
      load()
    }catch(e){ setMsg(e.response?.data?.detail || JSON.stringify(e.response?.data))}
  }

  const removeFile=async(fileId)=>{
    if(!confirm('Remove this uploaded file? This will also cancel the verification request and remove it from verifier inbox.')) return
    setMsg('')
    try{
      const r=await api.delete(`/submissions/file/${fileId}/`)
      setMsg(r.data.detail)
      load()
    }catch(e){ setMsg(e.response?.data?.detail || 'Remove failed')}
  }

  const undoSection=async(key)=>{
    if(!confirm(`Undo ${key}? This will remove uploaded files / cancel request for this section and allow you to re-submit.`)) return
    setMsg('')
    try{
      const r=await api.post(`/submissions/undo/${key}/`)
      setMsg(r.data.detail)
      load()
    }catch(e){ setMsg(e.response?.data?.detail || JSON.stringify(e.response?.data))}
  }

  if(!data) return <div style={{padding:30}}>{msg || 'Loading...'}</div>

  const statusColor=s=> s==='APPROVED'?'#16a34a': s==='REJECTED'?'#ef4444': s==='NOT_REQUIRED'?'#94a3b8':'#d97706'

  // First 7 sections are independent - no sequential check needed
  const FIRST_SEVEN = ['OFFICE','PLACEMENT','PTA','BUS','LAB','HOSTEL','LIBRARY']
  const isEnabled=(key)=>{
    if(key==='HOSTEL' && !data.hostel_required) return false
    if(key==='FINAL') return false
    const cur=getSection(key)
    if(cur && cur.status==='REJECTED') return true
    if(cur && cur.status==='APPROVED') return false
    if(cur && cur.status==='NOT_REQUIRED') return false
    // First 7: enabled by default (no previous approval required)
    if(FIRST_SEVEN.includes(key)){
      return true
    }
    // For Staff Advisor / HOD / Principal : sequential check
    const order=SECTIONS.filter(s=>s.key!=='FINAL').map(s=>s.key)
    const idx=order.indexOf(key)
    for(let i=0;i<idx;i++){
      const prev=order[i]
      const ss=getSection(prev)
      if(!ss) return false
      if(prev==='HOSTEL' && ss.status==='NOT_REQUIRED') continue
      if(ss.status!=='APPROVED') return false
    }
    return true
  }

  const fileHint=(key)=>{
    if(key==='OFFICE') return 'PDF only • Max 10MB per file'
    if(key==='HOSTEL') return 'Images only (jpg/png/webp) • Max 10MB per file • Up to 5 files total'
    return 'Images only (jpg/png/webp) • Max 10MB per file'
  }

  const SECTION_ORDER_10 = ['OFFICE','PLACEMENT','PTA','BUS','LAB','HOSTEL','LIBRARY','STAFF_ADVISOR','HOD','PRINCIPAL']
  const isAllApproved = data && (
    data.overall==='APPROVED' || SECTION_ORDER_10.every(k=>{
      const s=data.sections.find(x=>x.section===k)
      if(!s) return false
      if(k==='HOSTEL' && s.status==='NOT_REQUIRED') return true
      return s.status==='APPROVED'
    })
  )

  const downloadNoDue = async()=>{
    // ensure fresh correct Student Profile for PDF - robust to 404 and fallback to submission data
    let prof = null
    try{
      const pp=await api.get('/profile/')
      if(pp.data && pp.data.name) prof = pp.data
    }catch(e){ /* ignore 404 */ }
    if(!prof || !prof.name){
      try{
        const pr=await api.get('/auth/me/')
        const p = pr.data?.profile || pr.data
        if(p && p.name) prof = p
        else if(pr.data?.profile) prof = pr.data.profile
      }catch{}
    }
    if(!prof || !prof.name) prof = profile
    // final fallback: build minimal profile from submission data so PDF still generates
    if(!prof || !prof.name){
      prof = {
        name: data?.student_name || data?.student_username || 'Student',
        username: data?.student_username || '-',
        department: data?.sections ? '-' : '-',
        division: '-',
        semester: '-',
        address: '-',
        personal_email: '-',
        personal_phone: '-',
        is_hosteller: !!data?.hostel_required,
      }
      // try to enrich from profile state if partial
      if(profile){
        prof = {...prof, ...profile}
        if(!prof.name) prof.name = data?.student_name || 'Student'
      }
    }
    if(prof) setProfile(prof)
    const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'})
    const pageW = doc.internal.pageSize.getWidth()
    // header
    doc.setFillColor(15,23,42) // slate-900
    doc.rect(0,0,pageW,18,'F')
    doc.setTextColor(255,255,255)
    doc.setFont('helvetica','bold')
    doc.setFontSize(11)
    doc.text('COLLEGE OF ENGINEERING KARUNAGAPALLY(IHRD), KOLLAM', pageW/2, 9, {align:'center'})
    doc.setFontSize(9)
    doc.setFont('helvetica','bold')
    doc.text('NO-DUE FORM', pageW/2, 14, {align:'center'})
    doc.setFontSize(7)
    doc.setFont('helvetica','normal')
    doc.text('No-Due Clearance Certificate', pageW/2, 17, {align:'center'})
    // meta line
    const now = new Date()
    const createdStr = now.toLocaleString()
    doc.setTextColor(40,40,40)
    doc.setFontSize(7.5)
    doc.text(`Generated: ${createdStr}`, pageW-14, 22, {align:'right'})
    doc.text(`Submission #${data?.id || '-'}`, 14, 22)
    doc.setDrawColor(200)
    doc.setLineWidth(0.2)
    doc.line(14,24,pageW-14,24)
    // student profile box
    doc.setFillColor(241,245,249)
    doc.roundedRect(14,26,pageW-28,6,1,1,'F')
    doc.setFont('helvetica','bold')
    doc.setFontSize(9)
    doc.setTextColor(15,23,42)
    doc.text('Student Profile', 16, 30)
    const profRows = [
      ['Name', prof?.name || data?.student_name || data?.student_username || '-'],
      ['Username / Reg No.', data?.student_username || prof?.username || '-'],
      ['Department', prof?.department || '-'],
      ['Division', prof?.division || '-'],
      ['Semester', prof?.semester || '-'],
      ['Year of Admission', prof?.year_of_admission ? String(prof.year_of_admission) : '-'],
      ['Address', prof?.address || '-'],
      ['Email', prof?.personal_email || '-'],
      ['Phone', prof?.personal_phone || '-'],
      ['Hosteller', prof?.is_hosteller ? 'Yes (Hostel Required)' : 'No (Day Scholar)'],
    ]
    autoTable(doc, {
      startY: 32,
      head: [['Field','Details']],
      body: profRows,
      theme: 'grid',
      headStyles: {fillColor:[37,99,235], textColor:255, fontSize:8, halign:'left'},
      bodyStyles: {fontSize:7.5, cellPadding:2},
      columnStyles: {0:{cellWidth:40, fontStyle:'bold', fillColor:[248,250,252]},1:{cellWidth: pageW-68}},
      styles: {overflow:'linebreak', valign:'middle'},
      margin:{left:14,right:14},
      didParseCell: (data)=>{ if(data.section==='body' && data.column.index===1 && data.cell.text.join('').length>80) data.cell.styles.fontSize=6.5 }
    })
    let y = doc.lastAutoTable.finalY + 6
    // approvals title
    doc.setFillColor(37,99,235)
    doc.rect(14, y, pageW-28, 7, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica','bold')
    doc.setFontSize(9)
    doc.text('No-Due Approvals  —  All 10 Sections', 16, y+4.7)
    doc.setFontSize(6.5)
    doc.setFont('helvetica','normal')
    doc.text(`Overall: ${data?.overall || 'PENDING'}`, pageW-16, y+4.7, {align:'right'})
    y+=7
    const approRows = SECTION_ORDER_10.map((k,i)=>{
      const s=data?.sections.find(x=>x.section===k)
      const label = SECTIONS.find(x=>x.key===k)?.label || k
      const status = s?.status || 'PENDING'
      const remark = s?.remark || '-'
      const upd = s?.updated_at ? new Date(s.updated_at).toLocaleDateString() : '-'
      const verifier = s?.verifier ? `ID:${s.verifier}` : '-'
      // try to get verifier name from logs
      const relLogs = logs.filter(l=>l.section===k)
      const lastApprove = relLogs.find(l=>l.to_status==='APPROVED')
      const verifierName = lastApprove?.performed_by_username || verifier
      return [(i+1).toString(), label, status, verifierName, remark, upd]
    })
    autoTable(doc, {
      startY: y,
      head: [['#','Section','Status','Verified By','Remark','Date']],
      body: approRows,
      theme: 'grid',
      headStyles:{fillColor:[15,23,42], textColor:255, fontSize:7, halign:'center'},
      bodyStyles:{fontSize:6.5, halign:'center', cellPadding:1.8},
      columnStyles:{
        0:{cellWidth:8},
        1:{cellWidth:38, halign:'left'},
        2:{cellWidth:22},
        3:{cellWidth:30, halign:'left'},
        4:{cellWidth:45, halign:'left'},
        5:{cellWidth:22},
      },
      styles:{overflow:'linebreak', valign:'middle'},
      margin:{left:14,right:14},
      didParseCell: (data)=>{
        if(data.section==='body' && data.column.index===2){
          const v=data.cell.raw
          if(v==='APPROVED'){ data.cell.styles.fillColor=[220,252,231]; data.cell.styles.textColor=[22,101,52]; data.cell.styles.fontStyle='bold'; }
          else if(v==='REJECTED') {data.cell.styles.fillColor=[254,242,242]; data.cell.styles.textColor=[153,27,27];}
          else if(v==='NOT_REQUIRED') {data.cell.styles.fillColor=[241,245,249]; data.cell.styles.textColor=[100,116,139];}
          else {data.cell.styles.fillColor=[255,251,235];}
        }
      }
    })
    y = doc.lastAutoTable.finalY + 6
    // overall status box
    const isApproved = isAllApproved
    doc.setFillColor(isApproved ? 220 : 255, isApproved?252:243, isApproved?231:199)
    doc.setDrawColor(isApproved?34:180, isApproved?197:83, isApproved?94:9)
    doc.roundedRect(14, y, pageW-28, 12, 2,2,'FD')
    doc.setFont('helvetica','bold')
    doc.setFontSize(9)
    doc.setTextColor(isApproved?22:124, isApproved?101:45, isApproved?52:18)
    doc.text(isApproved ? '✓  NO DUES PENDING — CLEARANCE APPROVED' : '⏳  PENDING APPROVALS', pageW/2, y+7, {align:'center'})
    doc.setFont('helvetica','normal')
    doc.setFontSize(6.5)
    doc.text(isApproved ? 'All 10 sections have been verified and approved.' : 'Complete the remaining sections to be eligible for download.', pageW/2, y+10, {align:'center'})
    y+=16
    // signatures
    doc.setTextColor(30,30,30)
    doc.setFontSize(7)
    doc.setDrawColor(180)
    // line for signatures
    const sigY = y+14
    const colW = (pageW-28)/3
    const sigs = [['Student Signature',''],['HOD',''],['Principal','']]
    sigs.forEach((s,i)=>{
      const x = 14 + i*colW
      doc.line(x+4, sigY, x+colW-4, sigY)
      doc.setFont('helvetica','normal')
      doc.text(s[0], x+colW/2, sigY+4, {align:'center'})
    })
    doc.setFontSize(6)
    doc.setTextColor(100)
    doc.text('This is a system generated No-Due Form. Generated on ' + createdStr, pageW/2, sigY+10, {align:'center'})
    doc.text('College of Engineering Karunagappally (IHRD), Kollam — For official verification contact administration.', pageW/2, sigY+13, {align:'center'})
    // footer page number
    const pageCount = doc.internal.getNumberOfPages()
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i)
      doc.setFontSize(6)
      doc.setTextColor(130)
      doc.text(`Page ${i} of ${pageCount}  |  ${data?.student_username || ''}  |  ${createdStr}`, pageW/2, 290, {align:'center'})
    }
    const fileName = `NoDue_${(data?.student_username||prof?.username||'student')}_${now.toISOString().slice(0,10)}.pdf`
    doc.save(fileName)
    setMsg('No-Due PDF downloaded: ' + fileName)
  }

  return (
    <div className="page student-layout" style={{maxWidth:1200,margin:'5px auto',padding:'5px',display:'flex',gap:5,alignItems:'stretch', flexWrap:'nowrap', flex:1, width:'100%', height:'100%', minHeight:0}}>
      {/* Sidebar — Dashboard + Profile + History/Audit — fills height between header and footer */}
      <aside className="sidebar" style={{width:260, flexShrink:0, position:'sticky', top:5, height:'100%', maxHeight:'100%', background:'linear-gradient(180deg,#0f172a 0%, #1e293b 100%)',borderRadius:16,padding:5,color:'#fff',boxShadow:'0 10px 24px rgba(15,23,42,.16)',border:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',gap:5, overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 6px 10px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'grid',placeItems:'center',fontWeight:800,boxShadow:'0 6px 14px rgba(37,99,235,.28)'}}>🎓</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:800,fontSize:13,letterSpacing:-.01,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{data.student_name || data.student_username}</div>
            <div style={{fontSize:11,opacity:.75,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><span>{profile?.department || '-'}</span>•<span>Year {profile?.year_of_admission || '-'}</span><span style={{width:6,height:6,borderRadius:999,background: isAllApproved?'#22c55e':'#f59e0b',display:'inline-block'}}/></div>
          </div>
        </div>
        <nav style={{display:'flex',flexDirection:'column',gap:6}}>
          <button onClick={()=>setView('dashboard')} style={{display:'flex',alignItems:'center',gap:9, padding:'10px 12px',borderRadius:10,background: view==='dashboard'?'#fff':'rgba(255,255,255,.06)',color: view==='dashboard'?'#0f172a':'#cbd5e1',fontWeight: view==='dashboard'?800:600,fontSize:13,boxShadow: view==='dashboard'?'0 4px 12px rgba(0,0,0,.12)':'none',border:'1px solid '+(view==='dashboard'?'#e2e8f0':'rgba(255,255,255,.08)'),cursor:'pointer',textDecoration:'none'}}>
            <span style={{width:22,height:22,borderRadius:7,background: view==='dashboard'?'#eff6ff':'rgba(255,255,255,.08)',border:'1px solid '+(view==='dashboard'?'#bfdbfe':'rgba(255,255,255,.08)'),display:'grid',placeItems:'center',fontSize:12}}>📊</span> Dashboard
            {view==='dashboard' && <span style={{marginLeft:'auto',fontSize:10,background:'#16a34a',color:'#fff',padding:'2px 6px',borderRadius:999}}>active</span>}
          </button>
          <Link to="/profile" style={{display:'flex',alignItems:'center',gap:9, padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,.06)',color:'#cbd5e1',fontWeight:600,fontSize:13,border:'1px solid rgba(255,255,255,.08)',textDecoration:'none'}}>
            <span style={{width:22,height:22,borderRadius:7,background:'rgba(255,255,255,.08)',display:'grid',placeItems:'center',fontSize:12}}>👤</span> Profile
            <span style={{marginLeft:'auto',opacity:.6, fontSize:12}}>→</span>
          </Link>
          <button onClick={()=>setView('history')} style={{display:'flex',alignItems:'center',gap:9, padding:'10px 12px',borderRadius:10,background: view==='history'?'#fff':'rgba(255,255,255,.06)',color: view==='history'?'#0f172a':'#cbd5e1',fontWeight: view==='history'?800:600,fontSize:13,boxShadow: view==='history'?'0 4px 12px rgba(0,0,0,.12)':'none',border:'1px solid '+(view==='history'?'#e2e8f0':'rgba(255,255,255,.08)'),cursor:'pointer',textDecoration:'none'}}>
            <span style={{width:22,height:22,borderRadius:7,background:'rgba(255,255,255,.08)',display:'grid',placeItems:'center',fontSize:12}}>🕘</span> History
            <span style={{marginLeft:'auto',opacity:.6, fontSize:12}}>{view==='history' ? '•' : '→'}</span>
          </button>
        </nav>
        <div style={{fontSize:10,opacity:.6,textAlign:'center',paddingTop:4,borderTop:'1px solid rgba(255,255,255,.06)'}}>CEK IHRD • No-Due Portal</div>
      </aside>

      <main style={{flex:'1 1 560px', minWidth:0, display:'flex', flexDirection:'column', gap:18, height:'100%', minHeight:0, overflowY:'auto'}}>
        {/* Section 1: Student No-Due Form */}
        {view==='dashboard' && (
        <section style={{display:'flex', flexDirection:'column', gap:5}}>
        <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#4338ca 100%)',borderRadius:16,padding:'10px 12px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,boxShadow:'0 10px 24px rgba(15,23,42,.18)',border:'1px solid rgba(255,255,255,.08)'}}>
          <div>
            <h2 style={{margin:0,letterSpacing:-.02,display:'flex',alignItems:'center',gap:9, fontSize:18}}><span style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,.14)',border:'1px solid rgba(255,255,255,.18)',display:'grid',placeItems:'center'}}>🎓</span> Student No-Due Form</h2>
            <div style={{fontSize:12,opacity:.82,marginTop:2}}>Track 11 sections • Hostel aware • Reupload on reject • PDF when approved</div>
          </div>
          <div style={{fontSize:11,background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.14)',padding:'6px 10px',borderRadius:999,display:'flex',gap:8,alignItems:'center'}}>
            <span style={{width:7,height:7,borderRadius:999,background: isAllApproved?'#22c55e':'#f59e0b',boxShadow:isAllApproved?'0 0 0 4px rgba(34,197,94,.22)':'0 0 0 4px rgba(245,158,11,.22)'}}/>
            {data.student_name || data.student_username} • {profile?.department || '-'} • Year {profile?.year_of_admission || '-'}
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {data.sections.map(s=>{
            const overallColor=statusColor(s.status)
            return <span key={s.section} style={{padding:'4px 8px',borderRadius:20,background:overallColor,color:'#fff',fontSize:11}}>{s.section}: {s.status}</span>
          })}
          <span style={{padding:'4px 8px',borderRadius:20,background: data.overall==='APPROVED'?'#16a34a':'#3b82f6',color:'#fff',fontSize:11}}>OVERALL: {data.overall}</span>
        </div>
        {msg && <div style={{background:'#fef3c7',padding:8,borderRadius:8,fontSize:13}}>{msg}</div>}

        <div style={{display:'grid',gap:5,gridTemplateColumns:'1fr',alignItems:'stretch'}}>
          {SECTIONS.map(sec=>{
            if(sec.type==='final'){
              return <div key={sec.key} style={{...card, border: isAllApproved ? '2px solid #16a34a' : '1px solid #e2e8f0', gridColumn:'1 / -1', minHeight:120}}>
                <h3 style={{margin:0}}>{sec.label}</h3>
                <p style={{fontSize:13,color:'#64748b'}}>{isAllApproved ? '✅ All clear — No dues pending! Your No-Due is ready to download.' : '⏳ Pending approvals. Complete sequential steps.'}</p>
                <div style={{fontWeight:700,color: statusColor(isAllApproved?'APPROVED':'PENDING'), marginBottom: isAllApproved?10:0}}>{isAllApproved ? 'APPROVED' : data.overall}</div>
                {isAllApproved ? (
                  <button onClick={downloadNoDue} style={{...btn, background:'linear-gradient(135deg,#16a34a,#15803d)', padding:'10px 18px', fontSize:13, boxShadow:'0 4px 10px rgba(22,163,74,0.3)', cursor:'pointer'}}>
                    📄 Download No-Due PDF
                  </button>
                ) : (
                  <div style={{fontSize:11,color:'#94a3b8', background:'#f8fafc', padding:'6px 10px', borderRadius:6, border:'1px dashed #e2e8f0'}}>
                    Complete all 10 sections (APPROVED / NOT_REQUIRED) to unlock download. {SECTION_ORDER_10.filter(k=>{const s=data.sections.find(x=>x.section===k); return !s || !(s.status==='APPROVED' || (k==='HOSTEL' && s.status==='NOT_REQUIRED'))}).length} pending
                  </div>
                )}
                {isAllApproved && <div style={{fontSize:11,color:'#16a34a',marginTop:8}}>Includes profile + all approvals • Generated on {new Date().toLocaleString()}</div>}
              </div>
            }
          const ss=getSection(sec.key)
          const enabled=isEnabled(sec.key)
          const st=ss?.status || 'PENDING'
          const selFiles = selected[sec.key] || []
          const isUploading = !!uploading[sec.key]
          const existingCount = ss?.files?.length || 0
          return (
            <div key={sec.key} style={{...card, opacity: sec.hostel && !data.hostel_required ? .45 : 1, display:'flex', flexDirection:'column', minHeight:165, height:'100%'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                <div style={{flex:1}}>
                  <h3 style={{margin:0}}>{sec.label} <span style={{fontSize:12,background:statusColor(st),color:'#fff',padding:'2px 6px',borderRadius:10,marginLeft:6}}>{st}</span></h3>
                  <p style={{margin:'4px 0',fontSize:12,color:'#64748b'}}>{sec.desc}</p>
                  {sec.type==='file' && <p style={{margin:'2px 0',fontSize:11,color:'#2563eb',fontWeight:600}}>↳ {fileHint(sec.key)}</p>}
                  {ss?.remark && <p style={{fontSize:12,color:'#ef4444'}}>Remark: {ss.remark}</p>}
                  {ss?.files?.length>0 && <div style={{fontSize:12,marginTop:6, display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>Uploaded: {ss.files.map(f=> (
                    <span key={f.id} style={{display:'inline-flex',alignItems:'center',gap:4,background:'#f1f5f9',padding:'2px 6px',borderRadius:6,border:'1px solid #e2e8f0'}}>
                      <a href={f.file} target="_blank" rel="noreferrer" style={{color:'#2563eb',textDecoration:'underline'}}>{f.original_name} ({fmtSize(f.size)})</a>
                      {st!=='APPROVED' && st!=='NOT_REQUIRED' && st!=='REJECTED' && <button onClick={()=>removeFile(f.id)} style={{background:'#fee2e2',color:'#b91c1c',border:'1px solid #fecaca',padding:'1px 5px',borderRadius:4,cursor:'pointer',fontSize:10}} title="Remove this file and cancel verification">✕ Remove</button>}
                    </span>
                  ))}{sec.key==='HOSTEL' && <span style={{color:'#64748b'}}> ({existingCount}/5)</span>}
                    {ss.files.length>0 && st!=='APPROVED' && st!=='NOT_REQUIRED' && st!=='REJECTED' && <button onClick={()=>undoSection(sec.key)} style={{background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa',padding:'2px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>Undo Section</button>}
                  </div>}
                  {/* Selected files preview */}
                  {sec.type==='file' && selFiles.length>0 && (
                    <div style={{marginTop:8, background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:8}}>
                      <div style={{fontSize:12,fontWeight:600,color:'#334155',marginBottom:4}}>Selected to upload:</div>
                      {selFiles.map((f,idx)=>(
                        <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,padding:'4px 0',borderBottom: idx < selFiles.length-1 ? '1px solid #e2e8f0':'none'}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:220}}>{f.name}</span>
                          <span style={{display:'flex',gap:8,alignItems:'center'}}>
                            <span style={{color: f.size>10*1024*1024 ? '#ef4444':'#64748b', fontWeight: f.size>10*1024*1024 ? 700:400}}>{fmtSize(f.size)}{f.size>10*1024*1024 && ' — exceeds 10MB'}</span>
                            <button onClick={()=>removeOne(sec.key, idx)} style={{background:'#fee2e2',color:'#ef4444',border:'1px solid #fecaca',padding:'2px 6px',borderRadius:4,cursor:'pointer',fontSize:11}}>✕</button>
                          </span>
                        </div>
                      ))}
                      <div style={{fontSize:11,color:'#64748b',marginTop:4}}>Total: {selFiles.length} file(s) • {fmtSize(selFiles.reduce((a,b)=>a+b.size,0))}</div>
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end',minWidth:140}}>
                  {sec.type==='file' ? (
                    <>
                      <label style={{...btn, background: (enabled || st==='REJECTED')? '#f1f5f9':'#e2e8f0', color: (enabled || st==='REJECTED')? '#334155':'#94a3b8', border:'1px solid #cbd5e1', cursor: (enabled || st==='REJECTED')?'pointer':'not-allowed', textAlign:'center'}}>
                        Choose File
                        <input type="file" multiple={sec.key==='HOSTEL'} accept={sec.accept} style={{display:'none'}} disabled={!(enabled || st==='REJECTED')} onChange={e=>onFileSelect(sec.key, e)}/>
                      </label>
                      {/* Show size limit badge */}
                      <span style={{fontSize:10,color:'#64748b',background:'#f1f5f9',padding:'2px 6px',borderRadius:10}}>Limit: 10MB</span>
                      <div style={{display:'flex',gap:6}}>
                        {st==='REJECTED' ? (
                          <button onClick={()=>upload(sec.key)} disabled={selFiles.length===0 || isUploading} style={{...btn, background: selFiles.length===0 ? '#94a3b8' : '#dc2626', opacity: isUploading?0.7:1, cursor: selFiles.length===0?'not-allowed':'pointer'}}>
                            {isUploading ? 'Reuploading...' : 'Reupload'}
                          </button>
                        ) : (
                          <button onClick={()=>upload(sec.key)} disabled={!enabled || selFiles.length===0 || isUploading} style={{...btn, background: (!enabled || selFiles.length===0) ? '#94a3b8' : '#2563eb', opacity: isUploading?0.7:1, cursor: (!enabled || selFiles.length===0)?'not-allowed':'pointer'}}>
                            {isUploading ? 'Uploading...' : 'Upload'}
                          </button>
                        )}
                        {selFiles.length>0 && <button onClick={()=>clearSelected(sec.key)} disabled={isUploading} style={{...btn, background:'#64748b'}}>Clear</button>}
                      </div>
                      {st==='REJECTED' ? (
                        selFiles.length===0 ? <span style={{fontSize:11,color:'#ef4444'}}>Rejected — select file to reupload</span> : <span style={{fontSize:11,color:'#dc2626'}}>Ready to reupload</span>
                      ) : (
                        selFiles.length===0 && enabled && <span style={{fontSize:11,color:'#94a3b8'}}>Select file then click Upload</span>
                      )}
                    </>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>
                      {st==='PENDING' && ss?.has_request ? (
                        <>
                          <span style={{fontSize:11,color:'#d97706',background:'#fffbeb',padding:'2px 6px',borderRadius:6,border:'1px solid #fde68a'}}>Request sent — awaiting verification</span>
                          <button onClick={()=>undoSection(sec.key)} style={{...btn, background:'#ef4444'}}>Cancel Request / Undo</button>
                        </>
                      ) : st==='REJECTED' ? (
                        <>
                          <span style={{fontSize:11,color:'#ef4444'}}>Rejected — you can resend</span>
                          <button onClick={()=>sendReq(sec.key)} disabled={!enabled} style={{...btn, background: enabled?'#16a34a':'#94a3b8'}}>Resend Request</button>
                          <button onClick={()=>undoSection(sec.key)} style={{...btn, background:'#64748b',padding:'6px 10px',fontSize:11}}>Undo</button>
                        </>
                      ) : (
                        <button onClick={()=>sendReq(sec.key)} disabled={!enabled} style={{...btn, background: enabled?'#16a34a':'#94a3b8', cursor: enabled?'pointer':'not-allowed'}}>Send Request</button>
                      )}
                      {st!=='APPROVED' && st!=='NOT_REQUIRED' && st!=='REJECTED' && ss?.has_request && st!=='PENDING' && <button onClick={()=>undoSection(sec.key)} style={{...btn, background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa',padding:'4px 8px',fontSize:11}}>Undo</button>}
                    </div>
                  )}
                </div>
              </div>
              {!enabled && st!=='APPROVED' && st!=='NOT_REQUIRED' && <p style={{fontSize:11,color:'#ef4444',marginTop:6}}>{sec.hostel && !data.hostel_required ? 'Not required for day scholars' : 'Complete previous sections first or already processed'}</p>}
            </div>
          )
        })}
        </div>
        </section>
        )}

        {/* Section 3: History / Audit */}
        {view==='history' && (
        <section style={{background:'#fff',borderRadius:16,boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)',border:'1px solid #e2e8f0',padding:16}}>
        <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:6,marginBottom:10,color:'#0f172a'}}><span>🕘</span> History / Audit <span style={{marginLeft:'auto',fontSize:11,background:'#f1f5f9',border:'1px solid #e2e8f0',padding:'2px 8px',borderRadius:999}}>{logs.length}</span></div>
        <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:360, overflowY:'auto', paddingRight:4}}>
          {logs.length===0 ? <p style={{fontSize:13,color:'#94a3b8',background:'#f8fafc',padding:12,borderRadius:8,textAlign:'center'}}>No activity yet</p> : logs.slice(0,30).map(l=>(
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
      </main>
    </div>
  )
}
const card={background:'#fff',padding:16,borderRadius:16,boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)',border:'1px solid #e2e8f0'}
const btn={color:'#fff',padding:'9px 14px',borderRadius:10,border:'none',fontSize:13,display:'inline-block',fontWeight:700,boxShadow:'0 4px 12px rgba(15,23,42,.08)',cursor:'pointer',letterSpacing:.01}
