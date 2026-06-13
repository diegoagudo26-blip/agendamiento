'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Cita = {
  id: string
  cliente_nombre: string
  cliente_email: string
  cliente_telefono: string
  fecha_hora: string
  estado: string
  notas: string
  servicios: { nombre: string; precio: number } | null
  profesionales: { nombre: string } | null
}

type Negocio = { id: string; nombre: string; slug: string; logo_url: string }

const estadoColores: Record<string, string> = {
  nueva: 'bg-blue-100 text-blue-700',
  confirmada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  completada: 'bg-gray-100 text-gray-500',
}

const estadoLabels: Record<string, string> = {
  nueva: 'Nueva',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Completada',
}

export default function Admin() {
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  const cargarDatos = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: negocioData } = await supabase.from('negocios').select('*').eq('user_id', session.user.id).single()
    if (!negocioData) { router.push('/login'); return }
    setNegocio(negocioData)
    const { data: citasData } = await supabase
      .from('citas')
      .select('*, servicios(nombre, precio), profesionales(nombre)')
      .eq('negocio_id', negocioData.id)
      .order('fecha_hora', { ascending: true })
    setCitas(citasData || [])
    setCargando(false)
  }, [router])

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', id)
    
    if (nuevoEstado === 'completada') {
      const cita = citas.find(c => c.id === id)
      if (cita?.cliente_email) {
        await fetch('/api/enviar-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'agradecimiento',
            cliente_nombre: cita.cliente_nombre,
            cliente_email: cita.cliente_email,
            negocio_nombre: negocio?.nombre
          })
        })
      }
    }
    
    cargarDatos()
  }

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const citasFiltradas = filtro === 'todos' ? citas : citas.filter(c => c.estado === filtro)

  const stats = [
    { label: 'Total', value: citas.length, color: 'text-[#111]' },
    { label: 'Nuevas', value: citas.filter(c => c.estado === 'nueva' || c.estado === 'pendiente').length, color: 'text-blue-600' },
    { label: 'Confirmadas', value: citas.filter(c => c.estado === 'confirmada').length, color: 'text-green-600' },
    { label: 'Completadas', value: citas.filter(c => c.estado === 'completada').length, color: 'text-gray-500' },
  ]

  return (
    <main className="min-h-screen bg-[#fafafa]">
     

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-white border border-[#e5e5e5] rounded-xl p-4 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['todos', 'nueva', 'confirmada', 'completada', 'cancelada'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition ${filtro === f ? 'bg-amber-400 text-[#111]' : 'bg-white text-gray-500 border border-[#e5e5e5] hover:border-amber-300'}`}>
              {f === 'todos' ? 'Todas' : estadoLabels[f]}
            </button>
          ))}
        </div>

        {/* Tabla */}
        {cargando ? (
          <p className="text-gray-400 text-sm">Cargando...</p>
        ) : citasFiltradas.length === 0 ? (
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-12 text-center">
            <p className="text-gray-400">No hay citas en esta categoría.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Servicio</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Profesional</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha y hora</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citasFiltradas.map((cita, i) => (
                  <tr key={cita.id} className={`border-b border-[#f0f0f0] hover:bg-amber-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#111] text-sm">{cita.cliente_nombre}</p>
                      <p className="text-gray-400 text-xs">{cita.cliente_telefono}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[#111]">{cita.servicios?.nombre || '—'}</p>
                      <p className="text-xs text-amber-500 font-bold">${cita.servicios?.precio.toLocaleString('es-CO')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[#111]">{cita.profesionales?.nombre || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[#111] font-medium">
                        {new Date(cita.fecha_hora).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(cita.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${estadoColores[cita.estado] || estadoColores['nueva']}`}>
                        {estadoLabels[cita.estado] || 'Nueva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {cita.estado !== 'confirmada' && cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                          <button onClick={() => cambiarEstado(cita.id, 'confirmada')}
                            className="bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-green-600 transition">
                            Confirmar
                          </button>
                        )}
                        {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                          <button onClick={() => cambiarEstado(cita.id, 'completada')}
                            className="bg-gray-400 text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-gray-500 transition">
                            Completar
                          </button>
                        )}
                        {cita.estado !== 'cancelada' && cita.estado !== 'completada' && (
                          <button onClick={() => cambiarEstado(cita.id, 'cancelada')}
                            className="bg-red-400 text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-red-500 transition">
                            Cancelar
                          </button>
                        )}
                      </div>
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