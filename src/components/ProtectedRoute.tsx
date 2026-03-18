import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

// ─────────────────────────────────────────────
// Full-page skeleton loader
// ─────────────────────────────────────────────
const FullPageSkeleton: React.FC = () => (
  <div className="flex min-h-screen bg-slate-50">
    {/* Sidebar skeleton */}
    <div className="w-[280px] bg-[#0D1117] flex-shrink-0 flex flex-col p-4 gap-3">
      <div className="skeleton h-10 w-32 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.06)' }} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton h-9 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
      ))}
    </div>
    {/* Main content skeleton */}
    <div className="flex-1 p-8 flex flex-col gap-6">
      <div className="skeleton h-9 w-64 rounded-xl" />
      <div className="skeleton h-5 w-48 rounded-lg" />
      <div className="grid grid-cols-4 gap-4 mt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-2xl mt-2" />
    </div>
  </div>
);

// ─────────────────────────────────────────────
// 403 Forbidden inline content
// ─────────────────────────────────────────────
const ForbiddenContent: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
    <div className="text-7xl font-extrabold text-slate-200 select-none">403</div>
    <h1 className="text-2xl font-bold text-slate-800">Akses Ditolak</h1>
    <p className="text-slate-500 text-sm text-center max-w-xs">
      Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi administrator jika ini adalah kesalahan.
    </p>
    <a href="/" className="btn-primary mt-2">
      Kembali ke Dashboard
    </a>
  </div>
);

// ─────────────────────────────────────────────
// ProtectedRoute
// ─────────────────────────────────────────────
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading, hasRole } = useAuth();
  const location = useLocation();

  // 1. Loading state — show skeleton
  if (loading) {
    return <FullPageSkeleton />;
  }

  // 2. Not authenticated — redirect to sign-in
  if (!user) {
    return <Navigate to="/masuk" state={{ from: location }} replace />;
  }

  // 3. Tenant setup incomplete — redirect to onboarding
  //    (profile.tenant is populated when tenant exists; check setup_completed)
  if (profile?.tenant && !profile.tenant.setup_completed) {
    // Avoid redirect loop if already on /onboarding
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // 4. Authenticated but insufficient role
  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return <ForbiddenContent />;
  }

  // 5. All good
  return <>{children}</>;
};

export default ProtectedRoute;
