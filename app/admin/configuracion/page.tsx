'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Negocio = {
  id: string
  nombre: string
  email: string
  telefono: string
  logo_url: string
  slug: string
}

export default function Configuracion() {
  const router = useRouter()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [form, setForm] = useState({ nombre: '', telefono: '' })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const inputLogo = useRef<HTMLInputElement>(null)

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase.from('negocios').select('*').eq('user_id', session.user.id).single()
    if (!data) return
    setNegocio(data)
    setForm({ nombre: data.nombre, telefono: data.telefono || '' })
    setLogoPreview(data.logo_url || null)
  }

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const guardar = async () => {
    if (!negocio) return
    setGuardando(true)

    let logo_url = negocio.logo_url || ''
    if (logoFile) {
      const ext = logoFile.name.split('.').pop()
      const path = `${negocio.id}/logo.${ext}`
      await supabase.storage.from('logos').upload(path, logoFile, { upsert: true })
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      logo_url = urlData.publicUrl + '?t=' + Date.now()
    }

    await supabase.from('negocios').update({ ...form, logo_url }).eq('id', negocio.id)
    setGuardando(false)
    setExito(true)
    setTimeout(() => setExito(false), 3000)
    cargarDatos()
  }

  useEffect(() => { cargarDatos() }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-700">AgendaFácil — Admin</h1>
          <nav className="flex gap-4 items-center flex-wrap">
            <Link href="/admin" className="text-gray-500 hover:text-indigo-600 transition pb-1">Citas</Link>
            <Link href="/admin/servicios" className="text-gray-500 hover:text-indigo-600 transition pb-1">Servicios</Link>
            <Link href="/admin/horarios" className="text-gray-500 hover:text-indigo-600 transition pb-1">Horarios</Link>
            <Link href="/admin/profesionales" className="text-gray-500 hover:text-indigo-600 transition pb-1">Profesionales</Link>
            <Link href="/admin/configuracion" className="text-indigo-600 font-medium border-b-2 border-indigo-600 pb-1">Configuración</Link>
          </nav>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-8 py-8">
        <h2 className="text-2xl font-bold text-[#111] mb-6">Configuración del negocio</h2>

        <div className="bg-white rounded-xl border border-[#e5e5e5] p-6 flex flex-col gap-5">

          {/* Logo */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Logo del negocio</label>
            <div className="flex items-center gap-5">
              <div onClick={() => inputLogo.current?.click()}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-amber-400 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center">
                    <p className="text-2xl">🖼️</p>
                    <p className="text-xs text-amber-500 font-bold mt-1">Subir logo</p>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <p>Toca para subir tu logo.</p>
                <p className="text-xs mt-1 text-gray-400">PNG o JPG con fondo transparente recomendado.</p>
                {logoPreview && (
                  <button onClick={() => { setLogoPreview(null); setLogoFile(null) }}
                    className="text-red-400 text-xs mt-2 hover:text-red-600">
                    Quitar logo
                  </button>
                )}
              </div>
            </div>
            <input ref={inputLogo} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Nombre del negocio</label>
            <input className="border rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          </div>

          {/* Teléfono */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Teléfono / WhatsApp</label>
            <input className="border rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="+57 300 000 0000"
              value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
          </div>

          {/* URL pública */}
          {negocio?.slug && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Tu link de reservas</label>
              <div className="bg-gray-50 border rounded-xl px-4 py-3 text-sm text-indigo-600 font-medium">
                agendamiento-peach.vercel.app/negocio/{negocio.slug}
              </div>
            </div>
          )}

          <button onClick={guardar} disabled={guardando}
            className="bg-amber-400 text-[#111] font-black py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-50">
            {guardando ? 'Guardando...' : exito ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </main>
  )
}