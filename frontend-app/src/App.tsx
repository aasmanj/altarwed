import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/core/auth/AuthContext'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'
import CoupleDashboard from '@/features/couple/CoupleDashboard'
import VendorDashboard from '@/features/vendor/VendorDashboard'
import WeddingWebsitePage from '@/features/couple/website/WeddingWebsitePage'
import GuestListPage from '@/features/couple/guests/GuestListPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="COUPLE">
                <CoupleDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/guests"
            element={
              <ProtectedRoute role="COUPLE">
                <GuestListPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/website"
            element={
              <ProtectedRoute role="COUPLE">
                <WeddingWebsitePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/vendor"
            element={
              <ProtectedRoute role="VENDOR">
                <VendorDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
