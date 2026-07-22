import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthProvider'
import { ParentAuthProvider } from './lib/ParentAuthProvider'
import { useAuth } from './lib/auth'
import { RequireAuth, StaffLayout } from './layouts/StaffLayout'
import { StaffLoginPage } from './pages/auth/StaffLoginPage'
import { AdministrationPage } from './pages/admin/AdministrationPage'
import { TeacherDailyPage } from './pages/teacher/TeacherDailyPage'
import { CounselorReviewPage } from './pages/counselor/CounselorReviewPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { ParentLoginPage } from './pages/parent/ParentLoginPage'
import { ParentPortalPage } from './pages/parent/ParentPortalPage'
import { ROLE_HOME } from './shared/accessControl'

function HomeRedirect() {
  const { role, isAuthenticated } = useAuth()
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME[role].homeHref} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ParentAuthProvider>
          <Routes>
            <Route path="/login" element={<StaffLoginPage />} />
            <Route path="/parent/login" element={<ParentLoginPage />} />
            <Route path="/parent-portal" element={<ParentPortalPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<StaffLayout />}>
                <Route index element={<HomeRedirect />} />
                <Route path="administration" element={<AdministrationPage />} />
                <Route path="teacher-daily" element={<TeacherDailyPage />} />
                <Route path="counselor-review" element={<CounselorReviewPage />} />
                <Route path="reports" element={<ReportsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </ParentAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
