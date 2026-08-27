import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './utils/auth'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Profile from './pages/Profile'
import StudentDashboard from './pages/StudentDashboard'
import VerifierDashboard from './pages/VerifierDashboard'
import AdminDashboard from './pages/AdminDashboard'

function Home(){
  const nav=useNavigate()
  const sectionStyle={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,boxShadow:'0 8px 20px rgba(15,23,42,.06),0 2px 8px rgba(15,23,42,.04)',padding:'18px 18px'}
  const roles=[
    {t:'Student', icon:'🎓', c:'#eff6ff', b:'#bfdbfe', d:'Submit fee proofs or requests for each clearance section, track live status, reupload on rejection and download the official No-Due certificate once fully cleared.'},
    {t:'Verifier', icon:'🧑‍💼', c:'#ecfdf5', b:'#a7f3d0', d:'Section verifiers (Office, Placement, PTA, Bus, Lab, Library, Hostel) review submissions from a filtered inbox and approve or reject with remarks.'},
    {t:'Staff Advisor', icon:'👨‍🏫', c:'#faf5ff', b:'#e9d5ff', d:'Reviews clearance after the student’s department-level sections are approved, before it moves to the HOD.'},
    {t:'HOD', icon:'🏛️', c:'#fff7ed', b:'#fed7aa', d:'Provides the department head’s approval as part of the sequential sign-off chain.'},
    {t:'Principal', icon:'🏢', c:'#f0f9ff', b:'#bae6fd', d:'Grants the final institutional clearance once every preceding section is approved.'},
    {t:'Admin', icon:'⚙️', c:'#fef3c7', b:'#fde68a', d:'Creates users, assigns verifier types, manages submissions and monitors the complete audit trail.'},
  ]
  const rules=[
    'The clearance covers 11 sections — 10 verification sections plus one Final Status summary.',
    'Sections 1–7 (Office, Placement, PTA, Bus Maintenance, Lab, Hostel, Library) are independent and may be submitted in any order.',
    'Sections 8–10 (Staff Advisor, HOD, Principal) follow a strict sequence: each unlocks only after the previous ones are Approved.',
    'Office requires a PDF proof (max 10 MB). Other file sections accept images (max 10 MB); Hostel allows up to 5 images and applies to hostellers only — day scholars are marked Not Required.',
    'On rejection, the student may reupload a corrected proof or resend the request; the verifier inbox updates automatically.',
    'A student may undo or cancel a submission before approval to edit and resubmit it.',
    'Overall clearance is granted only when all 10 sections are Approved or marked Not Required.',
    'Once fully cleared, the student can generate and download the official, system-generated No-Due PDF certificate.',
  ]
  return (
    <div className="page" style={{maxWidth:1080,margin:'5px auto',padding:'5px',flex:1,minHeight:0,display:'flex',flexDirection:'column',gap:5}}>
      <button onClick={()=> window.history.length>1 ? nav(-1) : nav('/login')} style={{alignSelf:'flex-start',background:'#fff',color:'#0f172a',border:'1px solid #e2e8f0',padding:'7px 13px',borderRadius:10,fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:'0 4px 12px rgba(15,23,42,.08)',display:'inline-flex',alignItems:'center',gap:6}}>← Back</button>
      <section style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#4338ca 100%)',borderRadius:18,padding:'30px 22px',color:'#fff',position:'relative',overflow:'hidden',boxShadow:'0 16px 36px rgba(15,23,42,.18)',border:'1px solid rgba(255,255,255,.08)'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(600px 220px at 15% 0%, rgba(255,255,255,.14), transparent 60%), radial-gradient(500px 200px at 90% 20%, rgba(255,255,255,.10), transparent 60%)'}}/>
        <div style={{position:'relative',textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.14)',padding:'5px 10px',borderRadius:999,fontSize:11,fontWeight:700,letterSpacing:.04}}>🎓 CEK • IHRD • KOLLAM</div>
          <h1 style={{margin:'14px 0 0',fontSize:32,letterSpacing:-.03,lineHeight:1.1}}>No-Due Clearance Portal</h1>
          <p style={{margin:'10px auto 0',maxWidth:640,color:'#c7d2fe',fontSize:14,lineHeight:1.6}}>The official digital clearance system of the College of Engineering Karunagappally — a single, transparent place for students and staff to manage every no-due approval end to end.</p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{margin:'0 0 8px',fontSize:18}}>What is this website?</h2>
        <p style={{margin:0,fontSize:14,color:'#334155',lineHeight:1.7}}>The No-Due Portal replaces the traditional paper-based clearance process with a secure, online workflow. Instead of carrying a physical form from office to office, a student submits proofs and requests through one dashboard, every verifier acts from a shared inbox, and the system maintains a complete audit history. When all required approvals are complete, the portal issues a downloadable, system-generated No-Due certificate.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{margin:'0 0 8px',fontSize:18}}>About the College</h2>
        <p style={{margin:0,fontSize:14,color:'#334155',lineHeight:1.7}}>The College of Engineering Karunagappally (CEK) is an engineering institution under the Institute of Human Resources Development (IHRD), Government of Kerala, situated in Kollam. As a premier technical campus, the college requires every outgoing and transitioning student to obtain a No-Due clearance across academic, administrative and amenities sections — a process now streamlined through this portal.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{margin:'0 0 12px',fontSize:18}}>Who uses it — Roles</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}>
          {roles.map(r=> (
            <div key={r.t} style={{background:r.c,border:`1px solid ${r.b}`,borderRadius:14,padding:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:800,fontSize:14,color:'#0f172a'}}><span style={{fontSize:18}}>{r.icon}</span>{r.t}</div>
              <div style={{fontSize:12.5,color:'#334155',marginTop:6,lineHeight:1.55}}>{r.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{margin:'0 0 12px',fontSize:18}}>No-Due Submission &amp; Approvals — Rules &amp; Regulations</h2>
        <ol style={{margin:0,paddingLeft:20,display:'flex',flexDirection:'column',gap:8}}>
          {rules.map((r,i)=> <li key={i} style={{fontSize:13.5,color:'#334155',lineHeight:1.6}}>{r}</li>)}
        </ol>
      </section>

      <div style={{fontSize:12,color:'#64748b',textAlign:'center',padding:'4px 0 2px'}}>College of Engineering Karunagappally (IHRD), Kollam — For official verification, contact the administration.</div>
    </div>
  )
}

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <Navbar/>
          <main style={{flex:1, display:'flex', flexDirection:'column', minHeight:0, width:'100%', overflowY:'auto'}}>
            <Routes>
              <Route path="/" element={<Home/>}/>
              <Route path="/login" element={<Login/>}/>
              <Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>}/>
              <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard/></ProtectedRoute>}/>
              <Route path="/verifier" element={<ProtectedRoute roles={['VERIFIER','STAFF_ADVISOR','HOD','PRINCIPAL']}><VerifierDashboard/></ProtectedRoute>}/>
              <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard/></ProtectedRoute>}/>
              <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>
          </main>
          <Footer/>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
