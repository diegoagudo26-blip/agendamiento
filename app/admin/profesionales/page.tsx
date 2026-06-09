'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Cropper from 'react-easy-crop'

type Profesional = {
  id: string
  nombre: string
  especialidad: string
  foto_url: string
}

type Point = { x: number; y: number }
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

export default function Profesionales() {
  const router = useRouter()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [negocioId, setNegocioId] = useState('')
  const [form, setForm] = useState({ nombre: '', especialidad: '' })
  const [imagenSrc, setImagenSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: negocio } = await supabase.from('negocios').select('id').eq('user_id', session.user.id).single()
    if (!negocio) return
    setNegocioId(negocio.id)
    const { data } = await supabase.from('profesionales').select('*').eq('negocio_id', negocio.id).order('nombre')
    setProfesionales(data || [])
    setCargando(false)
  }

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!croppedArea || !imagenSrc) return alert('Selecciona y recorta una foto')
    setSubiendo(true)

    const blob = await getCroppedImg(imagenSrc, croppedArea)
    const path = `${negocioId}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('profesionales').upload(path, blob, { contentType: 'image/jpeg' })

    let foto_url = ''
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('profesionales').getPublicUrl(path)
      foto_url = urlData.publicUrl
    }

    await supabase.from('profesionales').insert([{ ...form, foto_url, negocio_id: negocioId }])
    setForm({ nombre: '', especialidad: '' })
    setImagenSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setSubiendo(false)
    cargarDatos()
  }

  const eliminar = async (id: string) => {
    await supabase.from('profesionales').delete().eq('id', id)
    cargarDatos()
  }

  useEffect(() => { cargarDatos() }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-700">AgendaFácil — Admin</h1>
          <nav className="flex gap-4 items-center">
            <Link href="/admin" className="text-gray-500 hover:text-indigo-600 transition pb-1">Citas</Link>
            <Link href="/admin/servicios" className="text-gray-500 hover:text-indigo-600 transition pb-1">Servicios</Link>
            <Link href="/admin/horarios" className="text-gray-500 hover:text-indigo-600 transition pb-1">Horarios</Link>
            <Link href="/admin/profesionales" className="text-indigo-600 font-medium border-b-2 border-indigo-600 pb-1">Profesionales</Link>
          </nav>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#111]">Profesionales</h2>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Volver</Link>
        </div>

        <div className="bg-white rounded-xl border border-[#e5e5e5] p-6 mb-6">
          <h3 className="font-semibold text-[#111] mb-4">Agregar profesional</h3>
          <div className="flex flex-col gap-4">

            {/* Selector de foto */}
            {!imagenSrc ? (
              <div onClick={() => inputFoto.current?.click()}
                className="w-32 h-32 rounded-full border-2 border-dashed border-amber-400 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition mx-auto">
                <p className="text-3xl">📷</p>
                <p className="text-xs text-amber-500 font-bold mt-1">Subir foto</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Cropper */}
                <div className="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden">
                  <Cropper
                    image={imagenSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                {/* Zoom */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Zoom</span>
                  <input type="range" min={1} max={3} step={0.01} value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    className="flex-1 accent-amber-400" />
                </div>
                <button onClick={() => { setImagenSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1) }}
                  className="text-sm text-red-400 hover:text-red-600 text-center">
                  Cambiar foto
                </button>
              </div>
            )}

            <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={handleFoto} />

            <input placeholder="Nombre del profesional"
              className="border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input placeholder="Especialidad (ej: Barbero, Colorista)"
              className="border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.especialidad} onChange={e => setForm({...form, especialidad: e.target.value})} />

            <button onClick={agregar} disabled={subiendo || !imagenSrc}
              className="bg-amber-400 text-[#111] font-bold py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-50">
              {subiendo ? 'Guardando...' : 'Agregar profesional'}
            </button>
          </div>
        </div>

        {/* Lista */}
        {cargando ? <p className="text-gray-400">Cargando...</p> : profesionales.length === 0 ? (
          <p className="text-gray-400">No hay profesionales aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {profesionales.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-[#e5e5e5] p-4 flex items-center gap-4">
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nombre} className="w-14 h-14 rounded-full object-cover border-2 border-amber-400" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-black text-amber-500">
                    {p.nombre.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-[#111]">{p.nombre}</p>
                  <p className="text-sm text-gray-500">{p.especialidad}</p>
                </div>
                <button onClick={() => eliminar(p.id)} className="text-red-400 hover:text-red-600 text-sm">Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}