import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

api.interceptors.request.use(cfg=>{
  const token=localStorage.getItem('access')
  if(token) cfg.headers.Authorization=`Bearer ${token}`
  return cfg
})

api.interceptors.response.use(r=>r, async err=>{
  const original=err.config
  if(err.response?.status===401 && !original._retry){
    original._retry=true
    const refresh=localStorage.getItem('refresh')
    if(refresh){
      try{
        const res=await axios.post('/api/auth/refresh/', {refresh})
        localStorage.setItem('access', res.data.access)
        original.headers.Authorization=`Bearer ${res.data.access}`
        return api(original)
      }catch{
        localStorage.clear()
        window.location.href='/login'
      }
    }
  }
  return Promise.reject(err)
})

export default api
