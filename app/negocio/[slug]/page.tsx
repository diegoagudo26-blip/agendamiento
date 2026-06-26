'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams } from 'next/navigation'

type Servicio = { id: string; nombre: string; duracion_minutos: number; precio: number }
type Horario = { dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }
type HorarioProfesional = { profesional_id: string; dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }
type Negocio = { id: string; nombre: string; slug: string; email: string }
type Profesional = { id: string; nombre: string; especialidad: string; foto_url: string }
type CitaOcupada = { fecha_hora: string; profesional_id: string | null }

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generarSlots(
  horarios: { dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }[],
  duracion: number,
  citasOcupadas: string[],
  horasAnticipacion: number = 2
): Record<string, string[]> {
  const slots: Record<string, string[]> = {}
  const ahora = new Date()
  const limiteMinimo = new Date(ahora.getTime() + horasAnticipacion * 60 * 60 * 1000)
  for (let i = 0; i < 14; i++) {
    const fecha = new Date(ahora)
    fecha.setDate(ahora.getDate() + i)
    const dia = fecha.getDay()
    const horario = horarios.find(h => h.dia_semana === dia && h.activo)
    if (!horario) continue
    const [hIni, mIni] = horario.hora_inicio.split(':').map(Number)
    const [hFin, mFin] = horario.hora_fin.split(':').map(Number)
    const inicioMin = hIni * 60 + mIni
    const finMin = hFin * 60 + mFin
    const fechaKey = localDateKey(fecha)
    slots[fechaKey] = []
    for (let min = inicioMin; min + duracion <= finMin; min += duracion) {
      const h = Math.floor(min / 60).toString().padStart(2, '0')
      const m = (min % 60).toString().padStart(2, '0')
      const slotISO = `${fechaKey}T${h}:${m}`
      const slotFecha = new Date(`${fechaKey}T${h}:${m}:00`)
      if (slotFecha < limiteMinimo) continue
      if (!citasOcupadas.includes(slotISO)) slots[fechaKey].push(`${h}:${m}`)
    }
    if (slots[fechaKey].length === 0) delete slots[fechaKey]
  }
  return slots
}

function citasKeysDe(citasOcupadas: CitaOcupada[], profesionalId: string | null): string[] {
  return citasOcupadas
    .filter(c => c.profesional_id === profesionalId)
    .map(c => {
      const d = new Date(c.fecha_hora)
      const fecha = localDateKey(d)
      const h = d.getHours().toString().padStart(2, '0')
      const m = d.getMinutes().toString().padStart(2, '0')
      return `${fecha}T${h}:${m}`
    })
}

const DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function validarTelefonoColombia(tel: string): boolean {
  const limpio = tel.replace(/\s/g, '')
  return /^3\d{9}$/.test(limpio)
}
function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}
export default function NegocioPage() {
  const { slug } = useParams()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [horariosProf, setHorariosProf] = useState<HorarioProfesional[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<CitaOcupada[]>([])
  const [paso, setPaso] = useState(1)
  const [servicioId, setServicioId] = useState('')
  const [modo, setModo] = useState<'rapido' | 'profesional' | null>(null)
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
      const [{ data: serviciosData }, { data: horariosData }, { data: citasData }, { data: profesionalesData }, { data: horariosProfData }] = await Promise.all([
        supabase.from('servicios').select('*').eq('negocio_id', negocioData.id).order('nombre'),
        supabase.from('horarios').select('*').eq('negocio_id', negocioData.id),
        supabase.from('citas').select('fecha_hora, profesional_id').eq('negocio_id', negocioData.id).in('estado', ['nueva', 'pendiente', 'confirmada']),
        supabase.from('profesionales').select('*').eq('negocio_id', negocioData.id).order('nombre'),
        supabase.from('horarios_profesionales').select('*').eq('negocio_id', negocioData.id)
      ])
      setServicios(serviciosData || [])
      setHorarios(horariosData || [])
      setCitasOcupadas(citasData || [])
      setProfesionales(profesionalesData || [])
      setHorariosProf(horariosProfData || [])
    }
    if (slug) cargar()
  }, [slug])

  const servicio = servicios.find(s => s.id === servicioId)
  const profesional = profesionales.find(p => p.id === profesionalId)
  const hayProfesionales = profesionales.length > 0

  const slotsPorProfesional: Record<string, Record<string, string[]>> = {}
  if (servicio && hayProfesionales) {
    for (const p of profesionales) {
      const horariosP = horariosProf.filter(h => h.profesional_id === p.id)
      const citasP = citasKeysDe(citasOcupadas, p.id)
      slotsPorProfesional[p.id] = generarSlots(horariosP, servicio.duracion_minutos, citasP)
    }
  }

  let slotsUnion: Record<string, string[]> = {}
  if (servicio && hayProfesionales) {
    const union: Record<string, Set<string>> = {}
    for (const p of profesionales) {
      const sp = slotsPorProfesional[p.id] || {}
      for (const fecha in sp) {
        if (!union[fecha]) union[fecha] = new Set()
        sp[fecha].forEach(h => union[fecha].add(h))
      }
    }
    for (const fecha in union) slotsUnion[fecha] = Array.from(union[fecha]).sort()
  }

  let slotsGeneral: Record<string, string[]> = {}
  if (servicio && !hayProfesionales) {
    const citasGenerales = citasKeysDe(citasOcupadas, null)
    slotsGeneral = generarSlots(horarios, servicio.duracion_minutos, citasGenerales)
  }

  let slotsActivos: Record<string, string[]> = {}
  if (!hayProfesionales) slotsActivos = slotsGeneral
  else if (modo === 'profesional' && profesionalId) slotsActivos = slotsPorProfesional[profesionalId] || {}
  else slotsActivos = slotsUnion

  const fechasDisponibles = Object.keys(slotsActivos).sort()
  const fechasVisibles = fechasDisponibles.slice(offsetFechas, offsetFechas + 7)
  const slotsFecha = fechaSeleccionada ? (slotsActivos[fechaSeleccionada] || []) : []
  const slotsMañana = slotsFecha.filter(h => parseInt(h.split(':')[0]) < 12)
  const slotsTarde = slotsFecha.filter(h => parseInt(h.split(':')[0]) >= 12)

  const profesionalesDisponibles = (fechaSeleccionada && horaSeleccionada)
    ? profesionales.filter(p => (slotsPorProfesional[p.id]?.[fechaSeleccionada] || []).includes(horaSeleccionada))
    : []

  const pasos = !hayProfesionales
    ? [{ n: 1, label: 'Servicio' }, { n: 2, label: 'Fecha y hora' }, { n: 4, label: 'Tus datos' }]
    : modo === 'profesional'
      ? [{ n: 1, label: 'Servicio' }, { n: 2, label: 'Preferencia' }, { n: 3, label: 'Profesional' }, { n: 4, label: 'Fecha y hora' }, { n: 5, label: 'Tus datos' }]
      : [{ n: 1, label: 'Servicio' }, { n: 2, label: 'Preferencia' }, { n: 3, label: 'Fecha y hora' }, { n: 4, label: 'Profesional' }, { n: 5, label: 'Tus datos' }]

  const volverA = (n: number) => {
    if (n <= 2) { setModo(null); setProfesionalId(''); setFechaSeleccionada(''); setHoraSeleccionada(''); setOffsetFechas(0) }
    else if (n === 3) { setFechaSeleccionada(''); setHoraSeleccionada(''); setProfesionalId('') }
    else if (n === 4) {
      if (modo === 'profesional') { setFechaSeleccionada(''); setHoraSeleccionada('') }
      else { setProfesionalId('') }
    }
    setPaso(n)
  }

  const handleSubmit = async () => {
  if (!negocio || !servicio) return
  setCargando(true)
  const fecha_hora = `${fechaSeleccionada}T${horaSeleccionada}`
  const { data, error } = await supabase.from('citas').insert([{
    ...form,
    servicio_id: servicioId,
    profesional_id: profesionalId || null,
    fecha_hora,
    negocio_id: negocio.id,
    estado: 'nueva'
  }]).select('id').single()

  if (!error && data) {
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
        negocio_email: negocio.email,
        negocio_nombre: negocio.nombre,
        cita_id: data.id
      })
    })
  }
  setCargando(false)
  if (!error) setEnviado(true)
  else alert('Hubo un error, intenta de nuevo')
}
  const FormularioContacto = (
    <div className="flex flex-col gap-3">
      <input required placeholder="Nombre completo"
        className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none focus:border-amber-400 transition text-sm"
        value={form.cliente_nombre} onChange={e => setForm({...form, cliente_nombre: e.target.value})} />
      <div>
  <input type="email" placeholder="Correo electrónico"
    className={`bg-white border rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none transition text-sm w-full ${form.cliente_email && !validarEmail(form.cliente_email) ? 'border-red-300 focus:border-red-400' : 'border-[#e5e5e5] focus:border-amber-400'}`}
    value={form.cliente_email} onChange={e => setForm({...form, cliente_email: e.target.value})} />
  {form.cliente_email && !validarEmail(form.cliente_email) && (
    <p className="text-red-400 text-xs mt-1 ml-1">Ingresa un correo válido (ej: nombre@gmail.com)</p>
  )}
</div>
      <div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm text-[#111] flex-shrink-0">
            🇨🇴 <span className="font-bold">+57</span>
          </div>
          <input placeholder="300 123 4567" maxLength={10}
            className={`bg-white border rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none transition text-sm flex-1 ${form.cliente_telefono && !validarTelefonoColombia(form.cliente_telefono) ? 'border-red-300 focus:border-red-400' : 'border-[#e5e5e5] focus:border-amber-400'}`}
            value={form.cliente_telefono}
            onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 10); setForm({...form, cliente_telefono: val}) }} />
        </div>
        {form.cliente_telefono && !validarTelefonoColombia(form.cliente_telefono) && (
          <p className="text-red-400 text-xs mt-1 ml-1">Ingresa un celular colombiano válido (10 dígitos, empieza por 3)</p>
        )}
      </div>
      <textarea placeholder="¿Algo que debamos saber? (opcional)" rows={3}
        className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3 text-[#111] placeholder-[#a3a3a3] focus:outline-none focus:border-amber-400 transition text-sm resize-none"
        value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} />
      <button onClick={handleSubmit} disabled={cargando || !form.cliente_nombre || !validarTelefonoColombia(form.cliente_telefono) || !validarEmail(form.cliente_email)}
        className="bg-amber-400 text-[#111] font-black py-4 rounded-xl hover:bg-amber-500 transition disabled:opacity-50 mt-2">
        {cargando ? 'Enviando...' : 'Confirmar cita'}
      </button>
    </div>
  )

  const SelectorFechaHora = ({ onContinuar }: { onContinuar: () => void }) => (
    <div>
      {fechasDisponibles.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-8 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-gray-500 text-sm">
            {modo === 'profesional' && profesional
              ? `${profesional.nombre} no tiene horarios disponibles configurados.`
              : 'No hay fechas disponibles en los próximos 14 días.'}
          </p>
        </div>
      ) : (
        <>
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
              {slotsMañana.length === 0 && slotsTarde.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">No hay horas disponibles para este día.</p>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </>
      )}
      {horaSeleccionada && (
        <button onClick={onContinuar} className="w-full mt-6 bg-amber-400 text-[#111] font-black py-4 rounded-xl hover:bg-amber-500 transition">
          Continuar →
        </button>
      )}
    </div>
  )

  const SelectorProfesional = ({ lista, onElegir }: { lista: Profesional[]; onElegir: (id: string) => void }) => (
    lista.length === 0 ? (
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-8 text-center">
        <p className="text-3xl mb-2">😕</p>
        <p className="text-gray-500 text-sm">Nadie está disponible a esta hora. Vuelve a elegir otra.</p>
        <button onClick={() => volverA(3)} className="mt-4 text-amber-500 font-bold text-sm hover:underline">← Elegir otra hora</button>
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {lista.map(p => (
          <button key={p.id} onClick={() => onElegir(p.id)}
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
    )
  )

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
        <div className="text-center pt-6">
          <p className="text-xs text-[#a3a3a3]">Powered by <a href="/" className="text-amber-500 font-bold hover:underline">AgendaFácil</a></p>
        </div>
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

      <div className="bg-white border-b border-[#e5e5e5] px-6 py-3">
        <div className="max-w-5xl mx-auto flex gap-4 overflow-x-auto">
          {pasos.map((p, i) => {
            const activo = paso === p.n
            const completado = paso > p.n
            return (
              <button key={p.n} onClick={() => completado && volverA(p.n)}
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

          {/* PASO 1 */}
          {paso === 1 && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Qué servicio necesitas?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicios.map(s => (
                  <button key={s.id} onClick={() => { setServicioId(s.id); setModo(null); setProfesionalId(''); setFechaSeleccionada(''); setHoraSeleccionada(''); setOffsetFechas(0); setPaso(2) }}
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

          {/* PASO 2 */}
          {paso === 2 && !hayProfesionales && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cuándo quieres tu cita?</h2>
              <SelectorFechaHora onContinuar={() => setPaso(4)} />
            </div>
          )}

          {paso === 2 && hayProfesionales && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-2">¿Cómo prefieres agendar?</h2>
              <p className="text-sm text-gray-400 mb-6">Elige lo que más te convenga</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => { setModo('profesional'); setPaso(3) }}
                  className="border-2 border-[#e5e5e5] hover:border-amber-400 bg-white rounded-2xl p-6 text-left transition">
                  <p className="text-3xl mb-3">👤</p>
                  <p className="font-black text-[#111] mb-1">Elegir mi profesional</p>
                  <p className="text-sm text-gray-400">Tengo un profesional de confianza y quiero ver sus horarios disponibles.</p>
                </button>
                <button onClick={() => { setModo('rapido'); setPaso(3) }}
                  className="border-2 border-[#e5e5e5] hover:border-amber-400 bg-white rounded-2xl p-6 text-left transition">
                  <p className="text-3xl mb-3">⚡</p>
                  <p className="font-black text-[#111] mb-1">Ver primera disponibilidad</p>
                  <p className="text-sm text-gray-400">No me importa quién me atienda, solo quiero la hora más pronta.</p>
                </button>
              </div>
            </div>
          )}

          {/* PASO 3 */}
          {paso === 3 && hayProfesionales && modo === 'profesional' && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Con quién quieres tu cita?</h2>
              <SelectorProfesional lista={profesionales} onElegir={(id) => { setProfesionalId(id); setFechaSeleccionada(''); setHoraSeleccionada(''); setOffsetFechas(0); setPaso(4) }} />
            </div>
          )}

          {paso === 3 && hayProfesionales && modo === 'rapido' && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cuándo quieres tu cita?</h2>
              <SelectorFechaHora onContinuar={() => setPaso(4)} />
            </div>
          )}

          {/* PASO 4 */}
          {paso === 4 && !hayProfesionales && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cómo te contactamos?</h2>
              {FormularioContacto}
            </div>
          )}

          {paso === 4 && hayProfesionales && modo === 'profesional' && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-2">¿Cuándo quieres tu cita?</h2>
              <p className="text-sm text-gray-400 mb-6">Horarios de {profesional?.nombre}</p>
              <SelectorFechaHora onContinuar={() => setPaso(5)} />
            </div>
          )}

          {paso === 4 && hayProfesionales && modo === 'rapido' && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-2">¿Con quién quieres tu cita?</h2>
              <p className="text-sm text-gray-400 mb-6">
                Disponibles el {DIAS_FULL[new Date(fechaSeleccionada + 'T00:00:00').getDay()]} {new Date(fechaSeleccionada + 'T00:00:00').getDate()} de {MESES_FULL[new Date(fechaSeleccionada + 'T00:00:00').getMonth()]} a las {horaSeleccionada}
              </p>
              <SelectorProfesional lista={profesionalesDisponibles} onElegir={(id) => { setProfesionalId(id); setPaso(5) }} />
            </div>
          )}

          {/* PASO 5 */}
          {paso === 5 && hayProfesionales && (
            <div>
              <h2 className="text-xl font-black text-[#111] mb-6">¿Cómo te contactamos?</h2>
              {FormularioContacto}
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
                {profesional && (
                  <div className="flex items-center gap-3 pt-2 border-t border-[#f0f0f0]">
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
              </div>
            ) : (
              <p className="text-[#a3a3a3] text-sm">Selecciona un servicio para comenzar.</p>
            )}
          </div>
        </div>
      </div>

      <div className="text-center py-6">
        <p className="text-xs text-[#a3a3a3]">Powered by <a href="/" className="text-amber-500 font-bold hover:underline">AgendaFácil</a></p>
      </div>
    </main>
  )
}