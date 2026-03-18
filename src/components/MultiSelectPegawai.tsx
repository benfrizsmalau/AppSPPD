import React, { useState } from 'react';
import type { Pegawai } from '../types';
import { Search, UserPlus, X } from 'lucide-react';

interface MultiSelectPegawaiProps {
  availablePegawai: Pegawai[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const MultiSelectPegawai: React.FC<MultiSelectPegawaiProps> = ({
  availablePegawai,
  selectedIds,
  onChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const selectedPegawai = selectedIds
    .map(id => availablePegawai.find(p => p.id === id))
    .filter(Boolean) as Pegawai[];

  const unselectedPegawai = availablePegawai.filter(
    p => !selectedIds.includes(p.id) &&
      (p.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || p.nip.includes(searchTerm))
  );

  const handleAdd = (id: number) => {
    onChange([...selectedIds, id]);
  };

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter(sid => sid !== id));
  };

  return (
    <div className="multi-select-pegawai">
      <div className="selected-area">
        <label className="form-label">Pegawai yang Ditugaskan ({selectedIds.length})</label>
        {selectedIds.length === 0 ? (
          <div className="empty-selection">Belum ada pegawai dipilih. Pilih dari daftar di bawah.</div>
        ) : (
          <div className="selected-list">
            {selectedPegawai.map((p, index) => (
              <div key={p.id} className="selected-item">
                <div className="item-order">{index + 1}</div>
                <div className="item-info">
                  <strong>{p.nama_lengkap}</strong>
                  <span>NIP. {p.nip}</span>
                </div>
                <button type="button" className="remove-btn" onClick={() => handleRemove(p.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lookup-area">
        <label className="form-label">Cari & Tambah Pegawai</label>
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Ketik nama atau NIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="lookup-list">
          {unselectedPegawai.slice(0, 5).map(p => (
            <div key={p.id} className="lookup-item" onClick={() => handleAdd(p.id)}>
              <div className="item-info">
                <strong>{p.nama_lengkap}</strong>
                <span>{p.jabatan}</span>
              </div>
              <UserPlus size={18} color="var(--primary-blue)" />
            </div>
          ))}
          {unselectedPegawai.length > 5 && (
            <div className="lookup-more">+{unselectedPegawai.length - 5} lainnya... silakan cari lebih spesifik</div>
          )}
          {unselectedPegawai.length === 0 && searchTerm && (
            <div className="lookup-empty">Pegawai tidak ditemukan.</div>
          )}
        </div>
      </div>

      <style>{`
        .multi-select-pegawai {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
        }
        .selected-area {
          margin-bottom: 20px;
        }
        .empty-selection {
          padding: 12px;
          background: white;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          color: #94a3b8;
          font-size: 13px;
          text-align: center;
        }
        .selected-list {
          display: flex;
          flex-direction: column; gap: 8px;
        }
        .selected-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: white;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .item-order {
          width: 20px;
          height: 20px;
          background: var(--primary-blue);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }
        /* ... shared styles ... */
      `}</style>
    </div>
  );
};

export default MultiSelectPegawai;
