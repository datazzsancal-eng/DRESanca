import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definitions
interface Cliente {
  id: string;
  cli_nome: string | null;
}

interface Empresa {
  id: string;
  created_at: string;
  cliente_id: string | null;
  emp_cod_integra: string | null;
  emp_cnpj_raiz: string | null;
  emp_cnpj: string | null;
  emp_matriz_sn: string;
  emp_nome: string | null;
  emp_nome_reduz: string | null;
  emp_nome_cmpl: string | null;
}

const initialFormData = {
    cliente_id: '',
    emp_cod_integra: '',
    emp_cnpj_raiz: '',
    emp_cnpj: '',
    emp_matriz_sn: 'N',
    emp_nome: '',
    emp_nome_reduz: '',
    emp_nome_cmpl: '',
};


const EmpresaPage: React.FC = () => {
  // State management
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  // Filter state
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCodigo, setFiltroCodigo] = useState('');


  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let empresasQuery = supabase.from('dre_empresa').select('*');
      if (filtroCliente) empresasQuery = empresasQuery.eq('cliente_id', filtroCliente);
      if (filtroNome) empresasQuery = empresasQuery.ilike('emp_nome', `%${filtroNome}%`);
      if (filtroCodigo) empresasQuery = empresasQuery.ilike('emp_cod_integra', `%${filtroCodigo}%`);
      
      empresasQuery = empresasQuery.order('emp_nome', { ascending: true });

      const [empresasRes, clientesRes] = await Promise.all([
        empresasQuery,
        supabase.from('dre_cliente').select('id, cli_nome').order('cli_nome', { ascending: true })
      ]);

      if (empresasRes.error) throw empresasRes.error;
      if (clientesRes.error) throw clientesRes.error;

      setEmpresas(empresasRes.data || []);
      setClientes(clientesRes.data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
      console.error("Detailed Supabase fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroCliente, filtroNome, filtroCodigo]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchData();
    }, 300); // Debounce search inputs
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Modal handlers
  const openModal = (empresa: Empresa | null = null) => {
    setSelectedEmpresa(empresa);
    setFormData({
      cliente_id: empresa?.cliente_id || filtroCliente || '',
      emp_cod_integra: empresa?.emp_cod_integra || '',
      emp_cnpj_raiz: empresa?.emp_cnpj_raiz || '',
      emp_cnpj: empresa?.emp_cnpj || '',
      emp_matriz_sn: empresa?.emp_matriz_sn || 'N',
      emp_nome: empresa?.emp_nome || '',
      emp_nome_reduz: empresa?.emp_nome_reduz || '',
      emp_nome_cmpl: empresa?.emp_nome_cmpl || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEmpresa(null);
  };
  
  const openDeleteModal = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedEmpresa(null);
  };


  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else {
        let finalValue = value;
        if (type === 'text') {
            finalValue = value.toUpperCase();
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    }
  };

  const handleSubmit = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    
    const payload = { ...formData };

    let error;
    if (selectedEmpresa) {
      const { error: updateError } = await supabase.from('dre_empresa').update(payload).eq('id', selectedEmpresa.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('dre_empresa').insert(payload);
      error = insertError;
    }

    if (error) {
      setError(`Falha ao salvar empresa: ${error.message}`);
    } else {
      fetchData(); // Always refetch
      if (keepOpen) {
          // Reset form but keep the client
          const currentCliente = formData.cliente_id;
          setFormData({ ...initialFormData, cliente_id: currentCliente });
          setSelectedEmpresa(null); // Ensure we are in "create" mode
      } else {
        closeModal();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedEmpresa) return;

    const { error } = await supabase.from('dre_empresa').delete().eq('id', selectedEmpresa.id);

    if (error) {
      setError(`Falha ao excluir empresa: ${error.message}`);
    } else {
      closeDeleteModal();
      fetchData();
    }
  };

  // Render logic
  if (error) return <div className="text-center p-8 text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>;

  const clientesMap = new Map(clientes.map(c => [c.id, c.cli_nome]));
  
  const renderContent = () => {
    if (loading) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (empresas.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhuma Empresa Encontrada</h2>
                <p className="mt-1 text-gray-400">
                    {filtroCliente || filtroNome || filtroCodigo ? "Tente ajustar seus filtros de busca." : "Clique em 'Adicionar Empresa' para começar."}
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Cód. Integração</th>
                        <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome da Empresa</th>
                        <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome Complementar</th>
                        <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Cliente</th>
                        <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {empresas.map(empresa => (
                        <tr key={empresa.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{empresa.emp_cod_integra}</td>
                            <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{empresa.emp_nome}</td>
                            <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{empresa.emp_nome_cmpl}</td>
                            <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{empresa.cliente_id ? clientesMap.get(empresa.cliente_id) || 'Inválido' : 'N/A'}</td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-4">
                                    <button onClick={() => openModal(empresa)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                                        <i className="fas fa-pencil-alt"></i>
                                    </button>
                                    <button onClick={() => openDeleteModal(empresa)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
        <h2 className="text-lg font-bold text-white">Filtros</h2>
        <div className="flex flex-wrap items-center gap-2">
            <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">Todos os Clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
            </select>
            <input type="text" placeholder="Buscar por nome..." value={filtroNome} onChange={(e) => setFiltroNome(e.target.value.toUpperCase())} className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
            <input type="text" placeholder="Buscar por código..." value={filtroCodigo} onChange={(e) => setFiltroCodigo(e.target.value.toUpperCase())} className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
            <button
              onClick={() => openModal()}
              className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
            >
              Adicionar Empresa
            </button>
        </div>
      </div>

      {renderContent()}

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedEmpresa ? 'Editar Empresa' : 'Adicionar Empresa'} size="3xl">
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
                <label htmlFor="cliente_id" className="block text-sm font-medium text-gray-300">Cliente</label>
                <select name="cliente_id" id="cliente_id" value={formData.cliente_id} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Selecione um cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="emp_nome" className="block text-sm font-medium text-gray-300">Nome da Empresa</label>
                    <input type="text" name="emp_nome" id="emp_nome" value={formData.emp_nome} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                 <div>
                    <label htmlFor="emp_nome_reduz" className="block text-sm font-medium text-gray-300">Nome Reduzido</label>
                    <input type="text" name="emp_nome_reduz" id="emp_nome_reduz" value={formData.emp_nome_reduz} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
            </div>
             <div>
                <label htmlFor="emp_nome_cmpl" className="block text-sm font-medium text-gray-300">Nome Complementar</label>
                <input type="text" name="emp_nome_cmpl" id="emp_nome_cmpl" value={formData.emp_nome_cmpl} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="emp_cnpj" className="block text-sm font-medium text-gray-300">CNPJ</label>
                    <input type="text" name="emp_cnpj" id="emp_cnpj" value={formData.emp_cnpj} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                    <label htmlFor="emp_cnpj_raiz" className="block text-sm font-medium text-gray-300">CNPJ Raiz</label>
                    <input type="text" name="emp_cnpj_raiz" id="emp_cnpj_raiz" value={formData.emp_cnpj_raiz} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="emp_cod_integra" className="block text-sm font-medium text-gray-300">Cód. Integração</label>
                    <input type="text" name="emp_cod_integra" id="emp_cod_integra" value={formData.emp_cod_integra} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div className="flex items-end">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
                        <input type="checkbox" name="emp_matriz_sn" checked={formData.emp_matriz_sn === 'S'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                        <span>É Matriz?</span>
                    </label>
                </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                {!selectedEmpresa && (
                    <button type="button" onClick={(e) => handleSubmit(e, true)} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700">Salvar e Continuar</button>
                )}
                <button type="button" onClick={(e) => handleSubmit(e, false)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir a empresa "{selectedEmpresa?.emp_nome}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmpresaPage;