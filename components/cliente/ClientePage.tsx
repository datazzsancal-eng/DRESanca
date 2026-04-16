import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';
import { useAuth } from '../../contexts/AuthContext';

// Type definitions
interface Situacao {
  id: number;
  sit_desc: string;
}

interface Cliente {
  id: string;
  created_at: string;
  cliente_id: string;
  cli_nome: string | null;
  cli_situacao: number | null;
  cli_restrito_sn: string;
}

const ClientePage: React.FC = () => {
  const { user, profile, refreshClients } = useAuth();
  // State management
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({ cliente_id: '', cli_nome: '', cli_situacao: '', cli_restrito_sn: 'N' });

  // Filter state
  const [filtroNome, setFiltroNome] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let allowedClientIds: string[] = [];
      let hasFullAccess = false;

      if (profile?.function === 'MASTER') {
        hasFullAccess = true;
      } else {
        const { data: relData, error: relError } = await supabase
          .from('rel_prof_cli_empr')
          .select('cliente_id')
          .eq('profile_id', user.id)
          .eq('rel_situacao_id', 'ATV')
          .not('cliente_id', 'is', null);

        if (relError) throw relError;
        if (relData) {
          allowedClientIds = Array.from(new Set(relData.map((r: any) => r.cliente_id)));
        }
      }

      if (!hasFullAccess && allowedClientIds.length === 0) {
        setClientes([]);
        setLoading(false);
        return;
      }

      let clientesQuery = supabase.from('dre_cliente').select('*');
      
      if (!hasFullAccess) {
        clientesQuery = clientesQuery.in('id', allowedClientIds);
      }

      if (filtroNome) {
        clientesQuery = clientesQuery.ilike('cli_nome', `%${filtroNome}%`);
      }
      clientesQuery = clientesQuery.order('cli_nome', { ascending: true });

      const [clientesRes, situacoesRes] = await Promise.all([
        clientesQuery,
        supabase.from('tab_situacao').select('*').eq('sit_grupo', 'CLI')
      ]);

      if (clientesRes.error) throw clientesRes.error;
      if (situacoesRes.error) throw situacoesRes.error;

      setClientes(clientesRes.data || []);
      setSituacoes(situacoesRes.data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
      console.error("Detailed Supabase fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroNome, user?.id, profile?.function]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchData();
    }, 300); // Debounce search input
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Modal handlers
  const openModal = (cliente: Cliente | null = null) => {
    setSelectedCliente(cliente);
    setFormData({
      cliente_id: cliente?.cliente_id || '',
      cli_nome: cliente?.cli_nome || '',
      cli_situacao: cliente?.cli_situacao?.toString() || '',
      cli_restrito_sn: cliente?.cli_restrito_sn || 'N',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCliente(null);
  };
  
  const openDeleteModal = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedCliente(null);
  };


  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else {
        let finalValue = value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { cliente_id, cli_nome, cli_situacao, cli_restrito_sn } = formData;
    
    const payload = {
        cliente_id: cliente_id?.toUpperCase(),
        cli_nome: cli_nome?.toUpperCase() || null,
        cli_situacao: cli_situacao ? parseInt(cli_situacao, 10) : null,
        cli_restrito_sn: cli_restrito_sn || 'N',
    };

    let error;
    if (selectedCliente) {
      // Update
      const { error: updateError } = await supabase
        .from('dre_cliente')
        .update(payload)
        .eq('id', selectedCliente.id);
        error = updateError;
    } else {
      // Create
      const { data: insertedData, error: insertError } = await supabase
        .from('dre_cliente')
        .insert(payload)
        .select();
        
      error = insertError;

      if (!error && insertedData && insertedData.length > 0 && user) {
          const newClienteId = insertedData[0].id;
          const { error: relError } = await supabase
              .from('rel_prof_cli_empr')
              .insert({
                  profile_id: user.id,
                  cliente_id: newClienteId,
                  empresa_id: null,
                  rel_situacao_id: 'ATV'
              });
              
          if (relError) {
              console.warn("Erro ao associar cliente ao usuário:", relError.message);
          } else {
              await refreshClients();
          }
      }
    }

    if (error) {
      setError(`Falha ao salvar cliente: ${error.message}`);
    } else {
      closeModal();
      fetchData(); // Refetch all data
    }
  };

  const handleDelete = async () => {
    if (!selectedCliente) return;

    const { error } = await supabase
      .from('dre_cliente')
      .delete()
      .eq('id', selectedCliente.id);

    if (error) {
      setError(`Falha ao excluir cliente: ${error.message}`);
    } else {
      closeDeleteModal();
      fetchData(); // Refetch all data
    }
  };

  // Render logic
  if (error) return <div className="text-center p-8 text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>;

  const situacoesMap = new Map(situacoes.map(s => [s.id, s.sit_desc]));
  
  const renderContent = () => {
    if (loading) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (clientes.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhum Cliente Encontrado</h2>
                <p className="mt-1 text-gray-400">
                    {filtroNome ? "Tente ajustar seus filtros de busca." : "Clique em 'Adicionar Cliente' para começar."}
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Código</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Situação</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {clientes.map(cliente => (
              <tr key={cliente.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{cliente.cliente_id}</td>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{cliente.cli_nome}</td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{cliente.cli_situacao ? situacoesMap.get(cliente.cli_situacao) || 'Inválida' : 'N/A'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(cliente)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(cliente)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Clientes Cadastrados</h2>
        <div className="flex items-center gap-2">
            <input 
                type="text"
                placeholder="Buscar por nome..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
            />
            <button
              onClick={() => openModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
            >
              Adicionar Cliente
            </button>
        </div>
      </div>

      {/* Client Table */}
      {renderContent()}

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedCliente ? 'Editar Cliente' : 'Adicionar Cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="cliente_id" className="block text-sm font-medium text-gray-300">Código do Cliente</label>
                <input type="text" name="cliente_id" id="cliente_id" value={formData.cliente_id} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 uppercase" />
            </div>
            <div>
                <label htmlFor="cli_nome" className="block text-sm font-medium text-gray-300">Nome do Cliente</label>
                <input type="text" name="cli_nome" id="cli_nome" value={formData.cli_nome} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 uppercase" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="cli_situacao" className="block text-sm font-medium text-gray-300">Situação</label>
                    <select name="cli_situacao" id="cli_situacao" value={formData.cli_situacao} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">Selecione uma situação</option>
                        {situacoes.map(s => <option key={s.id} value={s.id}>{s.sit_desc}</option>)}
                    </select>
                </div>
                {(profile?.function === 'MASTER' || profile?.function === 'GESTOR CLIENTE') && (
                    <div className="flex items-end pb-2">
                        <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 cursor-pointer">
                            <input 
                                type="checkbox" 
                                name="cli_restrito_sn" 
                                checked={formData.cli_restrito_sn === 'S'} 
                                onChange={handleFormChange} 
                                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" 
                            />
                            <span>Cliente Restrito?</span>
                        </label>
                    </div>
                )}
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o cliente "{selectedCliente?.cli_nome}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default ClientePage;