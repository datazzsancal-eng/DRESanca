
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';
import PlanoContabilComparePage from './PlanoContabilComparePage';
import { useAuth } from '../../contexts/AuthContext';

// Type definitions
interface EmpresaRaiz {
  cnpj_raiz: string;
  reduz_emp: string | null;
}

interface PlanoContabil {
  id: number;
  created_at: string;
  cliente_id: string | null;
  reduz_emp: string | null;
  cnpj_raiz: string | null;
  conta_estru: string | null;
  conta_grau: number | null;
  conta_descri: string | null;
}

const PlanoContabilPage: React.FC = () => {
  const { selectedClient, user } = useAuth();
  const [isComparing, setIsComparing] = useState(false);
  
  // State management
  const [contas, setContas] = useState<PlanoContabil[]>([]);
  const [empresasRaiz, setEmpresasRaiz] = useState<EmpresaRaiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalContas, setTotalContas] = useState<number | null>(null);

  // Filter state
  const [selectedCnpjRaiz, setSelectedCnpjRaiz] = useState('');
  const [filtroConta, setFiltroConta] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<PlanoContabil | null>(null);
  const [formData, setFormData] = useState({ conta_estru: '', conta_grau: '', conta_descri: '' });

  // Fetch distinct CNPJ roots when a client is selected, filtering by user permissions
  useEffect(() => {
    const fetchEmpresasRaiz = async () => {
      if (!selectedClient || !user) {
        setEmpresasRaiz([]);
        setSelectedCnpjRaiz('');
        setContas([]);
        setTotalContas(null);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // 1. Buscar permissões: quais empresas este usuário pode ver neste cliente?
        const { data: relData, error: relError } = await supabase
            .from('rel_prof_cli_empr')
            .select(`
                empresa_id,
                dre_empresa ( emp_cnpj_raiz )
            `)
            .eq('profile_id', user.id)
            .eq('cliente_id', selectedClient.id)
            .eq('rel_situacao_id', 'ATV');

        if (relError) throw relError;

        const allowedRoots = new Set<string>();
        let hasFullAccess = false;

        if (relData) {
            relData.forEach((item: any) => {
                // Se empresa_id for nulo, assume acesso total ao cliente (legado ou admin irrestrito)
                if (item.empresa_id === null) {
                    hasFullAccess = true;
                } else if (item.dre_empresa?.emp_cnpj_raiz) {
                    allowedRoots.add(item.dre_empresa.emp_cnpj_raiz);
                }
            });
        }

        // 2. Buscar todas as raízes disponíveis para o cliente (para pegar os nomes corretos da view)
        const { data: viewData, error: viewError } = await supabase
            .from('viw_cnpj_raiz')
            .select('cnpj_raiz, reduz_emp')
            .eq('cliente_id', selectedClient.id)
            .order('reduz_emp');
        
        if (viewError) throw viewError;

        const allRoots = viewData || [];

        // 3. Filtrar
        if (hasFullAccess) {
            setEmpresasRaiz(allRoots);
        } else {
            const filteredRoots = allRoots.filter(r => allowedRoots.has(r.cnpj_raiz));
            setEmpresasRaiz(filteredRoots);
        }

      } catch (err: any) {
        console.error("Erro ao buscar empresas permitidas:", err);
        setError(`Falha ao carregar lista de empresas: ${err.message}`);
        setEmpresasRaiz([]);
      } finally {
        setSelectedCnpjRaiz('');
        setContas([]);
        setTotalContas(null);
        setLoading(false);
      }
    };
    fetchEmpresasRaiz();
  }, [selectedClient, user]);

  // Fetch total count when client/cnpj changes
  useEffect(() => {
    const getTotalCount = async () => {
      if (!selectedClient || !selectedCnpjRaiz) {
        setTotalContas(null);
        return;
      }
      try {
        const { count, error } = await supabase
          .from('dre_plano_contabil')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', selectedClient.id)
          .eq('cnpj_raiz', selectedCnpjRaiz);
        
        if (error) throw error;
        setTotalContas(count || 0);
      } catch (err: any) {
        console.error(`Falha ao obter contagem total: ${err.message}`);
        setTotalContas(0); // Fallback to 0 on error
      }
    };
    
    getTotalCount();
  }, [selectedClient, selectedCnpjRaiz]);


  // Fetch chart of accounts when client and CNPJ root are selected
  const fetchContas = useCallback(async () => {
    if (!selectedClient || !selectedCnpjRaiz) {
      setContas([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const PAGE_SIZE = 1000;
      let allContas: PlanoContabil[] = [];
      let page = 0;
      let hasMore = true;

      while(hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
          .from('dre_plano_contabil')
          .select('*')
          .eq('cliente_id', selectedClient.id)
          .eq('cnpj_raiz', selectedCnpjRaiz);
        
        if (filtroConta) {
          query = query.or(`conta_estru.ilike.%${filtroConta}%,conta_descri.ilike.%${filtroConta}%`);
        }

        query = query.order('conta_estru').range(from, to);
          
        const { data, error } = await query;
          
        if (error) throw error;
        
        if (data) {
          allContas.push(...data);
        }

        if (!data || data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }
      setContas(allContas);
    } catch (err: any) {
      setError(`Falha ao carregar plano de contas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, selectedCnpjRaiz, filtroConta]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchContas();
    }, 300); // Debounce search input
    return () => clearTimeout(handler);
  }, [fetchContas]);
  
  // Modal handlers
  const openModal = (conta: PlanoContabil | null = null) => {
    setSelectedConta(conta);
    setFormData({
      conta_estru: conta?.conta_estru || '',
      conta_grau: conta?.conta_grau?.toString() || '',
      conta_descri: conta?.conta_descri || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedConta(null);
  };
  
  const openDeleteModal = (conta: PlanoContabil) => {
    setSelectedConta(conta);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedConta(null);
  };

  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCnpjRaizChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTotalContas(null); // Reset count immediately on change for a better UX
    setSelectedCnpjRaiz(e.target.value);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !selectedCnpjRaiz) {
      setError("Cliente e CNPJ Raiz devem ser selecionados.");
      return;
    }
    const empresa = empresasRaiz.find(e => e.cnpj_raiz === selectedCnpjRaiz);

    const payload = {
      cliente_id: selectedClient.id,
      cnpj_raiz: selectedCnpjRaiz,
      reduz_emp: empresa?.reduz_emp || null,
      conta_estru: formData.conta_estru.toUpperCase() || null,
      conta_grau: formData.conta_grau ? parseInt(formData.conta_grau, 10) : null,
      conta_descri: formData.conta_descri.toUpperCase() || null,
    };

    let result;
    if (selectedConta) {
      result = await supabase.from('dre_plano_contabil').update(payload).eq('id', selectedConta.id);
    } else {
      result = await supabase.from('dre_plano_contabil').insert(payload);
    }

    if (result.error) {
      setError(`Falha ao salvar conta: ${result.error.message}`);
    } else {
      closeModal();
      fetchContas();
    }
  };

  const handleDelete = async () => {
    if (!selectedConta) return;
    const { error } = await supabase.from('dre_plano_contabil').delete().eq('id', selectedConta.id);
    if (error) {
      setError(`Falha ao excluir conta: ${error.message}`);
    } else {
      closeDeleteModal();
      fetchContas();
    }
  };

  // Render logic
  const renderContent = () => {
    if (loading) {
      return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (!selectedClient) {
        return (
            <div className="p-6 text-center bg-gray-800/50">
                <h2 className="text-lg font-bold text-white">Selecione um Cliente</h2>
                <p className="mt-1 text-gray-400">Por favor, selecione um cliente no menu lateral.</p>
            </div>
        );
    }
    if (empresasRaiz.length === 0) {
        return (
            <div className="p-6 text-center bg-gray-800/50">
                <h2 className="text-lg font-bold text-white">Nenhuma Empresa Disponível</h2>
                <p className="mt-1 text-gray-400">Você não possui permissão de acesso a nenhuma empresa (CNPJ Raiz) para este cliente.</p>
            </div>
        );
    }
    if (!selectedCnpjRaiz) {
        return (
            <div className="p-6 text-center bg-gray-800/50">
                <h2 className="text-lg font-bold text-white">Selecione a Empresa</h2>
                <p className="mt-1 text-gray-400">Por favor, selecione um CNPJ raiz para ver o plano de contas de {selectedClient?.cli_nome}.</p>
            </div>
        );
    }
    if (contas.length === 0) {
      return (
        <div className="p-6 text-center bg-gray-800/50">
          <h2 className="text-lg font-bold text-white">Nenhuma Conta Encontrada</h2>
          <p className="mt-1 text-gray-400">
            {filtroConta ? "Tente ajustar seu filtro." : "Não há contas cadastradas para esta empresa. Clique em 'Adicionar Conta' para começar."}
          </p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Conta Estrutural</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Descrição</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Grau</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {contas.map(conta => (
              <tr key={conta.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{conta.conta_estru}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{conta.conta_descri}</td>
                <td className="px-4 py-2 text-center text-gray-400 whitespace-nowrap">{conta.conta_grau}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(conta)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(conta)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
  };
  
  if (isComparing) {
    return <PlanoContabilComparePage onBack={() => setIsComparing(false)} />;
  }

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Plano Contábil ({selectedClient?.cli_nome})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={selectedCnpjRaiz} 
            onChange={handleCnpjRaizChange} 
            disabled={!selectedClient || empresasRaiz.length === 0}
            className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <option value="">Selecione a Empresa (CNPJ Raiz)</option>
            {empresasRaiz.map(e => <option key={e.cnpj_raiz} value={e.cnpj_raiz}>{e.reduz_emp} ({e.cnpj_raiz})</option>)}
          </select>
          <input 
            type="text"
            placeholder="Buscar por conta/descrição..."
            value={filtroConta}
            onChange={(e) => setFiltroConta(e.target.value)}
            className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
           <button
            onClick={() => setIsComparing(true)}
            className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 whitespace-nowrap"
          >
            Comparar Planos
          </button>
          <button
            onClick={() => openModal()}
            disabled={!selectedClient || !selectedCnpjRaiz}
            className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap disabled:bg-indigo-800 disabled:cursor-not-allowed"
          >
            Adicionar Conta
          </button>
        </div>
      </div>

      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}
      
      {/* Record Count Display */}
      {selectedClient && selectedCnpjRaiz && !loading && totalContas !== null && (
        <div className="text-sm text-gray-400">
          <span>
            {contas.length.toLocaleString('pt-BR')} de {totalContas.toLocaleString('pt-BR')} registros
          </span>
        </div>
      )}

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedConta ? 'Editar Conta' : 'Adicionar Conta'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Cliente</label>
            <input 
              type="text" 
              value={selectedClient?.cli_nome || ''} 
              disabled 
              className="w-full px-3 py-2 mt-1 text-gray-400 bg-gray-800 border border-gray-600 rounded-md cursor-not-allowed" 
            />
          </div>
          <div>
            <label htmlFor="conta_estru" className="block text-sm font-medium text-gray-300">Conta Estrutural</label>
            <input type="text" name="conta_estru" id="conta_estru" value={formData.conta_estru} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="conta_descri" className="block text-sm font-medium text-gray-300">Descrição da Conta</label>
            <input type="text" name="conta_descri" id="conta_descri" value={formData.conta_descri} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="conta_grau" className="block text-sm font-medium text-gray-300">Grau</label>
            <input type="number" name="conta_grau" id="conta_grau" value={formData.conta_grau} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="flex justify-end pt-4 space-x-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir a conta "{selectedConta?.conta_descri}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
          <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default PlanoContabilPage;
