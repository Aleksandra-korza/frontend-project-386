import type { RouteObject } from 'react-router'
import App from './App'
import Loading from './components/Loading'
import RouteError from './components/RouteError'
import AdminPage from './pages/AdminPage'
import { adminLoader } from './pages/adminLoader'
import BookPage from './pages/BookPage'
import { createMeetingTypeAction } from './pages/createMeetingTypeAction'
import HomePage from './pages/HomePage'
import { meetingTypesLoader } from './pages/meetingTypesLoader'
import NotFoundPage from './pages/NotFoundPage'

// Маршруты приложения (ADR-0001, docs/specs/home-page.md, docs/specs/booking.md §6).
// Общие для браузера и тестов.
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: App,
    children: [
      { index: true, Component: HomePage },
      {
        path: 'book',
        loader: meetingTypesLoader,
        Component: BookPage,
        HydrateFallback: Loading,
        ErrorBoundary: RouteError,
      },
      {
        path: 'admin',
        loader: adminLoader,
        action: createMeetingTypeAction,
        Component: AdminPage,
        HydrateFallback: Loading,
        ErrorBoundary: RouteError,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
]
