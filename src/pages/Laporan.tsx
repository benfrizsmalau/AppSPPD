import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import {
    FileBarChart,
    Download,
    Filter,
    Calendar,
    Loader2
} from 'lucide-react';

const Laporan: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState<any[]>([]);
    const [filter, setFilter] = useState({
        type: 'pegawai',
        startDate: format(new Date(), 'yyyy-MM-01'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('sppd')
                .select(`
                    *,
                    pegawai:pegawai_id(*),
                    instansi:instansi_id(*),
                    spt:spt_id(*)
                `)
                .gte('tanggal_berangkat', filter.startDate)
                .lte('tanggal_berangkat', filter.endDate);

            const { data, error } = await query;
            if (error) throw error;
            setReports(data || []);
        } catch (error) {
            console.error('Error fetching report:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [filter.type]);

    const handleExport = () => {
        alert('Fitur ekspor ke Excel sedang disiapkan.');
    };

    return (
        <div className="laporan-page">
            <div className="page-header">
                <div>
                    <h1>Laporan & Rekapitulasi</h1>
                    <p className="subtitle">Hasilkan rekapitulasi perjalanan dinas berdasarkan berbagai kategori.</p>
                </div>
                <button onClick={handleExport} className="btn btn-outline" disabled={reports.length === 0}>
                    <Download size={18} /> Ekspor Excel
                </button>
            </div>

            <div className="report-controls card glass-effect">
                <div className="filter-grid">
                    <div className="filter-item">
                        <label>Jenis Rekap</label>
                        <select
                            value={filter.type}
                            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                            className="form-input"
                        >
                            <option value="pegawai">Per Pegawai</option>
                            <option value="unit">Per Unit Kerja</option>
                            <option value="tujuan">Per Tujuan</option>
                            <option value="anggaran">Per Mata Anggaran</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <label>Dari Tanggal</label>
                        <div className="input-with-icon">
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={filter.startDate}
                                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                                className="form-input"
                            />
                        </div>
                    </div>
                    <div className="filter-item">
                        <label>Sampai Tanggal</label>
                        <div className="input-with-icon">
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={filter.endDate}
                                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                                className="form-input"
                            />
                        </div>
                    </div>
                    <div className="filter-item action">
                        <button onClick={fetchReport} className="btn btn-primary w-full">
                            <Filter size={18} /> Terapkan Filter
                        </button>
                    </div>
                </div>
            </div>

            <div className="report-results card no-padding">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spin" size={32} />
                        <p>Menghitung data rekapitulasi...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="empty-state">
                        <FileBarChart size={48} color="var(--p-text-muted)" />
                        <h3>Tidak Ada Data</h3>
                        <p>Coba sesuaikan periode tanggal atau jenis rekap.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Nomor SPPD</th>
                                    <th>Pegawai</th>
                                    <th>Tujuan</th>
                                    <th>Lama</th>
                                    <th style={{ textAlign: 'right' }}>Anggaran</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((r) => (
                                    <tr key={r.id}>
                                        <td>{format(new Date(r.tanggal_berangkat), 'dd/MM/yyyy')}</td>
                                        <td><code>{r.nomor_sppd}</code></td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.pegawai?.nama_lengkap}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--p-text-muted)' }}>NIP. {r.pegawai?.nip}</div>
                                        </td>
                                        <td>{r.tempat_tujuan}</td>
                                        <td>{r.lama_perjalanan} Hari</td>
                                        <td style={{ textAlign: 'right' }}>{r.spt?.pembebanan_anggaran || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
                .laporan-page { padding-bottom: 40px; }
                .report-controls { margin-bottom: 24px; padding: 24px; }
                .filter-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    align-items: flex-end;
                }
                .filter-item label {
                    display: block;
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--p-text-muted);
                    margin-bottom: 8px;
                    text-transform: uppercase;
                }
                .input-with-icon {
                    position: relative;
                }
                .input-with-icon svg {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--p-text-muted);
                }
                .input-with-icon input {
                    padding-left: 40px;
                }
                .loading-state, .empty-state {
                    padding: 80px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }
                .empty-state h3 { margin: 0; color: var(--p-text-main); }
                .empty-state p { color: var(--p-text-muted); margin: 0; }
                .table-responsive { overflow-x: auto; }
                .w-full { width: 100%; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Laporan;
