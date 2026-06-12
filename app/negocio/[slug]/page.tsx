'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams } from 'next/navigation'

type Servicio = { id: string; nombre: string; duracion_minutos: number; precio: number }
type Horario = { dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }
type Negocio = { id: string; nombre: string; slug: string; email: string }
type Profesional = { id: string; nombre: string; especialidad: string; foto_url: string }

function generarSlots(horarios: Horario[], duracion: number, citasOcupadas: string[]): Record<string, string[]> {
  const slots: Record<string, string[]> = {}
  const hoy = new Date()
  for (let i = 0; i < 14; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() + i)
    const dia = fecha.getDay()
    const horario = horarios.find(h => h.dia_semana === dia && h.activo)
    if (!horario) continue
    const [hIni, mIni] = horario.hora_inicio.split(':').map(Number)
    const [hFin, mFin] = horario.hora_fin.split(':').map(Number)
    const inicioMin = hIni * 60 + mIni
    const finMin = hFin * 60 + mFin
    const fechaKey = fecha.toISOString().split('T')[0]
    slots[fechaKey] = []
    for (let min = inicioMin; min + duracion <= finMin; min += duracion) {
      const h = Math.floor(min / 60).toString().padStart(2, '0')
      const m = (min % 60).toString().padStart(2, '0')
      const slotISO = `${fechaKey}T${h}:${m}`
      if (!citasOcupadas.includes(slotISO)) slots[fechaKey].push(`${h}:${m}`)
    }
    if (slots[fechaKey].length === 0) delete slots[fechaKey]
  }
  return slots
}

const DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function NegocioPage() {
  const { slug } = useParams()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<string[]>([])
  const [paso, setPaso] = useState(1)
  const [servicioId, setServicioId] = useState('')
  const [profesionalId, setProfesionalId] = useState('')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [offsetFechas, setOffsetFechas] = useState(0)
  const [form, setForm] = useState({ cliente_nombre: '', cliente_email: '', cliente_telefono: '', notas: '' })
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [noEncontrado, setNoEncontrado] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const { data: negocioData } = await supabase.from('negocios').select('*').eq('slug', slug).single()
      if (!negocioData) { setNoEncontrado(true); return }
      setNegocio(negocioData)
      const [{ data: serviciosData }, { data: horariosData }, { data: citasData }, { data: profesionalesData }] = await Promise.all([
        supabase.from('servicios').select('*').eq('negocio_id', negocioData.id).order('nombre'),
        supabase.from('horarios').select('*').eq('negocio_id', negocioData.id),
        supabase.from('citas').select('fecha_hora').eq('negocio_id', negocioData.id).in('estado', ['pendiente', 'confirmada']),
        supabase.from('profesionales').select('*').eq('negocio_id', negocioData.id).order('nombre')
      ])
      setServicios(serviciosData || [])
      setHorarios(horariosData || [])
      setCitasOcupadas((citasData || []).map((c: any) => c.fecha_hora.slice(0, 16)))
      setProfesionales(profesionalesData || [])
    }
    if (slug) cargar()
  }, [slug])

  const servicio = servicios.find(s => s.id === servicioId)
  const profesional = profesionales.find(p => p.id === profesionalId)
  const slots = servicio ? generarSlots(horarios, servicio.duracion_minutos, citasOcupadas) : {}
  const fechasDisponibles = Object.keys(slots).sort()
  const fechasVisibles = fechasDisponibles.slice(offsetFechas, offsetFechas + 7)
  const slotsFecha = fechaSeleccionada ? (slots[fechaSeleccionada] || []) : []
  const slotsMañana = slotsFecha.filter(h => parseInt(h.split(':')[0]) < 12)
  const slotsTarde = slotsFecha.filter(h => parseInt(h.split(':')[0]) >= 12)

  // Si no hay profesionales, saltamos ese paso
  const pasos = profesionales.length > 0
    ? [{ n: 1, label: 'Servicio' }, { n: 2, label: 'Profesional' }, { n: 3, label: 'Fecha y hora' }, { n: 4, label: 'Tus datos' }]
    : [{ n: 1, label: 'Servicio' }, { n: 3, label: 'Fecha y hora' }, { n: 4, label: 'Tus datos' }]

  const handleSubmit = async () => {
    if (!negocio || !servicio) return
    setCargando(true)
    const fecha_hora = `${fechaSeleccionada}T${horaSeleccionada}`
    const { error } = await supabase.from('citas').insert([{
      ...form,
      servicio_id: servicioId,
      profesional_id: profesionalId || null,
      fecha_hora,
      negocio_id: negocio.id,
      estado: 'nueva'
    }])
    if (!error) {
      await fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre: form.cliente_nombre,
          cliente_email: form.cliente_email,
          cliente_telefono: form.cliente_telefono,
          fecha_hora,
          servicio_nombre: servicio.nombre,
          servicio_precio: servicio.precio,
          notas: form.notas,
          negocio_email: negocio.email
        })
      })
    }
    setCargando(false)
    if (!error) setEnviado(true)
    else alert('Hubo un error, intenta de nuevo')
  }

  if (noEncontrado) return (
    <main className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center"><p className="text-5xl mb-4">😕</p><h2 className="text-xl font-bold text-[#111]">Negocio no encontrado</h2></div>
    </main>
  )

  if (enviado) return (
    <main className="min-h-screen bg-[#fafafa] flex items-center justify-center p-8">
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-12 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-black">✓</div>
        <h2 className="text-2xl font-black text-[#111] mb-2">¡Cita agendada!</h2>
        <p className="text-[#6b6b6b] mb-6">Recibirás una confirmación por email pronto.</p>
        {servicio && fechaSeleccionada && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm">
            <p className="font-bold text-[#111]">{servicio.nombre}</p>
            {profesional && <p className="text-amber-600 text-xs mt-1">con {profesional.nombre}</p>}
            <p className="text-[#6b6b6b] mt-1">{DIAS_FULL[new Date(fechaSeleccionada + 'T00:00:00').getDay()]}, {new Date(fechaSeleccionada + 'T00:00:00').getDate()} de {MESES_FULL[new Date(fechaSeleccionada + 'T00:00:00').getMonth()]} · {horaSeleccionada}</p>
          </div>
        )}
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <header className="bg-white border-b border-[#e5e5e5] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-black text-[#111]">{negocio?.nombre || '...'}</h1>
          <span className="text-xs font-bold bg-amber-400 text-[#111] px-3 py-1 rounded-full uppercase tracking-wider">Reservar</span>
        </div>
      </header>

      {/* Pasos */}
      <div className="bg-white border-b border-[#e5e5e5] px-6 py-3">
        <div className="max-w-5xl mx-auto flex gap-4 overflow-x-auto">
          {pasos.map((p, i) => {
            const pasoReal = p.n
            const activo = paso === pasoReal
            const completado = paso > pasoReal
            return (
              <button key={p.n} onClick={() => completado && setPaso(pasoReal)}
                className={`flex items-center gap-2 text-sm font-medium transition whitespace-nowrap ${activo ? 'text-[#111]' : completado ? 'text-amber-500 cursor-pointer' : 'text-[#a3a3a3]'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${activo || completado ? 'bg-amber-400 text-[#111]' : 'bg-[#e5e5e5] text-[#a3a3a3]'}`}>
                  {completado ? '✓' : i + 1}
                </span>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">

          {/* PASO 1: Servicios */}
          {paso === 1 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Qué servicio necesitas?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicios.map(s => (
                  <button key={s.id} onClick={() => {
                    setServicioId(s.id)
                    setPaso(profesionales.length > 0 ? 2 : 3)
                  }}
                    className={`border-2 rounded-xl p-5 text-left transition ${servicioId === s.id ? 'border-amber-400 bg-amber-50' : 'border-[#e5e5e5] bg-white hover:border-amber-300'}`}>
                    <p className="font-black text-[#111] mb-1">{s.nombre}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-[#a3a3a3] text-xs">{s.duracion_minutos} min</p>
                      <p className="font-black text-amber-500">${s.precio.toLocaleString('es-CO')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2: Profesional */}
          {paso === 2 && profesionales.length > 0 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Con quién quieres tu cita?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {profesionales.map(p => (
                  <button key={p.id} onClick={() => { setProfesionalId(p.id); setPaso(3) }}
                    className={`border-2 rounded-xl p-4 text-center transition ${profesionalId === p.id ? 'border-amber-400 bg-amber-50' : 'border-[#e5e5e5] bg-white hover:border-amber-300'}`}>
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nombre} className="w-16 h-16 rounded-full object-cover border-2 border-amber-200 mx-auto mb-3" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-black text-amber-500 mx-auto mb-3">
                        {p.nombre.charAt(0)}
                      </div>
                    )}
                    <p className="font-bold text-[#111] text-sm">{p.nombre}</p>
                    <p className="text-[#a3a3a3] text-xs mt-1">{p.especialidad}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 3: Fecha y hora */}
          {paso === 3 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cuándo quieres tu cita?</h2>
              <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-[#111] text-sm">
                    {fechasVisibles.length > 0 && MESES_FULL[new Date(fechasVisibles[0] + 'T00:00:00').getMonth()]}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setOffsetFechas(Math.max(0, offsetFechas - 7))} disabled={offsetFechas === 0}
                      className="w-8 h-8 rounded-full border border-[#e5e5e5] flex items-center justify-center text-sm disabled:opacity-30 hover:border-amber-400 transition">‹</button>
                    <button onClick={() => setOffsetFechas(Math.min(fechasDisponibles.length - 1, offsetFechas + 7))} disabled={offsetFechas + 7 >= fechasDisponibles.length}
                      className="w-8 h-8 rounded-full border border-[#e5e5e5] flex items-center justify-center text-sm disabled:opacity-30 hover:border-amber-400 transition">›</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {fechasVisibles.map(fecha => {
                    const d = new Date(fecha + 'T00:00:00')
                    return (
                      <button key={fecha} onClick={() => { setFechaSeleccionada(fecha); setHoraSeleccionada('') }}
                        className={`flex-1 border-2 rounded-xl py-3 text-center transition ${fechaSeleccionada === fecha ? 'border-amber-400 bg-amber-400' : 'border-[#e5e5e5] bg-white hover:border-amber-300'}`}>
                        <p className={`text-xs ${fechaSeleccionada === fecha ? 'text-[#111]' : 'text-[#a3a3a3]'}`}>{DIAS[d.getDay()]}</p>
                        <p className="font-black text-lg leading-tight text-[#111]">{d.getDate()}</p>
                        <p className={`text-xs ${fechaSeleccionada === fecha ? 'text-[#111]' : 'text-[#a3a3a3]'}`}>{MESES[d.getMonth()]}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {fechaSeleccionada && (
                <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
                  {slotsMañana.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-[#a3a3a3] uppercase tracking-widest mb-3">Mañana</p>
                      <div className="flex gap-2 flex-wrap">
                        {slotsMañana.map(hora => (
                          <button key={hora} onClick={() => setHoraSeleccionada(hora)}
                            className={`border-2 rounded-xl px-4 py-2 text-sm font-bold transition ${horaSeleccionada === hora ? 'border-amber-400 bg-amber-400 text-[#111]' : 'border-[#e5e5e5] text-[#111] hover:border-amber-300'}`}>
                            {hora}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {slotsTarde.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-[#a3a3a3] uppercase tracking-widest mb-3">Tarde</p>
                      <div className="flex gap-2 flex-wrap">
                        {slotsTarde.map(hora => (
                          <button key={hora} onClick={() => setHoraSeleccionada(hora)}
                            className={`border-2 rounded-xl px-4 py-2 text-sm font-bold transition ${horaSeleccionada === hora ? 'border-amber-400 bg-amber-400 text-[#111]' : 'border-[#e5e5e5] text-[#111] hover:border-amber-300'}`}>
                            {hora}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {horaSeleccionada && (
                <button onClick={() => setPaso(4)} className="w-full mt-6 bg-amber-400 text-[#111] font-black py-4 rounded-xl hover:bg-amber-500 transition">
                  Continuar →
                </button>
              )}
            </div>
          )}

          {/* PASO 4: Datos */}
          {paso === 4 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cómo te contactamos?</h2>
              <div className="flex flex-col gap-3">
                <input required placeholder="Nombre completo"
                  className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none focus:border-amber-400 transition text-sm"
                  value={form.cliente_nombre} onChange={e => setForm({...form, cliente_nombre: e.target.value})} />
                <input type="email" placeholder="Correo electrónico"
                  className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none focus:border-amber-400 transition text-sm"
                  value={form.cliente_email} onChange={e => setForm({...form, cliente_email: e.target.value})} />
                <input placeholder="Teléfono / WhatsApp"
                  className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none focus:border-amber-400 transition text-sm"
                  value={form.cliente_telefono} onChange={e => setForm({...form, cliente_telefono: e.target.value})} />
                <textarea placeholder="¿Algo que debamos saber? (opcional)" rows={3}
                  className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none focus:border-amber-400 transition text-sm resize-none"
                  value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} />
                <button onClick={handleSubmit} disabled={cargando || !form.cliente_nombre}
                  className="bg-amber-400 text-[#111] font-black py-4 rounded-xl hover:bg-amber-500 transition disabled:opacity-50 mt-2">
                  {cargando ? 'Enviando...' : 'Confirmar cita'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 sticky top-6">
            <p className="text-xs font-bold text-[#a3a3a3] uppercase tracking-widest mb-4">Tu reserva</p>
            {servicio ? (
              <div className="flex flex-col gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="font-black text-[#111]">{servicio.nombre}</p>
                  <p className="text-amber-600 font-bold text-sm">${servicio.precio.toLocaleString('es-CO')} COP</p>
                  <p className="text-[#a3a3a3] text-xs mt-1">{servicio.duracion_minutos} minutos</p>
                </div>
                {profesional && (
                  <div className="flex items-center gap-3">
                    {profesional.foto_url ? (
                      <img src={profesional.foto_url} alt={profesional.nombre} className="w-10 h-10 rounded-full object-cover border-2 border-amber-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-500">
                        {profesional.nombre.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-[#111] text-sm">{profesional.nombre}</p>
                      <p className="text-[#a3a3a3] text-xs">{profesional.especialidad}</p>
                    </div>
                  </div>
                )}
                {fechaSeleccionada && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
                    <span>📅</span>
                    <span>{DIAS_FULL[new Date(fechaSeleccionada + 'T00:00:00').getDay()]}, {new Date(fechaSeleccionada + 'T00:00:00').getDate()} de {MESES_FULL[new Date(fechaSeleccionada + 'T00:00:00').getMonth()]}</span>
                  </div>
                )}
                {horaSeleccionada && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
                    <span>🕐</span>
                    <span>{horaSeleccionada}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[#a3a3a3] text-sm">Selecciona un servicio para comenzar.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}