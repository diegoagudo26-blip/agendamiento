'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function CitaAccion() {
  const { citaId } = useParams()
  const searchParams = useSearchParams()
  const accion = searchParams.get('accion')
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error' | 'ya_procesado'>('cargando')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const procesar = async () => {
      const { data: cita } = await supabase
        .from('citas')
        .select('estado')
        .eq('id', citaId)
        .single()

      if (!cita) { setEstado('error'); setMensaje('No encontramos esta cita.'); return }

      if (cita.estado === 'cancelada') {
        setEstado('ya_procesado')
        setMensaje('Esta cita ya fue cancelada anteriormente.')
        return
      }

      if (accion === 'confirmar' && cita.estado === 'confirmada') {
        setEstado('ya_procesado')
        setMensaje('Esta cita ya estaba confirmada.')
        return
      }

      const nuevoEstado = accion === 'cancelar' ? 'cancelada' : 'confirmada'
      const { error } = await supabase
        .from('citas')
        .update({ estado: nuevoEstado })
        .eq('id', citaId)

      if (error) { setEstado('error'); setMensaje('Hubo un error, intenta de nuevo.'); return }

      setEstado('ok')
      setMensaje(accion === 'cancelar'
        ? 'Tu cita fue cancelada exitosamente.'
        : '¡Asistencia confirmada! Te esperamos.')
    }

    if (citaId && accion) procesar()
  }, [citaId, accion])

  const esExito = estado === 'ok'
  const emoji = accion === 'cancelar' ? '❌' : '✅'

  return (
    <main className="min-h-screen bg-[#fafafa] flex items-center justify-center p-8">
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-12 max-w-md w-full text-center">
        {estado === 'cargando' ? (
          <>
            <p className="text-4xl mb-4">⏳</p>
            <p className="text-gray-500">Procesando...</p>
          </>
        ) : (
          <>
            <p className="text-5xl mb-4">{estado === 'error' ? '😕' : emoji}</p>
            <h2 className="text-xl font-black text-[#111] mb-2">
              {estado === 'error' ? 'Algo salió mal' : estado === 'ya_procesado' ? 'Ya procesado' : esExito ? '¡Listo!' : ''}
            </h2>
            <p className="text-gray-500">{mensaje}</p>
            <p style={{marginTop: '24px'}} className="text-xs text-gray-400">
              Agendado con <a href="/" className="text-amber-500 font-bold">AgendaFácil</a>
            </p>
          </>
        )}
      </div>
    </main>
  )
}