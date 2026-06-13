'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

type Negocio = { id: string; nombre: string; logo_url: string; slug: string }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [negocio, setNegocio] = useState<Negocio | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase.from('negocios').select('*').eq('user_id', session.user.id).single()
      if (data) setNegocio(data)
    }
    cargar()
  }, [router])

  const links = [
    { href: '/admin', label: 'Citas', icon: '📅' },
    { href: '/admin/servicios', label: 'Servicios', icon: '✂️' },
    { href: '/admin/horarios', label: 'Horarios', icon: '🕐' },
    { href: '/admin/profesionales', label: 'Profesionales', icon: '👤' },
    { href: '/admin/configuracion', label: 'Configuración', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-[#e5e5e5] flex flex-col fixed h-full">
        {/* Logo y nombre */}
        <div className="px-5 py-5 border-b border-[#e5e5e5]">
          {negocio?.logo_url ? (
            <img src={negocio.logo_url} alt="logo" className="h-10 w-auto object-contain mb-2" />
          ) : (
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center font-black text-[#111] text-lg mb-2">
              {negocio?.nombre?.charAt(0) || 'A'}
            </div>
          )}
          <p className="font-black text-[#111] text-sm leading-tight">{negocio?.nombre || '...'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Panel de administración</p>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {links.map(link => {
            const activo = pathname === link.href
            return (
              <Link key={link.href} href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${activo ? 'bg-amber-400 text-[#111] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#111]'}`}>
                <span className="text-base">{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer del sidebar */}
        <div className="px-3 py-4 border-t border-[#e5e5e5] flex flex-col gap-2">
          {negocio?.slug && (
            <Link href={`/negocio/${negocio.slug}`} target="_blank"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 transition">
              <span>↗</span> Ver formulario
            </Link>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition">
            <span>→</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="ml-56 flex-1">
        {children}
      </div>
    </div>
  )
}