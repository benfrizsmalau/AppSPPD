import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

// ─────────────────────────────────────────────
// React Query client
// ─────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
    },
  },
});

// ─────────────────────────────────────────────
// Lazy page imports
// ─────────────────────────────────────────────

// Public pages
const Login            = lazy(() => import('./pages/Login'));
const Register         = lazy(() => import('./pages/Register'));
const RegisterSukses   = lazy(() => import('./pages/RegisterSukses'));
const ForgotPassword   = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword    = lazy(() => import('./pages/ResetPassword'));

// Protected pages
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const SPTList          = lazy(() => import('./pages/SPTList'));
const SPTForm          = lazy(() => import('./pages/SPTForm'));
const SPTDetail        = lazy(() => import('./pages/SPTDetail'));
const SPPDList         = lazy(() => import('./pages/SPPDList'));
const SPPDForm         = lazy(() => import('./pages/SPPDForm'));
const SPPDDetail       = lazy(() => import('./pages/SPPDDetail'));
const PegawaiList      = lazy(() => import('./pages/PegawaiList'));
const RiwayatDokumen   = lazy(() => import('./pages/RiwayatDokumen'));
const Laporan          = lazy(() => import('./pages/Laporan'));
const DocumentRenderer = lazy(() => import('./pages/DocumentRenderer'));
const Settings         = lazy(() => import('./pages/Settings'));
const UserManagement   = lazy(() => import('./pages/UserManagement'));
const AuditLog         = lazy(() => import('./pages/AuditLog'));
const Onboarding       = lazy(() => import('./pages/Onboarding'));
const ProfilPengguna   = lazy(() => import('./pages/ProfilPengguna'));

// ─────────────────────────────────────────────
// Page skeleton (Suspense fallback)
// ─────────────────────────────────────────────
const PageSkeleton: React.FC = () => (
  <div className="page-container flex flex-col gap-6 animate-pulse">
    <div className="skeleton h-9 w-56 rounded-xl" />
    <div className="skeleton h-5 w-36 rounded-lg" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton h-28 rounded-2xl" />
      ))}
    </div>
    <div className="skeleton h-72 rounded-2xl" />
  </div>
);

// ─────────────────────────────────────────────
// Layout — sidebar + main area
// ─────────────────────────────────────────────
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />
      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* ── Public routes (no sidebar) ── */}
            <Route
              path="/masuk"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Login />
                </Suspense>
              }
            />
            {/* Additional public-facing auth routes */}
            <Route
              path="/daftar"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Register />
                </Suspense>
              }
            />
            <Route
              path="/daftar/sukses"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <RegisterSukses />
                </Suspense>
              }
            />
            <Route
              path="/verifikasi-email"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Login />
                </Suspense>
              }
            />
            <Route
              path="/lupa-password"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ForgotPassword />
                </Suspense>
              }
            />
            <Route
              path="/atur-ulang-password"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ResetPassword />
                </Suspense>
              }
            />
            <Route
              path="/bergabung"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Login />
                </Suspense>
              }
            />

            {/* ── Protected routes (with sidebar) ── */}

            {/* Dashboard */}
            <Route
              path="/"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <Dashboard />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* SPT */}
            <Route
              path="/spt"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPTList />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/spt/new"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPTForm />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/spt/edit/:id"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPTForm />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/spt/:id"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPTDetail />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* SPPD */}
            <Route
              path="/sppd"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPPDList />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/sppd/new"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPPDForm />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/sppd/edit/:id"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPPDForm />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/sppd/:id"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <SPPDDetail />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Data */}
            <Route
              path="/pegawai"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <PegawaiList />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/riwayat"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <RiwayatDokumen />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/laporan"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <Laporan />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Document print (sidebar hidden for print view — Layout still included for margin management) */}
            <Route
              path="/print/:type/:id"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <DocumentRenderer />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Settings */}
            <Route
              path="/settings"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <Settings />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/settings/users"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <UserManagement />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />
            <Route
              path="/settings/audit"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <AuditLog />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Onboarding (Admin only — ProtectedRoute handles tenant redirect) */}
            <Route
              path="/onboarding"
              element={
                <Layout>
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <Onboarding />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* User profile */}
            <Route
              path="/profil"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <ProfilPengguna />
                    </Suspense>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
