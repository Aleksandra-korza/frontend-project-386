import type { RouteObject } from 'react-router'
import App from './App'
import BookPage from './pages/BookPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

// Маршруты приложения (ADR-0001, docs/specs/home-page.md). Общие для браузера и тестов.
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: App,
    children: [
      { index: true, Component: HomePage },
      { path: 'book', Component: BookPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]
