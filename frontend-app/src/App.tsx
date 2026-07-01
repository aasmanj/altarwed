import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { AuthProvider } from '@/core/auth/AuthContext'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { AdminRoute } from '@/core/auth/AdminRoute'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'
import CoupleDashboard from '@/features/couple/CoupleDashboard'
import VendorDashboard from '@/features/vendor/VendorDashboard'
import RegisterVendorPage from '@/features/vendor/RegisterVendorPage'
import VendorListingPage from '@/features/vendor/VendorListingPage'
import InquiriesPage from '@/features/vendor/InquiriesPage'
import VendorSubscriptionPage from '@/features/vendor/VendorSubscriptionPage'
import WeddingWebsitePage from '@/features/couple/website/WeddingWebsitePage'
import SideBySideEditor from '@/features/couple/website/blocks/SideBySideEditor'
import GuestListPage from '@/features/couple/guests/GuestListPage'
import ChecklistPage from '@/features/couple/checklist/ChecklistPage'
import WeddingPartyPage from '@/features/couple/weddingparty/WeddingPartyPage'
import BudgetPage from '@/features/couple/budget/BudgetPage'
import SaveTheDatePage from '@/features/couple/savethedate/SaveTheDatePage'
import PhotosPage from '@/features/couple/photos/PhotosPage'
import SeatingPage from '@/features/couple/seating/SeatingPage'
import SeatingBoardPage from '@/features/couple/seating/SeatingBoardPage'
import ScripturePage from '@/features/couple/scripture/ScripturePage'
import VowsPage from '@/features/couple/vows/VowsPage'
import CeremonyPage from '@/features/couple/ceremony/CeremonyPage'
import CeremonyProgramPage from '@/features/couple/ceremony/CeremonyProgramPage'
import CommunicationsPage from '@/features/couple/communications/CommunicationsPage'
import AdminMetricsPage from '@/features/admin/AdminMetricsPage'
import SettingsPage from '@/features/couple/settings/SettingsPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: 'easeInOut' }}
      >
        <Routes location={location}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register/vendor" element={<RegisterVendorPage />} />

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
            path="/dashboard/website/editor"
            element={
              <ProtectedRoute role="COUPLE">
                <SideBySideEditor />
              </ProtectedRoute>
            }
          />
          {/* Legacy path, keep alive in case any old links reference /builder. */}
          <Route
            path="/dashboard/website/builder"
            element={<Navigate to="/dashboard/website/editor" replace />}
          />
          <Route
            path="/dashboard/checklist"
            element={
              <ProtectedRoute role="COUPLE">
                <ChecklistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/wedding-party"
            element={
              <ProtectedRoute role="COUPLE">
                <WeddingPartyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/budget"
            element={
              <ProtectedRoute role="COUPLE">
                <BudgetPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/save-the-date"
            element={
              <ProtectedRoute role="COUPLE">
                <SaveTheDatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/photos"
            element={
              <ProtectedRoute role="COUPLE">
                <PhotosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/seating"
            element={
              <ProtectedRoute role="COUPLE">
                <SeatingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/seating/board"
            element={
              <ProtectedRoute role="COUPLE">
                <SeatingBoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/scripture"
            element={
              <ProtectedRoute role="COUPLE">
                <ScripturePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/vows"
            element={
              <ProtectedRoute role="COUPLE">
                <VowsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/communications"
            element={
              <ProtectedRoute role="COUPLE">
                <CommunicationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/ceremony"
            element={
              <ProtectedRoute role="COUPLE">
                <CeremonyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/ceremony/program"
            element={
              <ProtectedRoute role="COUPLE">
                <CeremonyProgramPage />
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
          <Route
            path="/vendor/listing"
            element={
              <ProtectedRoute role="VENDOR">
                <VendorListingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/inquiries"
            element={
              <ProtectedRoute role="VENDOR">
                <InquiriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/subscription"
            element={
              <ProtectedRoute role="VENDOR">
                <VendorSubscriptionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute role="COUPLE">
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/metrics"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminMetricsPage />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
    </>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <ConfirmProvider>
            {/* Toast notifications, sonner. Top-right placement is consistent with
                Vercel/Linear/Cal.com; bottom-right reads as a chat notification. */}
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast: 'font-sans',
                  title: 'font-medium',
                },
              }}
            />
            <AnimatedRoutes />
          </ConfirmProvider>
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
