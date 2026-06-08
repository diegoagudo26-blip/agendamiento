import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-indigo-700 mb-2">AgendaFácil</h1>
        <p className="text-gray-500 mb-8">Gestiona tus citas de forma simple y profesional</p>
        
        <div className="flex flex-col gap-4">
          <Link href="/agendar" className="bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 transition">
            Reservar una cita
          </Link>
          <Link href="/admin" className="bg-white border-2 border-indigo-600 text-indigo-600 py-3 px-6 rounded-xl font-semibold hover:bg-indigo-50 transition">
            Panel de administración
          </Link>
        </div>
      </div>
    </main>
  )
}