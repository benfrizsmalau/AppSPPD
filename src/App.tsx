import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SPTList from './pages/SPTList';
import SPTForm from './pages/SPTForm';
import SPPDList from './pages/SPPDList';
import SPPDForm from './pages/SPPDForm';
import RiwayatDokumen from './pages/RiwayatDokumen';
import DocumentRenderer from './pages/DocumentRenderer';
import PegawaiList from './pages/PegawaiList';
import Laporan from './pages/Laporan';
import Settings from './pages/Settings';
import './index.css';

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content-area">
        <div className="content-wrapper">
          {children}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/spt" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                <SPTList />
              </ProtectedRoute>
            } />

            <Route path="/spt/new" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                <SPTForm />
              </ProtectedRoute>
            } />

            <Route path="/spt/edit/:id" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                <SPTForm />
              </ProtectedRoute>
            } />

            <Route path="/sppd" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                <SPPDList />
              </ProtectedRoute>
            } />

            <Route path="/sppd/new" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                <SPPDForm />
              </ProtectedRoute>
            } />

            <Route path="/sppd/edit/:id" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                <SPPDForm />
              </ProtectedRoute>
            } />

            <Route path="/riwayat" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                <RiwayatDokumen />
              </ProtectedRoute>
            } />

            <Route path="/pegawai" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                <PegawaiList />
              </ProtectedRoute>
            } />

            <Route path="/print/:type/:id" element={
              <ProtectedRoute>
                <DocumentRenderer />
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                <Settings />
              </ProtectedRoute>
            } />

            <Route path="/laporan" element={
              <ProtectedRoute allowedRoles={['Admin', 'Operator', 'Pejabat']}>
                <Laporan />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
