import { Navigate } from 'react-router-dom'
import { useAuth } from '../utils/auth'

export default function ProtectedRoute({children, roles}){
  const {user,loading}=useAuth()
  if(loading) return <div style={{padding:40}}>Loading...</div>
  if(!user) return <Navigate to="/login" replace/>
  if(roles && !roles.includes(user.role)) return <Navigate to="/" replace/>
  // force profile completion except admin
  if(user.role!=='ADMIN' && !user.profile_complete){
    // allow profile page
    if(window.location.pathname!=='/profile') return <Navigate to="/profile" replace/>
  }
  return children
}
