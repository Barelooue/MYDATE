import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { NetlifyAuthBridge } from '@/components/auth/NetlifyAuthBridge'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage, SignUpPage } from '@/pages/auth/AuthPages'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { TaskBoardPage } from '@/pages/TaskBoardPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { AISchedulerPage } from '@/pages/AISchedulerPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <NetlifyAuthBridge />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<TaskBoardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route
              path="ai-scheduler"
              element={
                <ErrorBoundary title="AI 智能规划加载失败">
                  <AISchedulerPage />
                </ErrorBoundary>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
