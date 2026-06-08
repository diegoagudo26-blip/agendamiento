'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

type Cita = {
  id: string
  cliente_nombre: string
  cliente_email: string
  cliente_telefono: string
  fecha_hora: string
  estado: string
  notas: string
  servicios: { nombre: string; precio: number } | null
}

const estadoColores: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
  completada: 'bg-gray-100 text-gray-800',
}

export default function Admin() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  const cargarCitas = async () => {
    const { data } = await supabase
      .from('citas')
      .select('*, servicios(nombre, precio)')
      .order('fecha_hora', { ascending: true })
    setCitas(data || [])
    setCargando(false)
  }

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', id)
    cargarCitas()
  }

  useEffect(() => { cargarCitas() }, [])

  const citasFiltradas = filtro === 'todos' ? citas : citas.filter(c => c.estado === filtro)

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-700">AgendaFácil — Admin</h1>
          <nav className="flex gap-4">
            <Link href="/admin" className="text-indigo-600 font-medium border-b-2 border-indigo-600 pb-1">Citas</Link>
            <Link href="/admin/servicios" className="text-gray-500 hover:text-indigo-600 transition pb-1">Servicios</Link>
            <Link href="/admin/horarios" className="text-gray-500 hover:text-indigo-600 transition pb-1">Horarios</Link>
            <Link href="/agendar" target="_blank" className="text-gray-500 hover:text-indigo-600 transition pb-1">Ver formulario ↗</Link>
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: citas.length, color: 'text-gray-800' },
            { label: 'Pendientes', value: citas.filter(c => c.estado === 'pendiente').length, color: 'text-yellow-600' },
            { label: 'Confirmadas', value: citas.filter(c => c.estado === 'confirmada').length, color: 'text-green-600' },
            { label: 'Completadas', value: citas.filter(c => c.estado === 'completada').length, color: 'text-gray-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-4 text-center">
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-gray-500 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="text-gray-500 mb-4 text-sm">{citasFiltradas.length} citas mostradas</p>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['todos', 'pendiente', 'confirmada', 'completada', 'cancelada'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${filtro === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border hover:bg-indigo-50'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Lista de citas */}
        {cargando ? (
          <p className="text-gray-400">Cargando citas...</p>
        ) : citasFiltradas.length === 0 ? (
          <p className="text-gray-400">No hay citas en esta categoría.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {citasFiltradas.map(cita => (
              <div key={cita.id} className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">{cita.cliente_nombre}</h2>
                    <p className="text-gray-500 text-sm">{cita.cliente_email} · {cita.cliente_telefono}</p>
                    {cita.servicios && (
                      <p className="text-indigo-500 text-sm mt-1">
                        {cita.servicios.nombre} · ${cita.servicios.precio.toLocaleString('es-CO')} COP
                      </p>
                    )}
                    <p className="text-indigo-600 font-medium mt-1">
                      {new Date(cita.fecha_hora).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })}
                    </p>
                    {cita.notas && <p className="text-gray-400 text-sm mt-1">Nota: {cita.notas}</p>}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoColores[cita.estado]}`}>
                    {cita.estado}
                  </span>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {cita.estado !== 'confirmada' && (
                    <button onClick={() => cambiarEstado(cita.id, 'confirmada')}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition">
                      Confirmar
                    </button>
                  )}
                  {cita.estado !== 'completada' && (
                    <button onClick={() => cambiarEstado(cita.id, 'completada')}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition">
                      Completada
                    </button>
                  )}
                  {cita.estado !== 'cancelada' && (
                    <button onClick={() => cambiarEstado(cita.id, 'cancelada')}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}