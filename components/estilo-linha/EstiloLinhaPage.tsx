
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definition based on the new table structure
interface EstiloLinha {
  id: number;
  estilo_nome: string | null;
  estilo_ativo_sn: string;
  
  // Tela
  est_tipg_tela: string | null; // NORMAL, NEGRITO, ITALICO, NEGR/ITAL
  est_fdo_tela: string | null; // Hex
  est_txt_tela: string | null; // Hex (Requested in logic)
  est_opac_tela: number | null; // 0-100
  
  // Documento
  est_tipg_doc: string | null;
  est_fdo_doc: string | null;
  est_txt_doc: string | null; // Hex (Requested in logic)
  est_opac_doc: number | null;
  
  // Geral
  est_nivel_ident: string | number | null; // Level of indentation
}

const TIPOGRAFIAS = ['NORMAL', 'NEGRITO', 'ITALICO', 'NEGR/ITAL'];

const EstiloLinhaPage: React.FC = () => {
  // State management
  const [estilosLinha, setEstilosLinha] = useState<EstiloLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEstiloLinha, setSelectedEstiloLinha] = useState<EstiloLinha | null>(null);
  
  // Form Data
  const initialFormState = {
    estilo_nome: '',
    estilo_ativo_sn: 'S',
    est_tipg_tela: 'NORMAL',
    est_fdo_tela: '#000000', // Default black bg? Or transparent? Usually transparent or dark gray for dark mode
    est_txt_tela: '#FFFFFF',
    est_opac_tela: 100,
    est_tipg_doc: 'NORMAL',
    est_fdo_doc: '#FFFFFF',
    est_txt_doc: '#000000',
    est_opac_doc: 100,
    est_nivel_ident: 0
  };

  const [formData, setFormData] = useState(initialFormState);

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
    }, 300); 
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Helper: Convert Hex + Opacity to RGBA for background
  const getRgbaFromHex = (hex: string | null, opacity: number | null) => {
    if (!hex) return 'transparent';
    // Remove #
    hex = hex.replace('#', '');
    
    // Parse r, g, b
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        return 'transparent';
    }

    // Calc alpha 0-1
    const alpha = (opacity !== null && opacity !== undefined) ? opacity / 100 : 1;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Helper: Get CSS Properties based on style data
  const getPreviewStyle = (
    tipografia: string | null,
    txtColor: string | null,
    bgColor: string | null,
    opacity: number | null,
    indent: string | number | null
  ): React.CSSProperties => {
    
    const style: React.CSSProperties = {
        color: txtColor || 'inherit',
        backgroundColor: getRgbaFromHex(bgColor, opacity),
        paddingLeft: indent ? `${Number(indent) * 2}ch` : '0px', // Indent logic: val * 2 spaces (ch unit)
        paddingTop: '4px',
        paddingBottom: '4px',
        width: '100%',
        display: 'block',
        borderRadius: '4px'
    };

    switch (tipografia) {
        case 'NEGRITO':
            style.fontWeight = 'bold';
            break;
        case 'ITALICO':
            style.fontStyle = 'italic';
            break;
        case 'NEGR/ITAL':
            style.fontWeight = 'bold';
            style.fontStyle = 'italic';
            break;
        case 'NORMAL':
        default:
            style.fontWeight = 'normal';
            style.fontStyle = 'normal';
            break;
    }

    return style;
  };

  // Modal handlers
  const openModal = (estiloLinha: EstiloLinha | null = null) => {
    setSelectedEstiloLinha(estiloLinha);
    if (estiloLinha) {
        setFormData({
            estilo_nome: estiloLinha.estilo_nome || '',
            estilo_ativo_sn: estiloLinha.estilo_ativo_sn || 'S',
            est_tipg_tela: estiloLinha.est_tipg_tela || 'NORMAL',
            est_fdo_tela: estiloLinha.est_fdo_tela || '#000000',
            est_txt_tela: estiloLinha.est_txt_tela || '#FFFFFF',
            est_opac_tela: estiloLinha.est_opac_tela ?? 100,
            est_tipg_doc: estiloLinha.est_tipg_doc || 'NORMAL',
            est_fdo_doc: estiloLinha.est_fdo_doc || '#FFFFFF',
            est_txt_doc: estiloLinha.est_txt_doc || '#000000',
            est_opac_doc: estiloLinha.est_opac_doc ?? 100,
            est_nivel_ident: estiloLinha.est_nivel_ident ?? 0
        });
    } else {
        setFormData(initialFormState);
    }
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
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else if (name === 'estilo_nome') {
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else if (type === 'number') {
         setFormData(prev => ({ ...prev, [name]: Number(value) }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      estilo_nome: formData.estilo_nome || null,
      estilo_ativo_sn: formData.estilo_ativo_sn,
      est_tipg_tela: formData.est_tipg_tela,
      est_fdo_tela: formData.est_fdo_tela,
      est_txt_tela: formData.est_txt_tela,
      est_opac_tela: formData.est_opac_tela,
      est_tipg_doc: formData.est_tipg_doc,
      est_fdo_doc: formData.est_fdo_doc,
      est_txt_doc: formData.est_txt_doc,
      est_opac_doc: formData.est_opac_doc,
      est_nivel_ident: formData.est_nivel_ident
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
      setError(`Falha ao salvar estilo: ${result.error.message}`);
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
      setError(`Falha ao excluir estilo: ${error.message}`);
    } else {
      closeDeleteModal();
      fetchData();
    }
  };

  // Render content
  if (error) return <div className="text-center p-8 text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>;
  
  const renderContent = () => {
    if (loading) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (estilosLinha.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhum Estilo Encontrado</h2>
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
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase w-1/2">Visualização (Tela)</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {estilosLinha.map(el => {
                // Construct preview style for the list based on Screen settings
                const previewStyle = getPreviewStyle(
                    el.est_tipg_tela,
                    el.est_txt_tela,
                    el.est_fdo_tela,
                    el.est_opac_tela,
                    el.est_nivel_ident
                );

                return (
                <tr key={el.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{el.estilo_nome}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${el.estilo_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                        {el.estilo_ativo_sn === 'S' ? 'Sim' : 'Não'}
                    </span>
                    </td>
                    <td className="px-4 py-2">
                        <div style={previewStyle}>
                            EXEMPLO [{el.estilo_nome}]
                        </div>
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
                )
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Estilos de Linha (DRE)</h2>
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedEstiloLinha ? 'Editar Estilo' : 'Novo Estilo'} size="4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Geral */}
            <div className="grid grid-cols-12 gap-4 pb-4 border-b border-gray-700">
                <div className="col-span-8">
                    <label htmlFor="estilo_nome" className="block text-sm font-medium text-gray-300">Nome do Estilo</label>
                    <input type="text" name="estilo_nome" id="estilo_nome" value={formData.estilo_nome} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="EX: TOTALIZADOR" />
                </div>
                <div className="col-span-2">
                     <label htmlFor="est_nivel_ident" className="block text-sm font-medium text-gray-300">Identação</label>
                     <input type="number" name="est_nivel_ident" id="est_nivel_ident" value={formData.est_nivel_ident} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" />
                </div>
                <div className="col-span-2 flex items-end justify-center pb-2">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 cursor-pointer">
                        <input type="checkbox" name="estilo_ativo_sn" checked={formData.estilo_ativo_sn === 'S'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                        <span>Ativo</span>
                    </label>
                </div>
            </div>

            {/* Configurações Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna TELA */}
                <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <h4 className="text-md font-bold text-indigo-400 border-b border-gray-700 pb-2 mb-4">Configuração Tela</h4>
                    
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Tipografia</label>
                        <select name="est_tipg_tela" value={formData.est_tipg_tela} onChange={handleFormChange} className="w-full px-2 py-1.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-md">
                            {TIPOGRAFIAS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Cor Texto</label>
                            <div className="flex items-center space-x-2">
                                <input type="color" name="est_txt_tela" value={formData.est_txt_tela} onChange={handleFormChange} className="h-8 w-12 bg-transparent border-0 p-0 cursor-pointer" />
                                <span className="text-xs text-gray-500 uppercase">{formData.est_txt_tela}</span>
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Cor Fundo</label>
                             <div className="flex items-center space-x-2">
                                <input type="color" name="est_fdo_tela" value={formData.est_fdo_tela} onChange={handleFormChange} className="h-8 w-12 bg-transparent border-0 p-0 cursor-pointer" />
                                <span className="text-xs text-gray-500 uppercase">{formData.est_fdo_tela}</span>
                            </div>
                        </div>
                    </div>

                     <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Opacidade Fundo (0-100)</label>
                        <input type="number" name="est_opac_tela" min="0" max="100" value={formData.est_opac_tela} onChange={handleFormChange} className="w-full px-2 py-1.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-md" />
                    </div>

                    {/* Live Preview Box for Screen */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Preview Tela:</label>
                        <div style={getPreviewStyle(formData.est_tipg_tela, formData.est_txt_tela, formData.est_fdo_tela, formData.est_opac_tela, formData.est_nivel_ident)} className="border border-gray-600">
                             EXEMPLO [{formData.estilo_nome || 'NOME'}]
                        </div>
                    </div>
                </div>

                {/* Coluna DOCUMENTO */}
                <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <h4 className="text-md font-bold text-teal-400 border-b border-gray-700 pb-2 mb-4">Configuração Documento</h4>
                    
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Tipografia</label>
                        <select name="est_tipg_doc" value={formData.est_tipg_doc} onChange={handleFormChange} className="w-full px-2 py-1.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-md">
                            {TIPOGRAFIAS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Cor Texto</label>
                            <div className="flex items-center space-x-2">
                                <input type="color" name="est_txt_doc" value={formData.est_txt_doc} onChange={handleFormChange} className="h-8 w-12 bg-transparent border-0 p-0 cursor-pointer" />
                                <span className="text-xs text-gray-500 uppercase">{formData.est_txt_doc}</span>
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Cor Fundo</label>
                             <div className="flex items-center space-x-2">
                                <input type="color" name="est_fdo_doc" value={formData.est_fdo_doc} onChange={handleFormChange} className="h-8 w-12 bg-transparent border-0 p-0 cursor-pointer" />
                                <span className="text-xs text-gray-500 uppercase">{formData.est_fdo_doc}</span>
                            </div>
                        </div>
                    </div>

                     <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Opacidade Fundo (0-100)</label>
                        <input type="number" name="est_opac_doc" min="0" max="100" value={formData.est_opac_doc} onChange={handleFormChange} className="w-full px-2 py-1.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-md" />
                    </div>

                     {/* Live Preview Box for Doc */}
                     <div className="mt-4 pt-4 border-t border-gray-700">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Preview Doc:</label>
                        <div style={getPreviewStyle(formData.est_tipg_doc, formData.est_txt_doc, formData.est_fdo_doc, formData.est_opac_doc, formData.est_nivel_ident)} className="border border-gray-600">
                             EXEMPLO [{formData.estilo_nome || 'NOME'}]
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 space-x-2 border-t border-gray-700">
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
