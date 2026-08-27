import { Link } from 'react-router-dom'

export default function Footer(){
  return (
    <footer style={{
      background:'linear-gradient(135deg,#0f172a 0%, #1e293b 60%, #1e3a5f 100%)',
      color:'#cbd5e1',
      borderTop:'1px solid rgba(255,255,255,.08)',
      marginTop:'auto',
      padding:'8px 14px',
      fontSize:10,
      boxShadow:'0 -4px 20px rgba(15,23,42,.12)'
    }}>
      <div style={{maxWidth:1300,margin:'0 auto',display:'flex',gap:14,flexWrap:'wrap',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{flex:'1 1 240px', minWidth:200}}>
          <div style={{display:'flex',alignItems:'center',gap:7, color:'#fff',fontWeight:800,letterSpacing:-.02, fontSize:12}}>
            <span style={{width:22,height:22,borderRadius:6,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'grid',placeItems:'center',fontSize:11}}>🎓</span>
            College of Engineering Karunagappally (IHRD)
          </div>
          <div style={{fontSize:10,marginTop:4,lineHeight:1.5,opacity:.85}}>
            Thodiyoor, Karunagappally, Kollam — 690518 • IHRD • No-Due Portal<br/>
            <span style={{opacity:.7}}>Verified by 11 sections • Hostel aware • One-click PDF</span>
          </div>
        </div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:10}}>
          <div>
            <div style={{fontWeight:700,color:'#fff',marginBottom:4,letterSpacing:.03}}>Quick Links</div>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              <Link to="/" style={{color:'#93c5fd',textDecoration:'none'}}>Home</Link>
              <Link to="/profile" style={{color:'#93c5fd'}}>Profile</Link>
            </div>
          </div>
          <div>
            <div style={{fontWeight:700,color:'#fff',marginBottom:4}}>Help</div>
            <div style={{display:'flex',flexDirection:'column',gap:3,opacity:.9}}>
              <span>support@ceknadue.edu.in</span>
              <span>+91 474 1234567</span>
            </div>
          </div>
          <div style={{minWidth:120}}>
            <div style={{fontWeight:700,color:'#fff',marginBottom:4}}>No-Due</div>
            <div style={{fontSize:10,lineHeight:1.4,opacity:.8}}>
              Secure • Role-based<br/>Audit logged • Reupload on reject
            </div>
          </div>
        </div>
      </div>
      <div style={{maxWidth:1300,margin:'8px auto 0',paddingTop:6,borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:6,fontSize:10,opacity:.75}}>
        <span>© {new Date().getFullYear()} CEK IHRD • No-Due Portal • All rights reserved.</span>
        <span style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{width:5,height:5,borderRadius:999,background:'#22c55e',display:'inline-block'}}/> System online • v1.0
        </span>
      </div>
    </footer>
  )
}
