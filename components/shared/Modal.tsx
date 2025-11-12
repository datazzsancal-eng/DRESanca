import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity" 
      aria-labelledby="modal-title" 
      role="dialog" 
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg p-6 mx-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-700">
          <h3 id="modal-title" className="text-lg font-semibold text-white">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 rounded-full hover:bg-gray-700 hover:text-white p-1"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
