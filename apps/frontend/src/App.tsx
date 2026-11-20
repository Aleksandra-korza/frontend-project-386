import { Outlet, useNavigation } from 'react-router'
import Loading from '@/components/Loading'
import SiteHeader from '@/components/SiteHeader'

// Макет всех страниц: шапка, индикатор загрузки над текущей страницей, страница.
function App() {
  // Переход на страницу, которая загружает данные (loader).
  const isLoading = useNavigation().state === 'loading'

  return (
    <div className="bg-page flex min-h-svh flex-col">
      <SiteHeader />
      <main
        aria-busy={isLoading}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-16"
      >
        {isLoading && (
          <div className="mb-6">
            <Loading />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

export default App
