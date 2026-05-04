import { lazy, Suspense } from 'react'
import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from './lib/router'
import { AppLoadingScreen } from './AppLoadingScreen'

const AdminEntry = lazy(() => import('./AdminEntry'))

function withSuspense(element: ReactElement) {
  return <Suspense fallback={<AppLoadingScreen />}>{element}</Suspense>
}

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/site" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/site" replace />} />
      <Route path="/admin/site" element={withSuspense(<AdminEntry section="site" />)} />
      <Route path="/admin/content" element={withSuspense(<AdminEntry section="content" />)} />
      <Route path="/admin/plugins" element={withSuspense(<AdminEntry section="plugins" />)} />
      <Route
        path="/admin/plugins/:pluginId/:pageId"
        element={withSuspense(<AdminEntry section="pluginPage" />)}
      />
    </Routes>
  )
}
