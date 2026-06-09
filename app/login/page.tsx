'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setCargando(false)
    } else {
      router.push('/admin')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-indigo-700 mb-2">Panel Admin</h1>
        <p className="text-gray-500 text-sm mb-6">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input required type="email" placeholder="Correo electrónico"
            className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={email} onChange={e => setEmail(e.target.value)} />
          <input required type="password" placeholder="Contraseña"
            className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={password} onChange={e => setPassword(e.target.value)} />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={cargando}
            className="bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}