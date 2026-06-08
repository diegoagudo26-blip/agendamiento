import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { cliente_nombre, cliente_email, cliente_telefono, fecha_hora, servicio_nombre, servicio_precio, notas, negocio_email } = await request.json()

  const fechaFormateada = new Date(fecha_hora).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })

  try {
    // Email al negocio (barbero)
    await resend.emails.send({
      from: 'AgendaFácil <onboarding@resend.dev>',
      to: negocio_email || process.env.ADMIN_EMAIL!,
      subject: `Nueva cita: ${cliente_nombre}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #4338ca;">📅 Nueva cita agendada</h2>
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
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #4338ca;">✅ ¡Cita confirmada!</h2>
            <p>Hola <strong>${cliente_nombre}</strong>, tu cita quedó agendada.</p>
            <p><strong>Servicio:</strong> ${servicio_nombre}</p>
            <p><strong>Precio:</strong> $${Number(servicio_precio).toLocaleString('es-CO')} COP</p>
            <p><strong>Fecha y hora:</strong> ${fechaFormateada}</p>
            ${notas ? `<p><strong>Notas:</strong> ${notas}</p>` : ''}
            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Te contactaremos para confirmar tu cita.</p>
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