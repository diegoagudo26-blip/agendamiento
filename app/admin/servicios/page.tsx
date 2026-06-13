'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Cropper from 'react-easy-crop'

type Servicio = { id: string; nombre: string; duracion_minutos: number; precio: number; imagen_url: string }
type Negocio = { id: string; nombre: string; logo_url: string }
type Area = { x: number; y: number; width: number; height: number }

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  await new Promise(resolve => { image.onload = resolve })
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.9))
}

export default function Servicios() {
  const router = useRouter()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [negocioId, setNegocioId] = useState('')
  const [form, setForm] = useState({ nombre: '', duracion_minutos: 30, precio: '' })
  const [imagenSrc, setImagenSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const inputImagen = useRef<HTMLInputElement>(null)

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: neg } = await supabase.from('negocios').select('*').eq('user_id', session.user.id).single()
    if (!neg) return
    setNegocio(neg)
    setNegocioId(neg.id)
    const { data } = await supabase.from('servicios').select('*').eq('negocio_id', neg.id).order('nombre')
    setServicios(data || [])
    setCargando(false)
  }

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImagenSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  const agregar = async () => {
    if (!form.nombre) return alert('El nombre es obligatorio')
    setSubiendo(true)

    let imagen_url = ''
    if (imagenSrc && croppedArea) {
      const blob = await getCroppedImg(imagenSrc, croppedArea)
      const path = `${negocioId}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('servicios').upload(path, blob, { contentType: 'image/jpeg' })
      if (!error) {
        const { data: urlData } = supabase.storage.from('servicios').getPublicUrl(path)
        imagen_url = urlData.publicUrl
      }
    }

    await supabase.from('servicios').insert([{
      nombre: form.nombre,
      duracion_minutos: form.duracion_minutos,
      precio: Number(form.precio) || 0,
      imagen_url,
      negocio_id: negocioId
    }])
    setForm({ nombre: '', duracion_minutos: 30, precio: '' })
    setImagenSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setSubiendo(false)
    cargarDatos()
  }

  const eliminar = async (id: string) => {
    await supabase.from('servicios').delete().eq('id', id)
    cargarDatos()
  }

  useEffect(() => { cargarDatos() }, [])

  return (
    <main className="min-h-screen bg-[#fafafa]">
   
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-black text-[#111] mb-6">Servicios</h2>

        <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Agregar servicio</h3>
          <div className="flex flex-col gap-3">

            {/* Imagen con cropper */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Foto del servicio (opcional)</label>
              {!imagenSrc ? (
                <div onClick={() => inputImagen.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-amber-400 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition">
                  <p className="text-3xl">🖼️</p>
                  <p className="text-xs text-amber-500 font-bold mt-1">Subir foto del resultado</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="relative w-full h-48 bg-gray-900 rounded-xl overflow-hidden">
                    <Cropper
                      image={imagenSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={16 / 9}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">Zoom</span>
                    <input type="range" min={1} max={3} step={0.01} value={zoom}
                      onChange={e => setZoom(Number(e.target.value))}
                      className="flex-1 accent-amber-400" />
                  </div>
                  <button onClick={() => { setImagenSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1) }}
                    className="text-xs text-red-400 hover:text-red-600">Cambiar foto</button>
                </div>
              )}
              <input ref={inputImagen} type="file" accept="image/*" className="hidden" onChange={handleImagen} />
            </div>

            <input placeholder="Nombre del servicio (ej: Corte + Barba)"
              className="border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 transition"
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Duración (minutos)</label>
                <select className="border border-[#e5e5e5] rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:border-amber-400 transition"
                  value={form.duracion_minutos} onChange={e => setForm({...form, duracion_minutos: Number(e.target.value)})}>
                  {[15, 30, 45, 60, 75, 90, 120].map(m => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Precio (COP)</label>
                <input type="number" min={0} placeholder="Ej: 35000"
                  className="border border-[#e5e5e5] rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:border-amber-400 transition"
                  value={form.precio} onChange={e => setForm({...form, precio: e.target.value})} />
              </div>
            </div>

            <button onClick={agregar} disabled={subiendo}
              className="bg-amber-400 text-[#111] font-black py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-50">
              {subiendo ? 'Guardando...' : 'Agregar servicio'}
            </button>
          </div>
        </div>

        {/* Lista */}
        {cargando ? <p className="text-gray-400 text-sm">Cargando...</p> : servicios.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay servicios aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {servicios.map(s => (
              <div key={s.id} className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden flex">
                {s.imagen_url ? (
                  <img src={s.imagen_url} alt={s.nombre} className="w-28 h-24 object-cover flex-shrink-0" />
                ) : (
                  <div className="w-28 h-24 bg-amber-50 flex items-center justify-center flex-shrink-0 text-2xl">✂️</div>
                )}
                <div className="flex-1 p-4 flex justify-between items-center">
                  <div>
                    <p className="font-black text-[#111]">{s.nombre}</p>
                    <p className="text-xs text-gray-400 mt-1">{s.duracion_minutos} min</p>
                    <p className="text-sm font-bold text-amber-500 mt-1">${s.precio.toLocaleString('es-CO')}</p>
                  </div>
                  <button onClick={() => eliminar(s.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}