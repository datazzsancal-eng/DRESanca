
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definition
interface TipoLinha {
  id: number;
  tipo_linha: string | null;
  tipo_ativo_sn: string;
}

const TipoLinhaPage: React.FC = () => {
  // State management
  const [tiposLinha, setTiposLinha] = useState<TipoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTipoLinha, setSelectedTipoLinha] = useState<TipoLinha | null>(null);
  const [formData, setFormData] = useState({ tipo_linha: '', tipo_ativo_sn: 'S' });

  // Filter state
  const [filtroTipoLinha, setFiltroTipoLinha] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('tab_tipo_linha').select('*');
      if (filtroTipoLinha) {
        query = query.ilike('tipo_linha', `%${filtroTipoLinha}%`);
      }
      query = query.order('tipo_linha');

      const { data, error } = await query;
      if (error) throw error;
      setTiposLinha(data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
      console.error("Detailed Supabase fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroTipoLinha]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchData();
    }, 300); // Debounce search input
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Modal handlers
  const openModal = (tipoLinha: TipoLinha | null = null) => {
    setSelectedTipoLinha(tipoLinha);
    setFormData({
      tipo_linha: tipoLinha?.tipo_linha || '',
      tipo_ativo_sn: tipoLinha?.tipo_ativo_sn || 'S',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTipoLinha(null);
  };
  
  const openDeleteModal = (tipoLinha: TipoLinha) => {
    setSelectedTipoLinha(tipoLinha);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedTipoLinha(null);
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
      tipo_linha: formData.tipo_linha || null,
      tipo_ativo_sn: formData.tipo_ativo_sn,
    };

    let result;
    if (selectedTipoLinha) {
      result = await supabase
        .from('tab_tipo_linha')
        .update(payload)
        .eq('id', selectedTipoLinha.id);
    } else {
      result = await supabase
        .from('tab_tipo_linha')
        .insert(payload);
    }

    if (result.error) {
      setError(`Falha ao salvar tipo de linha: ${result.error.message}`);
    } else {
      closeModal();
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!selectedTipoLinha) return;

    const { error } = await supabase
      .from('tab_tipo_linha')
      .delete()
      .eq('id', selectedTipoLinha.id);

    if (error) {
      setError(`Falha ao excluir tipo de linha: ${error.message}`);
    } else {
      closeDeleteModal();
      fetchData();
    }
  };

  // Render logic
  if (error) return <div className="text-center p-8 text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>;
  
  const renderContent = () => {
    if (loading) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (tiposLinha.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhum Tipo de Linha Encontrado</h2>
                <p className="mt-1 text-gray-400">
                    {filtroTipoLinha ? "Tente ajustar sua busca." : "Clique em 'Adicionar Tipo de Linha' para começar."}
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Tipo de Linha</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {tiposLinha.map(tl => (
              <tr key={tl.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{tl.tipo_linha}</td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${tl.tipo_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                    {tl.tipo_ativo_sn === 'S' ? 'Sim' : 'Não'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(tl)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                        <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(tl)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
        <h2 className="text-lg font-bold text-white">Tipos de Linha Cadastrados</h2>
        <div className="flex flex-wrap items-center gap-2">
            <input 
                type="text"
                placeholder="Buscar por tipo de linha..."
                value={filtroTipoLinha}
                onChange={(e) => setFiltroTipoLinha(e.target.value.toUpperCase())}
                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => openModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
            >
              Adicionar Tipo de Linha
            </button>
        </div>
      </div>

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedTipoLinha ? 'Editar Tipo de Linha' : 'Adicionar Tipo de Linha'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="tipo_linha" className="block text-sm font-medium text-gray-300">Tipo de Linha</label>
                <input type="text" name="tipo_linha" id="tipo_linha" value={formData.tipo_linha} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="flex items-start">
                <div className="flex items-center h-5">
                    <input id="tipo_ativo_sn" name="tipo_ativo_sn" type="checkbox" checked={formData.tipo_ativo_sn === 'S'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="tipo_ativo_sn" className="font-medium text-gray-300">Ativo</label>
                </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o tipo de linha "{selectedTipoLinha?.tipo_linha}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default TipoLinhaPage;