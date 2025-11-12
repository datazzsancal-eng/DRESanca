import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definition
interface EstiloLinha {
  id: number;
  estilo_nome: string | null;
  estilo_ativo_sn: string;
  estilo_css: string | null;
}

const EstiloLinhaPage: React.FC = () => {
  // State management
  const [estilosLinha, setEstilosLinha] = useState<EstiloLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEstiloLinha, setSelectedEstiloLinha] = useState<EstiloLinha | null>(null);
  const [formData, setFormData] = useState({ estilo_nome: '', estilo_css: '', estilo_ativo_sn: 'S' });

  // Filter state
  const [filtroNome, setFiltroNome] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('tab_estilo_linha').select('*');
      if (filtroNome) {
        query = query.ilike('estilo_nome', `%${filtroNome}%`);
      }
      query = query.order('estilo_nome');

      const { data, error } = await query;
      if (error) throw error;
      setEstilosLinha(data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
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
  const openModal = (estiloLinha: EstiloLinha | null = null) => {
    setSelectedEstiloLinha(estiloLinha);
    setFormData({
      estilo_nome: estiloLinha?.estilo_nome || '',
      estilo_css: estiloLinha?.estilo_css || '',
      estilo_ativo_sn: estiloLinha?.estilo_ativo_sn || 'S',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEstiloLinha(null);
  };
  
  const openDeleteModal = (estiloLinha: EstiloLinha) => {
    setSelectedEstiloLinha(estiloLinha);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedEstiloLinha(null);
  };

  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else if (name === 'estilo_nome') {
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      estilo_nome: formData.estilo_nome || null,
      estilo_css: formData.estilo_css || null,
      estilo_ativo_sn: formData.estilo_ativo_sn,
    };

    let result;
    if (selectedEstiloLinha) {
      result = await supabase
        .from('tab_estilo_linha')
        .update(payload)
        .eq('id', selectedEstiloLinha.id);
    } else {
      result = await supabase
        .from('tab_estilo_linha')
        .insert(payload);
    }

    if (result.error) {
      setError(`Falha ao salvar estilo de linha: ${result.error.message}`);
    } else {
      closeModal();
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!selectedEstiloLinha) return;

    const { error } = await supabase
      .from('tab_estilo_linha')
      .delete()
      .eq('id', selectedEstiloLinha.id);

    if (error) {
      setError(`Falha ao excluir estilo de linha: ${error.message}`);
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
    if (estilosLinha.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhum Estilo de Linha Encontrado</h2>
                <p className="mt-1 text-gray-400">
                    {filtroNome ? "Tente ajustar sua busca." : "Clique em 'Adicionar Estilo' para começar."}
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome do Estilo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">CSS</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {estilosLinha.map(el => (
              <tr key={el.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{el.estilo_nome}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap"><code className="text-xs bg-gray-900 p-1 rounded">{el.estilo_css}</code></td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${el.estilo_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                    {el.estilo_ativo_sn === 'S' ? 'Sim' : 'Não'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(el)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(el)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
        <h2 className="text-lg font-bold text-white">Estilos de Linha Cadastrados</h2>
        <div className="flex flex-wrap items-center gap-2">
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
              Adicionar Estilo
            </button>
        </div>
      </div>

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedEstiloLinha ? 'Editar Estilo de Linha' : 'Adicionar Estilo de Linha'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="estilo_nome" className="block text-sm font-medium text-gray-300">Nome do Estilo</label>
                <input type="text" name="estilo_nome" id="estilo_nome" value={formData.estilo_nome} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label htmlFor="estilo_css" className="block text-sm font-medium text-gray-300">Classes CSS</label>
                <textarea name="estilo_css" id="estilo_css" value={formData.estilo_css || ''} onChange={handleFormChange} rows={3} className="w-full px-3 py-2 mt-1 font-mono text-sm text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="ex: font-bold text-white bg-gray-600"></textarea>
            </div>
            <div className="flex items-start">
                <div className="flex items-center h-5">
                    <input id="estilo_ativo_sn" name="estilo_ativo_sn" type="checkbox" checked={formData.estilo_ativo_sn === 'S'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="estilo_ativo_sn" className="font-medium text-gray-300">Ativo</label>
                </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o estilo "{selectedEstiloLinha?.estilo_nome}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default EstiloLinhaPage;