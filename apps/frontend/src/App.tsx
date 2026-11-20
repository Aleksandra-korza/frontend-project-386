import { Outlet } from 'react-router'
import ServiceStatus from '@/components/ServiceStatus'
import SiteHeader from '@/components/SiteHeader'

// Макет всех страниц: шапка, страница, подвал со статусом сервиса.
function App() {
  return (
    <div className="bg-page flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-muted-foreground sm:px-6">
        <ServiceStatus />
      </footer>
    </div>
  )
}

export default App
