import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            if (data.session) {
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBootstrapProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Silakan login terlebih dahulu untuk membuat profil Admin.');
            return;
        }

        const { error } = await supabase.from('user_profiles').insert({
            id: user.id,
            username: user.email?.split('@')[0],
            nama_lengkap: 'Administrator',
            role: 'Admin',
            status_aktif: true
        });

        if (error) {
            if (error.code === '23505') alert('Profil sudah ada.');
            else alert('Gagal: ' + error.message);
        } else {
            alert('Profil Admin berhasil dibuat! Silakan refresh.');
            window.location.reload();
        }
    };

    return (
        <div className="login-v2">
            <div className="login-v2-bg">
                <div className="glow-1"></div>
                <div className="glow-2"></div>
            </div>

            <div className="login-v2-container glass-effect">
                <div className="login-v2-header">
                    <div className="login-v2-logo">
                        <Sparkles size={24} color="white" />
                    </div>
                    <h1>Selamat Datang</h1>
                    <p>Sistem Informasi SPT & SPPD Terintegrasi</p>
                </div>

                {error && (
                    <div className="login-v2-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-v2-form">
                    <div className="form-group">
                        <label className="form-label">Alamat Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="nama@institusi.go.id"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Kata Sandi</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button className="btn btn-primary login-v2-btn" disabled={loading}>
                        {loading ? <Loader2 className="spin" size={20} /> : <><LogIn size={20} /> Masuk ke Sistem</>}
                    </button>
                </form>

                <div className="login-v2-footer">
                    <div className="secure-badge">
                        <ShieldCheck size={14} />
                        Secure Authentication
                    </div>
                    <button onClick={handleBootstrapProfile} className="bootstrap-btn">
                        Inisialisasi Profil Admin
                    </button>
                </div>
            </div>

            <style>{`
        .login-v2 {
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          position: fixed;
          top: 0; left: 0;
          z-index: 2000;
          overflow: hidden;
        }
        .login-v2-bg {
          position: absolute;
          width: 100%; height: 100%;
          z-index: 0;
        }
        .glow-1 {
          position: absolute;
          top: -10%; left: -10%;
          width: 60%; height: 60%;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
          filter: blur(80px);
        }
        .glow-2 {
          position: absolute;
          bottom: -10%; right: -10%;
          width: 60%; height: 60%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
          filter: blur(80px);
        }
        .login-v2-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          padding: 48px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .login-v2-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-v2-logo {
          width: 56px;
          height: 56px;
          background: var(--p-primary);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .login-v2-header h1 {
          font-size: 28px;
          margin: 0;
          color: var(--p-primary);
          letter-spacing: -1px;
        }
        .login-v2-header p {
          color: var(--p-text-muted);
          font-size: 14px;
          margin: 8px 0 0;
          font-weight: 500;
        }
        .login-v2-error {
          background: #fee2e2;
          color: #991b1b;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #fecaca;
        }
        .login-v2-btn {
          width: 100%;
          height: 52px;
          margin-top: 12px;
          font-size: 16px;
        }
        .login-v2-footer {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .secure-badge {
          font-size: 12px;
          font-weight: 800;
          color: var(--p-text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .bootstrap-btn {
          background: transparent;
          border: none;
          color: var(--p-accent);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-p);
        }
        .bootstrap-btn:hover {
          color: var(--p-accent-deep);
          text-decoration: underline;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

export default Login;
