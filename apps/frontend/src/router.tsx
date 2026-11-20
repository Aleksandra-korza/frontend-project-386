import type { RouteObject } from 'react-router'
import App from './App'
import Loading from './components/Loading'
import RouteError from './components/RouteError'
import AdminPage from './pages/AdminPage'
import { adminLoader } from './pages/adminLoader'
import BookPage from './pages/BookPage'
import { createMeetingTypeAction } from './pages/createMeetingTypeAction'
import ChooseSlotPage from './pages/ChooseSlotPage'
import ConfirmBookingPage from './pages/ConfirmBookingPage'
import { confirmBookingLoader } from './pages/confirmBookingLoader'
import { createBookingAction } from './pages/createBookingAction'
import {
  chooseSlotLoader,
  chooseSlotShouldRevalidate,
} from './pages/chooseSlotLoader'
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
        path: 'book/:typeId',
        loader: chooseSlotLoader,
        shouldRevalidate: chooseSlotShouldRevalidate,
        Component: ChooseSlotPage,
        HydrateFallback: Loading,
        ErrorBoundary: RouteError,
      },
      {
        path: 'book/:typeId/confirm',
        loader: confirmBookingLoader,
        action: createBookingAction,
        Component: ConfirmBookingPage,
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
