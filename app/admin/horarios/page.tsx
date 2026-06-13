'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

type Horario = { id: string; dia_semana: number; hora_inicio: string; hora_fin: string; activo: boolean }
type Negocio = { id: string; nombre: string; logo_url: string }

export default function Horarios() {
  const router = useRouter()
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [negocioId, setNegocioId] = useState('')
  const [form, setForm] = useState({ dia_semana: 1, hora_inicio: '09:00', hora_fin: '18:00' })
  const [cargando, setCargando] = useState(true)

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: neg } = await supabase.from('negocios').select('*').eq('user_id', session.user.id).single()
    if (!neg) return
    setNegocio(neg)
    setNegocioId(neg.id)
    const { data } = await supabase.from('horarios').select('*').eq('negocio_id', neg.id).order('dia_semana')
    setHorarios(data || [])
    setCargando(false)
  }

  const agregar = async () => {
    if (form.hora_inicio >= form.hora_fin) return alert('La hora de inicio debe ser antes que la hora de fin')
    const yaExiste = horarios.find(h => h.dia_semana === form.dia_semana)
    if (yaExiste) return alert('Ya hay un horario para ese día. Elimínalo primero.')
    await supabase.from('horarios').insert([{ ...form, negocio_id: negocioId }])
    cargarDatos()
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase.from('horarios').update({ activo: !activo }).eq('id', id)
    cargarDatos()
  }

  const eliminar = async (id: string) => {
    await supabase.from('horarios').delete().eq('id', id)
    cargarDatos()
  }

  useEffect(() => { cargarDatos() }, [])

  const horariosOrdenados = [...horarios].sort((a, b) => a.dia_semana - b.dia_semana)

  return (
    <main className="min-h-screen bg-[#fafafa]">
     

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-black text-[#111] mb-6">Horarios de atención</h2>

        <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Agregar horario</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Día de la semana</label>
              <select className="border border-[#e5e5e5] rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:border-amber-400 transition"
                value={form.dia_semana} onChange={e => setForm({...form, dia_semana: Number(e.target.value)})}>
                {DIAS.map((dia, i) => <option key={i} value={i}>{dia}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Hora inicio</label>
                <input type="time" className="border border-[#e5e5e5] rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:border-amber-400 transition"
                  value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Hora fin</label>
                <input type="time" className="border border-[#e5e5e5] rounded-xl px-4 py-3 w-full text-sm focus:outline-none focus:border-amber-400 transition"
                  value={form.hora_fin} onChange={e => setForm({...form, hora_fin: e.target.value})} />
              </div>
            </div>
            <button onClick={agregar}
              className="bg-amber-400 text-[#111] font-black py-3 rounded-xl hover:bg-amber-500 transition">
              Agregar horario
            </button>
          </div>
        </div>

        {cargando ? <p className="text-gray-400 text-sm">Cargando...</p> : horariosOrdenados.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay horarios configurados aún.</p>
        ) : (
          <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Día</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Horario</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {horariosOrdenados.map((h, i) => (
                  <tr key={h.id} className={`border-b border-[#f0f0f0] hover:bg-amber-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                    <td className="px-4 py-3 font-bold text-[#111] text-sm">{DIAS[h.dia_semana]}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{h.hora_inicio.slice(0,5)} — {h.hora_fin.slice(0,5)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActivo(h.id, h.activo)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${h.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {h.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => eliminar(h.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}