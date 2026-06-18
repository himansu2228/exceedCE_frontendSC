import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useEffect, useState } from 'react'

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    <div className="brand-shell flex h-screen overflow-hidden">
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
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
