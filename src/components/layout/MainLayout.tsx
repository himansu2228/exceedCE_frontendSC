import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useEffect, useState } from 'react'

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="brand-shell relative flex h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="premium-float absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-300/25 blur-3xl" />
        <div className="premium-float-delayed absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-amber-300/20 blur-3xl" />
        <div className="premium-float-slow absolute left-1/3 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-sky-200/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full w-full">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

        {mobileMenuOpen && (
          <button
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
            aria-label="Close sidebar"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setMobileMenuOpen((prev) => !prev)} mobileMenuOpen={mobileMenuOpen} />
          <main key={location.pathname} className="premium-enter flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
