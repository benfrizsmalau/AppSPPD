import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="btn-icon">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>

            <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: white;
          border-radius: var(--radius-md);
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-md);
        }
        .modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--light-grey);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-header h2 {
          margin-bottom: 0;
          font-size: 1.25rem;
        }
        .modal-body {
          padding: 24px;
        }
        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--medium-grey);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
        }
        .btn-icon:hover {
          background-color: var(--light-grey);
          color: var(--dark-grey);
        }
      `}</style>
        </div>
    );
};

export default Modal;
