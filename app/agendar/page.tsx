'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Servicio = { id: string; nombre: string; duracion_minutos: number; precio: number }
type Horario = { dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }

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
      if (!citasOcupadas.includes(slotISO)) {
        slots[fechaKey].push(`${h}:${m}`)
      }
    }

    if (slots[fechaKey].length === 0) delete slots[fechaKey]
  }
  return slots
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function Agendar() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<string[]>([])
  const [servicioId, setServicioId] = useState('')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [form, setForm] = useState({ cliente_nombre: '', cliente_email: '', cliente_telefono: '', notas: '' })
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase.from('servicios').select('*').order('nombre').then(({ data }) => setServicios(data || []))
    supabase.from('horarios').select('*').then(({ data }) => setHorarios(data || []))
    supabase.from('citas').select('fecha_hora').in('estado', ['pendiente', 'confirmada']).then(({ data }) => {
      setCitasOcupadas((data || []).map(c => c.fecha_hora.slice(0, 16)))
    })
  }, [])

  const servicio = servicios.find(s => s.id === servicioId)
  const slots = servicio ? generarSlots(horarios, servicio.duracion_minutos, citasOcupadas) : {}
  const fechasDisponibles = Object.keys(slots).sort()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!servicioId) return alert('Selecciona un servicio')
    if (!fechaSeleccionada || !horaSeleccionada) return alert('Selecciona fecha y hora')
    setCargando(true)
    const fecha_hora = `${fechaSeleccionada}T${horaSeleccionada}`
    const { error } = await supabase.from('citas').insert([{
      ...form, servicio_id: servicioId, fecha_hora, negocio_id: null, estado: 'pendiente'
    }])

    if (!error && servicio) {
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
          negocio_email: process.env.NEXT_PUBLIC_ADMIN_EMAIL
        })
      })
    }

    setCargando(false)
    if (!error) setEnviado(true)
    else alert('Hubo un error, intenta de nuevo')
  }

  if (enviado) return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-indigo-700 mb-2">¡Cita agendada!</h2>
        <p className="text-gray-500">Te contactaremos para confirmar tu cita.</p>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full">
        <h1 className="text-2xl font-bold text-indigo-700 mb-6">Reservar una cita</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Datos personales */}
          <input required placeholder="Tu nombre" className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.cliente_nombre} onChange={e => setForm({...form, cliente_nombre: e.target.value})} />
          <input type="email" placeholder="Tu email" className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.cliente_email} onChange={e => setForm({...form, cliente_email: e.target.value})} />
          <input placeholder="Tu teléfono" className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.cliente_telefono} onChange={e => setForm({...form, cliente_telefono: e.target.value})} />

          {/* Servicios */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block font-medium">Selecciona un servicio</label>
            <div className="flex flex-col gap-2">
              {servicios.map(s => (
                <button type="button" key={s.id} onClick={() => { setServicioId(s.id); setFechaSeleccionada(''); setHoraSeleccionada('') }}
                  className={`border-2 rounded-xl p-3 text-left transition ${servicioId === s.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                  <p className="font-semibold text-gray-800">{s.nombre}</p>
                  <p className="text-sm text-gray-500">{s.duracion_minutos} min · ${s.precio.toLocaleString('es-CO')} COP</p>
                </button>
              ))}
            </div>
          </div>

          {/* Fechas disponibles */}
          {servicioId && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block font-medium">Selecciona una fecha</label>
              {fechasDisponibles.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay fechas disponibles en los próximos 14 días.</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {fechasDisponibles.map(fecha => {
                    const d = new Date(fecha + 'T00:00:00')
                    return (
                      <button type="button" key={fecha} onClick={() => { setFechaSeleccionada(fecha); setHoraSeleccionada('') }}
                        className={`border-2 rounded-xl px-4 py-2 text-center transition ${fechaSeleccionada === fecha ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                        <p className="text-xs text-gray-500">{DIAS[d.getDay()]}</p>
                        <p className="font-semibold text-gray-800">{d.getDate()} {MESES[d.getMonth()]}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Horas disponibles */}
          {fechaSeleccionada && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block font-medium">Selecciona una hora</label>
              <div className="flex gap-2 flex-wrap">
                {(slots[fechaSeleccionada] || []).map(hora => (
                  <button type="button" key={hora} onClick={() => setHoraSeleccionada(hora)}
                    className={`border-2 rounded-xl px-4 py-2 font-medium transition ${horaSeleccionada === hora ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-indigo-300 text-gray-700'}`}>
                    {hora}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea placeholder="Notas adicionales (opcional)" className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} />

          <button type="submit" disabled={cargando}
            className="bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
            {cargando ? 'Enviando...' : 'Confirmar cita'}
          </button>
        </form>
      </div>
    </main>
  )
}