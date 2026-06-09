'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams } from 'next/navigation'

type Servicio = { id: string; nombre: string; duracion_minutos: number; precio: number }
type Horario = { dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }
type Negocio = { id: string; nombre: string; slug: string; email: string }

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
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<string[]>([])
  const [paso, setPaso] = useState(1)
  const [servicioId, setServicioId] = useState('')
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
      const [{ data: serviciosData }, { data: horariosData }, { data: citasData }] = await Promise.all([
        supabase.from('servicios').select('*').eq('negocio_id', negocioData.id).order('nombre'),
        supabase.from('horarios').select('*').eq('negocio_id', negocioData.id),
        supabase.from('citas').select('fecha_hora').eq('negocio_id', negocioData.id).in('estado', ['pendiente', 'confirmada'])
      ])
      setServicios(serviciosData || [])
      setHorarios(horariosData || [])
      setCitasOcupadas((citasData || []).map((c: any) => c.fecha_hora.slice(0, 16)))
    }
    if (slug) cargar()
  }, [slug])

  const servicio = servicios.find(s => s.id === servicioId)
  const slots = servicio ? generarSlots(horarios, servicio.duracion_minutos, citasOcupadas) : {}
  const fechasDisponibles = Object.keys(slots).sort()
  const fechasVisibles = fechasDisponibles.slice(offsetFechas, offsetFechas + 7)

  const slotsFecha = fechaSeleccionada ? (slots[fechaSeleccionada] || []) : []
  const slotsMañana = slotsFecha.filter(h => parseInt(h.split(':')[0]) < 12)
  const slotsTarde = slotsFecha.filter(h => parseInt(h.split(':')[0]) >= 12)

  const handleSubmit = async () => {
    if (!negocio || !servicio) return
    setCargando(true)
    const fecha_hora = `${fechaSeleccionada}T${horaSeleccionada}`
    const { error } = await supabase.from('citas').insert([{
      ...form, servicio_id: servicioId, fecha_hora, negocio_id: negocio.id, estado: 'pendiente'
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
            <p className="text-[#6b6b6b]">{DIAS_FULL[new Date(fechaSeleccionada + 'T00:00:00').getDay()]}, {new Date(fechaSeleccionada + 'T00:00:00').getDate()} de {MESES_FULL[new Date(fechaSeleccionada + 'T00:00:00').getMonth()]} · {horaSeleccionada}</p>
          </div>
        )}
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-[#e5e5e5] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-black text-[#111]">{negocio?.nombre || '...'}</h1>
          <span className="text-xs font-bold bg-amber-400 text-[#111] px-3 py-1 rounded-full uppercase tracking-wider">Reservar</span>
        </div>
      </header>

      {/* Pasos */}
      <div className="bg-white border-b border-[#e5e5e5] px-6 py-3">
        <div className="max-w-5xl mx-auto flex gap-6">
          {[{ n: 1, label: 'Servicio' }, { n: 2, label: 'Fecha y hora' }, { n: 3, label: 'Tus datos' }].map(p => (
            <button key={p.n} onClick={() => paso > p.n && setPaso(p.n)}
              className={`flex items-center gap-2 text-sm font-medium transition ${paso === p.n ? 'text-[#111]' : paso > p.n ? 'text-amber-500 cursor-pointer' : 'text-[#a3a3a3]'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${paso === p.n ? 'bg-amber-400 text-[#111]' : paso > p.n ? 'bg-amber-400 text-[#111]' : 'bg-[#e5e5e5] text-[#a3a3a3]'}`}>
                {paso > p.n ? '✓' : p.n}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Columna principal */}
        <div className="lg:col-span-2">

          {/* PASO 1: Servicios */}
          {paso === 1 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Qué servicio necesitas?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicios.map(s => (
                  <button key={s.id} onClick={() => { setServicioId(s.id); setPaso(2) }}
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

          {/* PASO 2: Fecha y hora */}
          {paso === 2 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cuándo quieres tu cita?</h2>

              {/* Calendario horizontal */}
              <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-[#111] text-sm">
                    {fechasVisibles.length > 0 && MESES_FULL[new Date(fechasVisibles[0] + 'T00:00:00').getMonth()]}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setOffsetFechas(Math.max(0, offsetFechas - 7))}
                      disabled={offsetFechas === 0}
                      className="w-8 h-8 rounded-full border border-[#e5e5e5] flex items-center justify-center text-sm disabled:opacity-30 hover:border-amber-400 transition">
                      ‹
                    </button>
                    <button onClick={() => setOffsetFechas(Math.min(fechasDisponibles.length - 1, offsetFechas + 7))}
                      disabled={offsetFechas + 7 >= fechasDisponibles.length}
                      className="w-8 h-8 rounded-full border border-[#e5e5e5] flex items-center justify-center text-sm disabled:opacity-30 hover:border-amber-400 transition">
                      ›
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {fechasVisibles.map(fecha => {
                    const d = new Date(fecha + 'T00:00:00')
                    return (
                      <button key={fecha} onClick={() => { setFechaSeleccionada(fecha); setHoraSeleccionada('') }}
                        className={`flex-1 border-2 rounded-xl py-3 text-center transition ${fechaSeleccionada === fecha ? 'border-amber-400 bg-amber-400' : 'border-[#e5e5e5] bg-white hover:border-amber-300'}`}>
                        <p className={`text-xs ${fechaSeleccionada === fecha ? 'text-[#111]' : 'text-[#a3a3a3]'}`}>{DIAS[d.getDay()]}</p>
                        <p className={`font-black text-lg leading-tight ${fechaSeleccionada === fecha ? 'text-[#111]' : 'text-[#111]'}`}>{d.getDate()}</p>
                        <p className={`text-xs ${fechaSeleccionada === fecha ? 'text-[#111]' : 'text-[#a3a3a3]'}`}>{MESES[d.getMonth()]}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Horas */}
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
                <button onClick={() => setPaso(3)}
                  className="w-full mt-6 bg-amber-400 text-[#111] font-black py-4 rounded-xl hover:bg-amber-500 transition">
                  Continuar →
                </button>
              )}
            </div>
          )}

          {/* PASO 3: Datos */}
          {paso === 3 && (
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

        {/* Panel lateral - resumen */}
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