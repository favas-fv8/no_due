import { useEffect, useState } from 'react'
import api from '../utils/api'
import { useAuth } from '../utils/auth'

export default function AdminDashboard(){
  const {user: currentUser} = useAuth()
  const [users,setUsers]=useState([])
  const [form,setForm]=useState({username:'',password:'',role:'STUDENT'})
  const [msg,setMsg]=useState('')
  const [filter,setFilter]=useState('')
  const [roleFilter,setRoleFilter]=useState('ALL')
  const [edits,setEdits]=useState({}) // {id: {role,email,is_active_user}}
  const [saveStatus,setSaveStatus]=useState({}) // {id: 'saved'|'error'|''}
  const [reveal,setReveal]=useState(null) // {username, password, hashed_preview, note}
  const [revealingId,setRevealingId]=useState(null)

  const loadUsers=async()=>{
    const r=await api.get('/admin/users/')
    setUsers(r.data)
    const map={}
    r.data.forEach(u=>{
      map[u.id]={role:u.role, is_active: u.is_active, is_active_user: u.is_active_user}
    })
    setEdits(map)
  }
  useEffect(()=>{loadUsers()},[])

  const createUser=async e=>{
    e.preventDefault(); setMsg('')
    try{
      await api.post('/admin/users/', form)
      setMsg('✓ User created successfully'); setForm({username:'',password:'',role:'STUDENT'}); loadUsers()
      setTimeout(()=>setMsg(''), 3000)
    }catch(ex){ setMsg(JSON.stringify(ex.response?.data))}
  }
  const resetPw=async(id)=>{
    const np=prompt('New password (min 4 chars):')
    if(!np) return
    try{
      const r=await api.post(`/admin/users/${id}/reset-password/`, {new_password:np})
      setMsg(r.data.detail || 'Password reset & reactivated')
      // show new password immediately for admin to copy
      setReveal({username: users.find(u=>u.id===id)?.username||'', password: r.data.new_password || np, hashed_preview: '', note: 'New password set — copy now. Stored for View.'})
      loadUsers()
      setTimeout(()=>setMsg(''), 3000)
    }catch(ex){ alert(ex.response?.data?.detail || JSON.stringify(ex.response?.data)) }
  }
  const viewPassword=async(id)=>{
    setRevealingId(id)
    try{
      const r=await api.get(`/admin/users/${id}/password/`)
      setReveal(r.data)
    }catch(ex){
      const detail=ex.response?.data?.detail || JSON.stringify(ex.response?.data)
      setReveal({username: users.find(u=>u.id===id)?.username||'', password: null, note: detail})
    }finally{ setRevealingId(null)}
  }
  const handleEdit=(id,field,val)=>{
    setEdits(prev=>({...prev, [id]: {...prev[id], [field]: val}}))
    setSaveStatus(prev=>({...prev, [id]:''}))
  }
  const handleSave=async(u)=>{
    const e=edits[u.id]
    if(!e) return
    // protect admin: force active true
    const isAdmin = u.role==='ADMIN' || u.username==='admin'
    const payload={}
    // only send changed fields but send all for simplicity
    if(e.role !== u.role) payload.role = e.role
    // active handling: admins cannot be deactivated
    if(!isAdmin){
      if(typeof e.is_active_user !== 'undefined' && e.is_active_user !== u.is_active_user){
        payload.is_active_user = e.is_active_user
        payload.is_active = e.is_active_user
      }
    } else {
      // ensure admin stays active, ignore deactivate attempt
      if(e.is_active_user === false){
        setSaveStatus(prev=>({...prev, [u.id]:'error'}))
        setMsg('Cannot deactivate admin account. Admin must remain active.')
        setTimeout(()=>setMsg(''), 3000)
        // reset edit
        setEdits(prev=>({...prev, [u.id]: {...prev[u.id], is_active_user:true, is_active:true}}))
        return
      }
    }
    if(Object.keys(payload).length===0){
      setSaveStatus(prev=>({...prev, [u.id]:'nochange'}))
      setTimeout(()=>setSaveStatus(prev=>({...prev, [u.id]:''})), 1500)
      return
    }
    try{
      const r=await api.put(`/admin/users/${u.id}/`, payload)
      setSaveStatus(prev=>({...prev, [u.id]:'saved'}))
      setMsg(`✓ Saved: ${u.username} updated successfully`)
      loadUsers()
      setTimeout(()=>{setSaveStatus(prev=>({...prev, [u.id]:''})); setMsg('')}, 2500)
    }catch(ex){
      const detail=ex.response?.data?.detail || JSON.stringify(ex.response?.data)
      setSaveStatus(prev=>({...prev, [u.id]:'error'}))
      setMsg(`Save failed for ${u.username}: ${detail}`)
      setTimeout(()=>setMsg(''), 4000)
    }
  }
  const handleDelete=async(u)=>{
    if(u.role==='ADMIN' || u.username==='admin'){
      alert('Cannot delete admin account. Admin must remain active.')
      return
    }
    if(u.id===currentUser?.id){
      alert('Cannot delete your own account while logged in.')
      return
    }
    if(!confirm(`Delete user '${u.username}' (${u.role}) permanently? This will remove their profile and cannot be undone.`)) return
    try{
      const r=await api.delete(`/admin/users/${u.id}/`)
      setMsg(r.data.detail || `Deleted ${u.username}`)
      loadUsers()
      setTimeout(()=>setMsg(''), 2500)
    }catch(ex){
      const detail=ex.response?.data?.detail || JSON.stringify(ex.response?.data)
      setMsg(`Delete failed: ${detail}`)
    }
  }
  const isAdminUser=(u)=> u.role==='ADMIN' || u.username==='admin'

  const filtered = users.filter(u =>
    (roleFilter==='ALL' || u.role===roleFilter) &&
    (!filter || u.username.toLowerCase().includes(filter.toLowerCase()))
  )

  return (
    <div className="page" style={{maxWidth:1200,margin:'5px auto',padding:'5px',flex:1,minHeight:0}}>
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#4338ca 100%)',borderRadius:16,padding:'12px 14px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,boxShadow:'0 10px 24px rgba(15,23,42,.18)',border:'1px solid rgba(255,255,255,.08)',marginBottom:5}}>
        <div>
          <h2 style={{margin:0,letterSpacing:-.02,display:'flex',alignItems:'center',gap:10}}><span style={{width:32,height:32,borderRadius:9,background:'rgba(255,255,255,.14)',border:'1px solid rgba(255,255,255,.18)',display:'grid',placeItems:'center'}}>⚙️</span> Admin Dashboard</h2>
        </div>
        <div style={{fontSize:11,background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.14)',padding:'6px 10px',borderRadius:999}}>🔒 {currentUser?.username} • ADMIN</div>
      </div>
      {msg && <div style={{background: msg.startsWith('✓')?'#dcfce7':'#fef3c7',border:`1px solid ${msg.startsWith('✓')?'#86efac':'#fde68a'}`,padding:10,borderRadius:8,marginBottom:5,fontSize:13}}>{msg}</div>}
      {reveal && (
        <div style={{background:'#eef2ff',border:'1px solid #c7d2fe',padding:12,borderRadius:10,marginBottom:5,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div style={{fontSize:13}}>
            <b>Password View — {reveal.username} ({reveal.role || ''})</b>
            <div style={{marginTop:6, display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              {reveal.password ? (
                <>
                  <code style={{background:'#fff',padding:'6px 10px',borderRadius:6,border:'1px solid #c7d2fe',fontSize:14,letterSpacing:0.5}}>{reveal.password}</code>
                  <button onClick={()=>{navigator.clipboard.writeText(reveal.password); setMsg('✓ Copied password to clipboard'); setTimeout(()=>setMsg(''),1500)}} style={{...sBtn, background:'#6366f1'}}>Copy</button>
                </>
              ) : (
                <span style={{color:'#ef4444'}}>No plain password stored</span>
              )}
              {reveal.hashed_preview && <span style={{fontSize:11,color:'#64748b',marginLeft:8}}>hash: {reveal.hashed_preview}</span>}
            </div>
            <div style={{fontSize:11,color:'#475569',marginTop:6}}>{reveal.note}</div>
          </div>
          <button onClick={()=>setReveal(null)} style={{...sBtn, background:'#64748b'}}>Close</button>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:5}}>
          <div style={card}>
            <h3>Create User</h3>
            <form onSubmit={createUser} style={{display:'flex',flexDirection:'column',gap:8}}>
              <input placeholder="Username/ID" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} style={inp} required/>
              <input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={inp} required/>
              <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={inp}>
                <option>STUDENT</option><option>VERIFIER</option><option>STAFF_ADVISOR</option><option>HOD</option><option>PRINCIPAL</option><option>ADMIN</option>
              </select>
              <button type="submit" style={{background:'#2563eb',color:'#fff',border:'none',padding:8,borderRadius:8,cursor:'pointer'}}>Create</button>
            </form>
            <div style={{marginTop:14,fontSize:11,color:'#64748b',background:'#f8fafc',padding:8,borderRadius:6}}>
              <b>Note:</b> Admin account (<code>admin</code>) is protected — cannot be deactivated or deleted and always stays active.
            </div>
          </div>
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
              <h3 style={{margin:0}}>All Users ({filtered.length})</h3>
              <input placeholder="search username..." value={filter} onChange={e=>setFilter(e.target.value)} style={{...inp,padding:'6px 8px',maxWidth:160}}/>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
              {['ALL','STUDENT','VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL'].map(r=> (
                <button key={r} onClick={()=>setRoleFilter(r)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(roleFilter===r?'#1e293b':'#e2e8f0'),background: roleFilter===r?'#0f172a':'#fff',color: roleFilter===r?'#fff':'#334155',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                  {roleLabels[r]}
                </button>
              ))}
            </div>
            <div style={{maxHeight:580,overflowY:'auto',overflowX:'auto'}}>
              <table style={{width:'100%',fontSize:12,borderCollapse:'collapse',minWidth:720}}>
                <thead><tr style={{textAlign:'left',borderBottom:'2px solid #e2e8f0',background:'#f8fafc'}}><th style={th}>Username</th><th style={th}>Role</th><th style={th}>Active</th><th style={th}>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(u=>{
                    const e=edits[u.id]||{}
                    const isAdmin=isAdminUser(u)
                    const status=saveStatus[u.id]
                    return (
                    <tr key={u.id} style={{borderBottom:'1px solid #f1f5f9', background: isAdmin?'#fffbeb':'#fff'}}>
                      <td style={td}><b>{u.username}</b>{isAdmin && <span style={{marginLeft:6,background:'#fef3c7',color:'#92400e',padding:'1px 6px',borderRadius:10,fontSize:10,border:'1px solid #fde68a'}}>ADMIN PROTECTED</span>}{u.id===currentUser?.id && <span style={{marginLeft:4,background:'#e0f2fe',padding:'1px 6px',borderRadius:10,fontSize:10}}>YOU</span>}</td>
                      <td style={td}>
                        <select value={e.role||u.role} onChange={ev=>handleEdit(u.id,'role',ev.target.value)} style={{...inp,padding:'4px 6px',fontSize:11, minWidth:130}} disabled={u.username==='admin'}>
                          <option>STUDENT</option><option>VERIFIER</option><option>STAFF_ADVISOR</option><option>HOD</option><option>PRINCIPAL</option><option>ADMIN</option>
                        </select>
                      </td>
                      <td style={td}>
                        {isAdmin ? <span style={{color:'#16a34a',fontWeight:600,fontSize:11}}>Always Active ✓</span> : (
                          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11}}>
                            <input type="checkbox" checked={!!e.is_active_user} onChange={ev=>handleEdit(u.id,'is_active_user',ev.target.checked)} />
                            {e.is_active_user ? 'Active' : 'Inactive'}
                          </label>
                        )}
                      </td>
                      <td style={{...td, display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                        <button onClick={()=>handleSave(u)} style={{...sBtn, background: status==='saved' ? '#16a34a' : status==='error' ? '#ef4444' : '#2563eb'}} title="Save changes">
                          {status==='saved' ? '✓ Saved' : status==='error' ? 'Error' : status==='nochange' ? 'No change' : 'Save'}
                        </button>
                        <button onClick={()=>viewPassword(u.id)} disabled={revealingId===u.id} style={{...sBtn, background: revealingId===u.id?'#94a3b8':'#7c3aed'}} title="View current password (demo-only)">
                          {revealingId===u.id ? '...' : 'View PW'}
                        </button>
                        <button onClick={()=>resetPw(u.id)} style={{...sBtn, background:'#0ea5e9'}}>Reset PW</button>
                        {!isAdmin && u.id!==currentUser?.id ? (
                          <button onClick={()=>handleDelete(u)} style={{...sBtn, background:'#ef4444'}}>Delete</button>
                        ) : (
                          <button disabled style={{...sBtn, background:'#e2e8f0', color:'#94a3b8', cursor:'not-allowed'}} title={isAdmin? 'Admin cannot be deleted':'Cannot delete self'}>Delete</button>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{fontSize:11,color:'#64748b',marginTop:8}}>Edit Role/Active then click <b>Save</b> to persist. Save shows <span style={{color:'#16a34a'}}>✓ Saved</span> on success. Delete permanently removes user (hard delete) after confirmation. Admin protected.</p>
          </div>
        </div>

    </div>
  )
}
const card={background:'#fff',padding:16,borderRadius:16,boxShadow:'0 8px 20px rgba(15,23,42,.06), 0 2px 8px rgba(15,23,42,.04)',border:'1px solid #e2e8f0'}
const inp={padding:'9px 11px',border:'1px solid #e2e8f0',borderRadius:10,background:'#fff',fontSize:13,boxShadow:'0 1px 0 rgba(15,23,42,.02)'}
const th={padding:'8px 10px',fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:.05,fontWeight:700,background:'#f8fafc',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}
const td={padding:'7px 10px',verticalAlign:'middle',borderBottom:'1px solid #f1f5f9'}
const sBtn={color:'#fff',border:'none',padding:'7px 10px',borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:700,boxShadow:'0 4px 10px rgba(15,23,42,.08)',letterSpacing:.01}
const roleLabels={ALL:'All',STUDENT:'Student',VERIFIER:'Verifier',STAFF_ADVISOR:'Staff Advisor',HOD:'HOD',PRINCIPAL:'Principal'}
