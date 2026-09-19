import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/lib/auth-context'
import { RequireAuth, RequireSuperAdmin, RedirectIfAuthed } from '@/components/route-guards'
import { Toaster } from '@/components/ui/sonner'
import LandingPage from '@/pages/marketing/LandingPage'
import LandingPageV2 from '@/pages/marketing/v2/LandingPageV2'
import FeaturesPage from '@/pages/marketing/FeaturesPage'
import PricingPage from '@/pages/marketing/PricingPage'
import BlogsPage from '@/pages/marketing/BlogsPage'
import BlogPostPage from '@/pages/marketing/BlogPostPage'
import AboutPage from '@/pages/marketing/AboutPage'
import LegalPage from '@/pages/marketing/LegalPage'
import SignupPage from '@/pages/auth/SignupPage'
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import UpgradePage from '@/pages/dashboard/UpgradePage'
import AdminLayout from '@/pages/admin/AdminLayout'
import TenantsPage from '@/pages/admin/TenantsPage'
import UpgradeRequestsPage from '@/pages/admin/UpgradeRequestsPage'
import AppLinksPage from '@/pages/admin/AppLinksPage'
import PlansPage from '@/pages/admin/PlansPage'
import BillingPage from '@/pages/admin/BillingPage'
import AuditLogPage from '@/pages/admin/AuditLogPage'
import SuperAdminsPage from '@/pages/admin/SuperAdminsPage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="b2c-theme">
      <BrowserRouter>
        <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/v2" element={<LandingPageV2 />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/blogs" element={<BlogsPage />} />
          <Route path="/blogs/:slug" element={<BlogPostPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/signup"
            element={
              <RedirectIfAuthed>
                <SignupPage />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <LoginPage />
              </RedirectIfAuthed>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/legal/:slug" element={<LegalPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/upgrade" element={<UpgradePage />} />
          </Route>

          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<TenantsPage />} />
              <Route path="upgrade-requests" element={<UpgradeRequestsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="app-links" element={<AppLinksPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="super-admins" element={<SuperAdminsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
