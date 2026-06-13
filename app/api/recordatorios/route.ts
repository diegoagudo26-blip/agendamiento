import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const inicio = new Date(manana)
    inicio.setHours(0, 0, 0, 0)
    const fin = new Date(manana)
    fin.setHours(23, 59, 59, 999)

    const { data: citas } = await supabase
      .from('citas')
      .select('*, servicios(nombre, precio), negocios(nombre, email), profesionales(nombre)')
      .in('estado', ['nueva', 'confirmada'])
      .gte('fecha_hora', inicio.toISOString())
      .lte('fecha_hora', fin.toISOString())

    if (!citas || citas.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0 })
    }

    let enviados = 0
    for (const cita of citas) {
      if (!cita.cliente_email) continue

      const fecha = new Date(cita.fecha_hora).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })

      await resend.emails.send({
        from: 'AgendaFácil <onboarding@resend.dev>',
        to: cita.cliente_email,
        subject: `Recordatorio: tu cita es mañana`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">⏰ Recordatorio de cita</h2>
            <p>Hola <strong>${cita.cliente_nombre}</strong>, te recordamos que tienes una cita mañana.</p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Negocio:</strong> ${cita.negocios?.nombre}</p>
              <p style="margin: 4px 0;"><strong>Servicio:</strong> ${cita.servicios?.nombre}</p>
              ${cita.profesionales ? `<p style="margin: 4px 0;"><strong>Con:</strong> ${cita.profesionales.nombre}</p>` : ''}
              <p style="margin: 4px 0;"><strong>Fecha y hora:</strong> ${fecha}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Si necesitas cancelar o reprogramar, contáctanos.</p>
          </div>
        `
      })
      enviados++
    }

    return NextResponse.json({ ok: true, enviados })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }
}