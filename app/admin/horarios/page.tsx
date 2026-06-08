'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

type Horario = {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

export default function Horarios() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [form, setForm] = useState({ dia_semana: 1, hora_inicio: '09:00', hora_fin: '18:00' })
  const [cargando, setCargando] = useState(true)

  const cargarHorarios = async () => {
    const { data } = await supabase.from('horarios').select('*').order('dia_semana')
    setHorarios(data || [])
    setCargando(false)
  }

  const agregarHorario = async () => {
    if (form.hora_inicio >= form.hora_fin) return alert('La hora de inicio debe ser antes que la hora de fin')
    const yaExiste = horarios.find(h => h.dia_semana === form.dia_semana)
    if (yaExiste) return alert('Ya hay un horario para ese día. Elimínalo primero.')
    await supabase.from('horarios').insert([{ ...form, negocio_id: null }])
    cargarHorarios()
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase.from('horarios').update({ activo: !activo }).eq('id', id)
    cargarHorarios()
  }

  const eliminar = async (id: string) => {
    await supabase.from('horarios').delete().eq('id', id)
    cargarHorarios()
  }

  useEffect(() => { cargarHorarios() }, [])

  const horariosOrdenados = [...horarios].sort((a, b) => a.dia_semana - b.dia_semana)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-700">Horarios de atención</h1>
          <Link href="/admin" className="text-indigo-600 hover:underline text-sm">← Volver al panel</Link>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Agregar horario</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Día de la semana</label>
              <select className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.dia_semana} onChange={e => setForm({...form, dia_semana: Number(e.target.value)})}>
                {DIAS.map((dia, i) => <option key={i} value={i}>{dia}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Hora inicio</label>
                <input type="time" className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Hora fin</label>
                <input type="time" className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.hora_fin} onChange={e => setForm({...form, hora_fin: e.target.value})} />
              </div>
            </div>
            <button onClick={agregarHorario}
              className="bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
              Agregar horario
            </button>
          </div>
        </div>

        {/* Lista */}
        {cargando ? <p className="text-gray-400">Cargando...</p> : horariosOrdenados.length === 0 ? (
          <p className="text-gray-400">No hay horarios configurados aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {horariosOrdenados.map(h => (
              <div key={h.id} className={`bg-white rounded-xl shadow p-4 flex justify-between items-center ${!h.activo ? 'opacity-50' : ''}`}>
                <div>
                  <p className="font-semibold text-gray-800">{DIAS[h.dia_semana]}</p>
                  <p className="text-sm text-gray-500">{h.hora_inicio.slice(0,5)} — {h.hora_fin.slice(0,5)}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => toggleActivo(h.id, h.activo)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${h.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {h.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => eliminar(h.id)} className="text-red-500 hover:text-red-700 text-sm">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}