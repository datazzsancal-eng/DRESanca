import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definition
interface Situacao {
  id: number;
  sit_desc: string | null;
  sit_ativa_sn: string;
  sit_controle: string | null;
  sit_grupo: string | null;
}

const SituacaoPage: React.FC = () => {
  // State management
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSituacao, setSelectedSituacao] = useState<Situacao | null>(null);
  const [formData, setFormData] = useState({ sit_desc: '', sit_grupo: '', sit_controle: '', sit_ativa_sn: 'S' });

  // Filter state
  const [filtroDesc, setFiltroDesc] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('tab_situacao').select('*');
      if (filtroDesc) {
        query = query.ilike('sit_desc', `%${filtroDesc}%`);
      }
      if (filtroGrupo) {
        query = query.ilike('sit_grupo', `%${filtroGrupo}%`);
      }
      query = query.order('sit_grupo').order('sit_desc');

      const { data, error } = await query;
      if (error) throw error;
      setSituacoes(data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
      console.error("Detailed Supabase fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroDesc, filtroGrupo]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchData();
    }, 300); // Debounce search input
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Modal handlers
  const openModal = (situacao: Situacao | null = null) => {
    setSelectedSituacao(situacao);
    setFormData({
      sit_desc: situacao?.sit_desc || '',
      sit_grupo: situacao?.sit_grupo || '',
      sit_controle: situacao?.sit_controle || '',
      sit_ativa_sn: situacao?.sit_ativa_sn || 'S',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSituacao(null);
  };
  
  const openDeleteModal = (situacao: Situacao) => {
    setSelectedSituacao(situacao);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedSituacao(null);
  };

  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      sit_desc: formData.sit_desc || null,
      sit_grupo: formData.sit_grupo || null,
      sit_controle: formData.sit_controle || null,
      sit_ativa_sn: formData.sit_ativa_sn,
    };

    let error;
    if (selectedSituacao) {
      // Update
      const { error: updateError } = await supabase
        .from('tab_situacao')
        .update(payload)
        .eq('id', selectedSituacao.id);
        error = updateError;
    } else {
      // Create
      const { error: insertError } = await supabase
        .from('tab_situacao')
        .insert(payload);
        error = insertError;
    }

    if (error) {
      setError(`Falha ao salvar situação: ${error.message}`);
    } else {
      closeModal();
      fetchData(); // Refetch all data
    }
  };

  const handleDelete = async () => {
    if (!selectedSituacao) return;

    const { error } = await supabase
      .from('tab_situacao')
      .delete()
      .eq('id', selectedSituacao.id);

    if (error) {
      setError(`Falha ao excluir situação: ${error.message}`);
    } else {
      closeDeleteModal();
      fetchData(); // Refetch all data
    }
  };

  // Render logic
  if (error) return <div className="text-center p-8 text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>;
  
  const renderContent = () => {
    if (loading) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (situacoes.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhuma Situação Encontrada</h2>
                <p className="mt-1 text-gray-400">
                    {filtroDesc || filtroGrupo ? "Tente ajustar seus filtros de busca." : "Clique em 'Adicionar Situação' para começar."}
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Descrição</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Grupo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Controle</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativa</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {situacoes.map(sit => (
              <tr key={sit.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{sit.sit_desc}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{sit.sit_grupo}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{sit.sit_controle}</td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sit.sit_ativa_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                    {sit.sit_ativa_sn === 'S' ? 'Sim' : 'Não'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(sit)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(sit)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
        <h2 className="text-lg font-bold text-white">Situações Cadastradas</h2>
        <div className="flex flex-wrap items-center gap-2">
            <input 
                type="text"
                placeholder="Buscar por descrição..."
                value={filtroDesc}
                onChange={(e) => setFiltroDesc(e.target.value.toUpperCase())}
                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
             <input 
                type="text"
                placeholder="Buscar por grupo..."
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value.toUpperCase())}
                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => openModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
            >
              Adicionar Situação
            </button>
        </div>
      </div>

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedSituacao ? 'Editar Situação' : 'Adicionar Situação'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="sit_desc" className="block text-sm font-medium text-gray-300">Descrição</label>
                <input type="text" name="sit_desc" id="sit_desc" value={formData.sit_desc} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
             <div>
                <label htmlFor="sit_grupo" className="block text-sm font-medium text-gray-300">Grupo</label>
                <input type="text" name="sit_grupo" id="sit_grupo" value={formData.sit_grupo} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
             <div>
                <label htmlFor="sit_controle" className="block text-sm font-medium text-gray-300">Controle</label>
                <input type="text" name="sit_controle" id="sit_controle" value={formData.sit_controle} onChange={handleFormChange} maxLength={5} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="flex items-start">
                <div className="flex items-center h-5">
                    <input id="sit_ativa_sn" name="sit_ativa_sn" type="checkbox" checked={formData.sit_ativa_sn === 'S'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="sit_ativa_sn" className="font-medium text-gray-300">Situação Ativa</label>
                </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir a situação "{selectedSituacao?.sit_desc}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default SituacaoPage;