import { createContext, useContext, useEffect, useState } from 'react'
import api from './api'

const AuthCtx = createContext(null)
export const useAuth = ()=>useContext(AuthCtx)

export function AuthProvider({children}){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)

  const fetchMe=async()=>{
    try{
      const r=await api.get('/auth/me/')
      setUser(r.data)
    }catch{ setUser(null) }
    setLoading(false)
  }
  useEffect(()=>{
    if(localStorage.getItem('access')) fetchMe()
    else setLoading(false)
  },[])

  const login=async(username,password,role)=>{
    const payload={username,password}
    if(role) payload.role=role
    const r=await api.post('/auth/login/',payload)
    localStorage.setItem('access', r.data.access)
    localStorage.setItem('refresh', r.data.refresh)
    // fetch me
    const me=await api.get('/auth/me/')
    setUser(me.data)
    return me.data
  }
  const logout=()=>{
    localStorage.clear()
    setUser(null)
  }
  return <AuthCtx.Provider value={{user,loading,login,logout,fetchMe,setUser}}>{children}</AuthCtx.Provider>
}
