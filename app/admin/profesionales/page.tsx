'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Cropper from 'react-easy-crop'

type Profesional = { id: string; nombre: string; especialidad: string; foto_url: string }
type Negocio = { id: string; nombre: string; logo_url: string }
type HorarioProfesional = { id: string; dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }
type Area = { x: number; y: number; width: number; height: number }

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

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
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [negocioId, setNegocioId] = useState('')
  const [form, setForm] = useState({ nombre: '', especialidad: '' })
  const [imagenSrc, setImagenSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState<Profesional | null>(null)
  const [horariosProf, setHorariosProf] = useState<HorarioProfesional[]>([])
  const [formHorario, setFormHorario] = useState({ dia_semana: 1, hora_inicio: '09:00', hora_fin: '18:00' })
  const inputFoto = useRef<HTMLInputElement>(null)

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: neg } = await supabase.from('negocios').select('*').eq('user_id', session.user.id).single()
    if (!neg) return
    setNegocio(neg)
    setNegocioId(neg.id)
    const { data } = await supabase.from('profesionales').select('*').eq('negocio_id', neg.id).order('nombre')
    setProfesionales(data || [])
    setCargando(false)
  }

  const cargarHorariosProf = async (profesionalId: string) => {
    const { data } = await supabase.from('horarios_profesionales').select('*').eq('profesional_id', profesionalId).order('dia_semana')
    setHorariosProf(data || [])
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
    if (!imagenSrc || !croppedArea) return alert('Selecciona y recorta una foto')
    setSubiendo(true)
    const blob = await getCroppedImg(imagenSrc, croppedArea)
    const path = `${negocioId}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('profesionales').upload(path, blob, { contentType: 'image/jpeg' })
    let foto_url = ''
    if (!error) {
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
    if (profesionalSeleccionado?.id === id) setProfesionalSeleccionado(null)
    cargarDatos()
  }

  const abrirHorarios = (p: Profesional) => {
    setProfesionalSeleccionado(p)
    cargarHorariosProf(p.id)
  }

  const agregarHorario = async () => {
    if (!profesionalSeleccionado) return
    if (formHorario.hora_inicio >= formHorario.hora_fin) return alert('La hora de inicio debe ser antes que la hora de fin')
    const yaExiste = horariosProf.find(h => h.dia_semana === formHorario.dia_semana)
    if (yaExiste) return alert('Ya hay un horario para ese día.')
    await supabase.from('horarios_profesionales').insert([{
      ...formHorario,
      profesional_id: profesionalSeleccionado.id,
      negocio_id: negocioId
    }])
    cargarHorariosProf(profesionalSeleccionado.id)
  }

  const toggleHorario = async (id: string, activo: boolean) => {
    await supabase.from('horarios_profesionales').update({ activo: !activo }).eq('id', id)
    if (profesionalSeleccionado) cargarHorariosProf(profesionalSeleccionado.id)
  }

  const eliminarHorario = async (id: string) => {
    await supabase.from('horarios_profesionales').delete().eq('id', id)
    if (profesionalSeleccionado) cargarHorariosProf(profesionalSeleccionado.id)
  }

  useEffect(() => { cargarDatos() }, [])

  return (
    <div className="flex gap-6 p-6 max-w-5xl mx-auto justify-center">
      {/* Panel izquierdo - Lista de profesionales */}
      <div className="flex-1 max-w-xl">
        <h2 className="text-2xl font-black text-[#111] mb-6">Profesionales</h2>

        {/* Formulario agregar */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Agregar profesional</h3>
          <div className="flex flex-col gap-3">
            {!imagenSrc ? (
              <div onClick={() => inputFoto.current?.click()}
                className="w-24 h-24 rounded-full border-2 border-dashed border-amber-400 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition mx-auto">
                <p className="text-2xl">📷</p>
                <p className="text-xs text-amber-500 font-bold mt-1">Foto</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative w-full h-48 bg-gray-900 rounded-xl overflow-hidden">
                  <Cropper image={imagenSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round"
                    showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Zoom</span>
                  <input type="range" min={1} max={3} step={0.01} value={zoom}
                    onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-amber-400" />
                </div>
                <button onClick={() => { setImagenSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1) }}
                  className="text-xs text-red-400 hover:text-red-600">Cambiar foto</button>
              </div>
            )}
            <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
            <input placeholder="Nombre" className="border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input placeholder="Especialidad" className="border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400"
              value={form.especialidad} onChange={e => setForm({...form, especialidad: e.target.value})} />
            <button onClick={agregar} disabled={subiendo || !imagenSrc}
              className="bg-amber-400 text-[#111] font-bold py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-50">
              {subiendo ? 'Guardando...' : 'Agregar profesional'}
            </button>
          </div>
        </div>

        {/* Lista */}
        {cargando ? <p className="text-gray-400 text-sm">Cargando...</p> : profesionales.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay profesionales aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {profesionales.map(p => (
              <div key={p.id} className={`bg-white border-2 rounded-xl p-4 flex items-center gap-4 transition ${profesionalSeleccionado?.id === p.id ? 'border-amber-400' : 'border-[#e5e5e5]'}`}>
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nombre} className="w-12 h-12 rounded-full object-cover border-2 border-amber-200 flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-500 flex-shrink-0">
                    {p.nombre.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-[#111]">{p.nombre}</p>
                  <p className="text-xs text-gray-400">{p.especialidad}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrirHorarios(p)}
                    className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition">
                    🕐 Horarios
                  </button>
                  <button onClick={() => eliminar(p.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel derecho - Horarios del profesional */}
      {profesionalSeleccionado && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 sticky top-6">
            <div className="flex items-center gap-3 mb-5">
              {profesionalSeleccionado.foto_url ? (
                <img src={profesionalSeleccionado.foto_url} alt={profesionalSeleccionado.nombre}
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-500">
                  {profesionalSeleccionado.nombre.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-black text-[#111] text-sm">{profesionalSeleccionado.nombre}</p>
                <p className="text-xs text-gray-400">Horarios de atención</p>
              </div>
              <button onClick={() => setProfesionalSeleccionado(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* Agregar horario */}
            <div className="flex flex-col gap-2 mb-4">
              <select className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                value={formHorario.dia_semana} onChange={e => setFormHorario({...formHorario, dia_semana: Number(e.target.value)})}>
                {DIAS.map((dia, i) => <option key={i} value={i}>{dia}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="time" className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-amber-400"
                  value={formHorario.hora_inicio} onChange={e => setFormHorario({...formHorario, hora_inicio: e.target.value})} />
                <input type="time" className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-amber-400"
                  value={formHorario.hora_fin} onChange={e => setFormHorario({...formHorario, hora_fin: e.target.value})} />
              </div>
              <button onClick={agregarHorario}
                className="bg-amber-400 text-[#111] font-bold py-2 rounded-lg text-sm hover:bg-amber-500 transition">
                Agregar día
              </button>
            </div>

            {/* Lista horarios */}
            {horariosProf.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-4">Sin horarios configurados</p>
            ) : (
              <div className="flex flex-col gap-2">
                {horariosProf.sort((a,b) => a.dia_semana - b.dia_semana).map(h => (
                  <div key={h.id} className={`flex items-center justify-between p-2 rounded-lg ${!h.activo ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-xs font-bold text-[#111]">{DIAS[h.dia_semana]}</p>
                      <p className="text-xs text-gray-400">{h.hora_inicio.slice(0,5)} — {h.hora_fin.slice(0,5)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleHorario(h.id, h.activo)}
                        className={`px-2 py-1 rounded text-xs font-bold ${h.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {h.activo ? 'Activo' : 'Inactivo'}
                      </button>
                      <button onClick={() => eliminarHorario(h.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}