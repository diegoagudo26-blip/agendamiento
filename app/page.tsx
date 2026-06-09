import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-5 border-b border-[#e5e5e5]">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight text-[#111]">Agenda<span className="text-amber-400">Fácil</span></span>
        </div>
        <Link href="/login" className="text-sm font-medium text-[#111] hover:text-amber-500 transition">
          Acceder →
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center">
        <div className="inline-block bg-amber-400 text-[#111] text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">
          Sistema de agendamiento
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-[#111] leading-none tracking-tight mb-6 max-w-3xl">
          Tu negocio.<br />
          <span className="text-amber-400">Sin filas.</span><br />
          Sin llamadas.
        </h1>
        <p className="text-[#6b6b6b] text-lg max-w-md mb-10 leading-relaxed">
          Tus clientes reservan en línea, tú recibes la cita confirmada. Así de simple.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login"
            className="bg-amber-400 text-[#111] font-bold px-8 py-4 rounded-xl hover:bg-amber-500 transition text-sm tracking-wide">
            Administrar mi negocio
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-16 border-t border-[#e5e5e5]">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '📅', title: 'Horarios inteligentes', desc: 'Solo muestra los slots disponibles. Sin cruces ni confusiones.' },
            { icon: '✉️', title: 'Notificaciones automáticas', desc: 'Tu cliente recibe confirmación por email al instante.' },
            { icon: '📊', title: 'Panel de control', desc: 'Confirma, cancela o completa citas desde cualquier dispositivo.' },
          ].map(f => (
            <div key={f.title} className="bg-white border border-[#e5e5e5] rounded-2xl p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-[#111] mb-2">{f.title}</h3>
              <p className="text-[#6b6b6b] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-[#e5e5e5] text-center text-xs text-[#a3a3a3]">
        AgendaFácil · Hecho para negocios colombianos
      </footer>
    </main>
  )
}