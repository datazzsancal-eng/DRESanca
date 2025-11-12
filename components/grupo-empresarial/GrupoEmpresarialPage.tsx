import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definitions
interface Cliente {
  id: string;
  cli_nome: string | null;
}

interface GrupoEmpresarial {
  id: string;
  created_at: string;
  cliente_id: string | null;
  grupo_nome: string | null;
  grupo_reduz: string | null;
}

const GrupoEmpresarialPage: React.FC = () => {
  // State management
  const [grupos, setGrupos] = useState<GrupoEmpresarial[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoEmpresarial | null>(null);
  const [formData, setFormData] = useState({ grupo_nome: '', grupo_reduz: '', cliente_id: '' });

  // Filter state
  const [filtroNome, setFiltroNome] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let gruposQuery = supabase.from('dre_grupo_empresa').select('*');
      if (filtroNome) {
        gruposQuery = gruposQuery.ilike('grupo_nome', `%${filtroNome}%`);
      }
      gruposQuery = gruposQuery.order('grupo_nome', { ascending: true });

      const [gruposRes, clientesRes] = await Promise.all([
        gruposQuery,
        supabase.from('dre_cliente').select('id, cli_nome').order('cli_nome', { ascending: true })
      ]);

      if (gruposRes.error) throw gruposRes.error;
      if (clientesRes.error) throw clientesRes.error;

      setGrupos(gruposRes.data || []);
      setClientes(clientesRes.data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
      console.error("Detailed Supabase fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroNome]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchData();
    }, 300); // Debounce search input
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Modal handlers
  const openModal = (grupo: GrupoEmpresarial | null = null) => {
    setSelectedGrupo(grupo);
    setFormData({
      grupo_nome: grupo?.grupo_nome || '',
      grupo_reduz: grupo?.grupo_reduz || '',
      cliente_id: grupo?.cliente_id || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGrupo(null);
  };
  
  const openDeleteModal = (grupo: GrupoEmpresarial) => {
    setSelectedGrupo(grupo);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedGrupo(null);
  };


  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    if ('type' in e.target && e.target.type === 'text') {
        finalValue = value.toUpperCase();
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { grupo_nome, grupo_reduz, cliente_id } = formData;
    
    const payload = {
      grupo_nome: grupo_nome || null,
      grupo_reduz: grupo_reduz || null,
      cliente_id: cliente_id || null,
    };

    let error;
    if (selectedGrupo) {
      // Update
      const { error: updateError } = await supabase
        .from('dre_grupo_empresa')
        .update(payload)
        .eq('id', selectedGrupo.id);
        error = updateError;
    } else {
      // Create
      const { error: insertError } = await supabase
        .from('dre_grupo_empresa')
        .insert(payload);
        error = insertError;
    }

    if (error) {
      setError(`Falha ao salvar grupo empresarial: ${error.message}`);
    } else {
      closeModal();
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!selectedGrupo) return;

    const { error } = await supabase
      .from('dre_grupo_empresa')
      .delete()
      .eq('id', selectedGrupo.id);

    if (error) {
      setError(`Falha ao excluir grupo empresarial: ${error.message}`);
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
    if (grupos.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhum Grupo Encontrado</h2>
                <p className="mt-1 text-gray-400">
                    {filtroNome ? "Tente ajustar seus filtros de busca." : "Clique em 'Adicionar Grupo' para começar."}
                </p>
            </div>
        );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome do Grupo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome Reduzido</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Cliente</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {grupos.map(grupo => (
              <tr key={grupo.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{grupo.grupo_nome}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{grupo.grupo_reduz}</td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{grupo.cliente_id ? clientesMap.get(grupo.cliente_id) || 'Inválido' : 'N/A'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(grupo)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(grupo)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
        <h2 className="text-lg font-bold text-white">Grupos Empresariais Cadastrados</h2>
         <div className="flex items-center gap-2">
            <input 
                type="text"
                placeholder="Buscar por nome..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value.toUpperCase())}
                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
            onClick={() => openModal()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
            >
            Adicionar Grupo
            </button>
        </div>
      </div>

      {renderContent()}

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedGrupo ? 'Editar Grupo Empresarial' : 'Adicionar Grupo Empresarial'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="grupo_nome" className="block text-sm font-medium text-gray-300">Nome do Grupo</label>
                <input type="text" name="grupo_nome" id="grupo_nome" value={formData.grupo_nome} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label htmlFor="grupo_reduz" className="block text-sm font-medium text-gray-300">Nome Reduzido</label>
                <input type="text" name="grupo_reduz" id="grupo_reduz" value={formData.grupo_reduz} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label htmlFor="cliente_id" className="block text-sm font-medium text-gray-300">Cliente</label>
                <select name="cliente_id" id="cliente_id" value={formData.cliente_id} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Selecione um cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
                </select>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o grupo "{selectedGrupo?.grupo_nome}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default GrupoEmpresarialPage;