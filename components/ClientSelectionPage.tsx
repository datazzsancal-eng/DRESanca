
import React, { useState, useMemo } from 'react';
import { useAuth, ClientContext } from '../contexts/AuthContext';

const ClientSelectionPage: React.FC = () => {
  const { availableClients, selectClient, signOut, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const filteredClients = useMemo(() => {
    if (!searchTerm) return availableClients;
    return availableClients.filter(client =>
      (client.cli_nome || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableClients, searchTerm]);

  const handleConfirm = () => {
    if (!selectedClientId) return;
    const client = availableClients.find(c => c.id === selectedClientId);
    if (client) {
      selectClient(client);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[550px]">
        <div className="text-center mb-6 flex-shrink-0">
          <img
            src="https://www.sancal.com.br/wp-content/uploads/elementor/thumbs/logo-white-qfydekyggou3snwsfrlsc913ym97p1hveemqwoinls.png"
            alt="Sancal Logo"
            className="h-8 w-auto mx-auto mb-4"
          />
          <h2 className="text-xl font-bold text-white">Bem-vindo, {profile?.full_name?.split(' ')[0] || 'Usuário'}</h2>
          <p className="mt-1 text-sm text-gray-400">Selecione o cliente para acessar:</p>
        </div>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Search Input */}
            <div>
                <label htmlFor="search" className="sr-only">Buscar cliente</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        name="search"
                        id="search"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md leading-5 bg-gray-700 text-gray-300 placeholder-gray-400 focus:outline-none focus:bg-gray-600 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>

            {/* Client Listbox */}
            <div className="flex-1 min-h-0">
                {availableClients.length > 0 ? (
                    <select
                        multiple
                        size={10} 
                        className="block w-full h-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 overflow-y-auto custom-scrollbar scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-800"
                        value={[selectedClientId]}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        onDoubleClick={handleConfirm}
                    >
                        {filteredClients.map((client) => (
                            <option
                                key={client.id}
                                value={client.id}
                                className="py-2 px-2 cursor-pointer hover:bg-indigo-600 rounded"
                            >
                                {client.cli_nome}
                            </option>
                        ))}
                        {filteredClients.length === 0 && (
                            <option disabled className="text-gray-500 italic py-2">
                                Nenhum cliente encontrado.
                            </option>
                        )}
                    </select>
                ) : (
                    <div className="h-full flex items-center justify-center p-4 text-center text-red-300 bg-red-900/30 rounded-lg border border-red-800">
                        <div>
                            <p>Nenhum cliente associado.</p>
                            <p className="text-xs mt-1">Contate o administrador.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm Button */}
            <button
                onClick={handleConfirm}
                disabled={!selectedClientId}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Acessar
            </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={signOut}
            className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientSelectionPage;
