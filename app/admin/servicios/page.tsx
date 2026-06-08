'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

type Servicio = {
  id: string
  nombre: string
  duracion_minutos: number
  precio: number
}

export default function Servicios() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [form, setForm] = useState({ nombre: '', duracion_minutos: 30, precio: 0 })
  const [cargando, setCargando] = useState(true)

  const cargarServicios = async () => {
    const { data } = await supabase.from('servicios').select('*').order('nombre')
    setServicios(data || [])
    setCargando(false)
  }

  const agregarServicio = async () => {
    if (!form.nombre) return alert('El nombre es obligatorio')
    await supabase.from('servicios').insert([{ ...form, negocio_id: null }])
    setForm({ nombre: '', duracion_minutos: 30, precio: 0 })
    cargarServicios()
  }

  const eliminarServicio = async (id: string) => {
    await supabase.from('servicios').delete().eq('id', id)
    cargarServicios()
  }

  useEffect(() => { cargarServicios() }, [])

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-700">Mis servicios</h1>
          <Link href="/admin" className="text-indigo-600 hover:underline text-sm">← Volver al panel</Link>
        </div>

        {/* Formulario nuevo servicio */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Agregar servicio</h2>
          <div className="flex flex-col gap-3">
            <input placeholder="Nombre del servicio (ej: Corte + Barba)"
              className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Duración (minutos)</label>
                <input type="number" min={15} step={15}
                  className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.duracion_minutos} onChange={e => setForm({...form, duracion_minutos: Number(e.target.value)})} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Precio (COP)</label>
                <input type="number" min={0}
                  className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.precio} onChange={e => setForm({...form, precio: Number(e.target.value)})} />
              </div>
            </div>
            <button onClick={agregarServicio}
              className="bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
              Agregar servicio
            </button>
          </div>
        </div>

        {/* Lista de servicios */}
        {cargando ? <p className="text-gray-400">Cargando...</p> : servicios.length === 0 ? (
          <p className="text-gray-400">No hay servicios aún. Agrega el primero.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {servicios.map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800">{s.nombre}</p>
                  <p className="text-sm text-gray-500">{s.duracion_minutos} min · ${s.precio.toLocaleString('es-CO')} COP</p>
                </div>
                <button onClick={() => eliminarServicio(s.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}