import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { 
    tipo,
    cliente_nombre, 
    cliente_email, 
    cliente_telefono, 
    fecha_hora, 
    servicio_nombre, 
    servicio_precio, 
    notas, 
    negocio_email,
    negocio_nombre,
    cita_id
  } = await request.json()

  const fechaFormateada = new Date(fecha_hora).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://agendamiento-peach.vercel.app'
  const urlCancelar = `${baseUrl}/cita/${cita_id}?accion=cancelar`
  const urlConfirmar = `${baseUrl}/cita/${cita_id}?accion=confirmar`

  try {
    if (tipo === 'agradecimiento') {
      await resend.emails.send({
        from: 'AgendaFácil <onboarding@resend.dev>',
        to: cliente_email,
        subject: `¡Gracias por visitarnos, ${cliente_nombre}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">⭐ ¡Gracias por tu visita!</h2>
            <p>Hola <strong>${cliente_nombre}</strong>, fue un placer atenderte hoy en <strong>${negocio_nombre || 'nuestro negocio'}</strong>.</p>
            <p>Esperamos que hayas quedado satisfecho con tu servicio. ¡Te esperamos pronto!</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Agendado con AgendaFácil</p>
          </div>
        `
      })
      return NextResponse.json({ ok: true })
    }

    // Email al negocio
    await resend.emails.send({
      from: 'AgendaFácil <onboarding@resend.dev>',
      to: negocio_email || process.env.ADMIN_EMAIL!,
      subject: `Nueva cita: ${cliente_nombre}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">📅 Nueva cita agendada</h2>
          <p><strong>Cliente:</strong> ${cliente_nombre}</p>
          <p><strong>Teléfono:</strong> ${cliente_telefono}</p>
          <p><strong>Email:</strong> ${cliente_email}</p>
          <p><strong>Servicio:</strong> ${servicio_nombre} — $${Number(servicio_precio).toLocaleString('es-CO')} COP</p>
          <p><strong>Fecha y hora:</strong> ${fechaFormateada}</p>
          ${notas ? `<p><strong>Notas:</strong> ${notas}</p>` : ''}
        </div>
      `
    })

    // Email al cliente
    if (cliente_email) {
      await resend.emails.send({
        from: 'AgendaFácil <onboarding@resend.dev>',
        to: cliente_email,
        subject: '¡Tu cita fue agendada!',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #f59e0b;">✅ ¡Cita confirmada!</h2>
            <p>Hola <strong>${cliente_nombre}</strong>, tu cita quedó agendada.</p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Servicio:</strong> ${servicio_nombre}</p>
              <p style="margin: 4px 0;"><strong>Precio:</strong> $${Number(servicio_precio).toLocaleString('es-CO')} COP</p>
              <p style="margin: 4px 0;"><strong>Fecha y hora:</strong> ${fechaFormateada}</p>
              ${notas ? `<p style="margin: 4px 0;"><strong>Notas:</strong> ${notas}</p>` : ''}
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px;">
              <a href="${urlConfirmar}" style="flex: 1; background: #f59e0b; color: #111; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: 900; text-align: center; display: block;">
                ✅ Confirmar asistencia
              </a>
              <a href="${urlCancelar}" style="flex: 1; background: #f3f4f6; color: #374151; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: 700; text-align: center; display: block;">
                ❌ Cancelar cita
              </a>
            </div>

            <p style="color: #6b7280; font-size: 12px; margin-top: 24px; text-align: center;">
              Agendado con <a href="${baseUrl}" style="color: #f59e0b;">AgendaFácil</a>
            </p>
          </div>
        `
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
} 