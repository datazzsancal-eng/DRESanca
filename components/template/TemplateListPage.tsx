import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definitions
interface Cliente {
  id: string;
  cli_nome: string | null;
}

interface Template {
  id: string;
  created_at: string;
  cliente_id: string | null;
  dre_nome: string | null;
  dre_uso: string | null;
  dre_ativo_sn: string;
  cliente_cnpj: string | null;
}

interface TemplateListPageProps {
  onEditTemplate: (id: string) => void;
  onAddNew: () => void;
}

const TemplateListPage: React.FC<TemplateListPageProps> = ({ onEditTemplate, onAddNew }) => {
  // State management
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // Filter state
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroNome, setFiltroNome] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('dre_template').select('*');
      if (filtroCliente) query = query.eq('cliente_id', filtroCliente);
      if (filtroNome) query = query.ilike('dre_nome', `%${filtroNome}%`);
      query = query.order('dre_nome', { ascending: true });

      const [templatesRes, clientesRes] = await Promise.all([
        query,
        supabase.from('dre_cliente').select('id, cli_nome').order('cli_nome', { ascending: true })
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (clientesRes.error) throw clientesRes.error;

      setTemplates(templatesRes.data || []);
      setClientes(clientesRes.data || []);
    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filtroCliente, filtroNome]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchData]);

  // Modal handlers
  const openDeleteModal = (template: Template) => {
    setSelectedTemplate(template);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedTemplate(null);
  };

  const openCopyModal = (template: Template) => {
    setSelectedTemplate(template);
    setNewTemplateName(`CÓPIA - ${template.dre_nome || ''}`);
    setIsCopyModalOpen(true);
  };

  const closeCopyModal = () => {
    setIsCopyModalOpen(false);
    setSelectedTemplate(null);
    setNewTemplateName('');
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    // First, delete all associated lines from dre_template_linhas
    const { error: linesError } = await supabase
      .from('dre_template_linhas')
      .delete()
      .eq('dre_template_id', selectedTemplate.id);

    if (linesError) {
      setError(`Falha ao excluir as linhas do template: ${linesError.message}`);
      return; // Stop if we can't delete the lines
    }

    // Then, delete the template header itself
    const { error: templateError } = await supabase
      .from('dre_template')
      .delete()
      .eq('id', selectedTemplate.id);

    if (templateError) {
      setError(`Falha ao excluir o template: ${templateError.message}`);
    } else {
      closeDeleteModal();
      fetchData();
    }
  };

  const handleCopy = async () => {
    if (!selectedTemplate || !newTemplateName) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch source template header
      const { data: sourceHeader, error: headerError } = await supabase
        .from('dre_template')
        .select('*')
        .eq('id', selectedTemplate.id)
        .single();
      if (headerError) throw headerError;

      // 2. Fetch source template lines
      const { data: sourceLines, error: linesError } = await supabase
        .from('dre_template_linhas')
        .select('*')
        .eq('dre_template_id', selectedTemplate.id);
      if (linesError) throw linesError;

      // 3. Create new header
      const { id, created_at, ...newHeaderData } = sourceHeader;
      newHeaderData.dre_nome = newTemplateName;

      const { data: insertedHeader, error: insertHeaderError } = await supabase
        .from('dre_template')
        .insert(newHeaderData)
        .select()
        .single();
      if (insertHeaderError) throw insertHeaderError;
      const newTemplateId = insertedHeader.id;

      // 4. Create new lines if they exist
      if (sourceLines && sourceLines.length > 0) {
        const newLinesData = sourceLines.map(line => {
          const { id, dre_template_id, ...newLine } = line;
          return { ...newLine, dre_template_id: newTemplateId };
        });
        const { error: insertLinesError } = await supabase.from('dre_template_linhas').insert(newLinesData);
        if (insertLinesError) throw insertLinesError;
      }

      closeCopyModal();
      fetchData();
    } catch (err: any) {
      setError(`Falha ao copiar o template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  // Render logic
  const clientesMap = new Map(clientes.map(c => [c.id, c.cli_nome]));

  const renderContent = () => {
    if (loading) {
      return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (templates.length === 0) {
      return (
        <div className="p-6 text-center bg-gray-800/50">
          <h2 className="text-lg font-bold text-white">Nenhum Template Encontrado</h2>
          <p className="mt-1 text-gray-400">
            {filtroCliente || filtroNome ? "Tente ajustar seus filtros." : "Clique em 'Adicionar Template' para começar."}
          </p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome do Template</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Cliente</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {templates.map(template => (
              <tr key={template.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{template.dre_nome}</td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{template.cliente_id ? clientesMap.get(template.cliente_id) || 'Inválido' : 'N/A'}</td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${template.dre_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                    {template.dre_ativo_sn === 'S' ? 'Sim' : 'Não'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => onEditTemplate(template.id)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openCopyModal(template)} className="text-green-400 hover:text-green-300" aria-label="Copiar">
                      <i className="fas fa-copy"></i>
                    </button>
                    <button onClick={() => openDeleteModal(template)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Templates Cadastrados</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">Todos os Clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
          </select>
          <input type="text" placeholder="Buscar por nome..." value={filtroNome} onChange={(e) => setFiltroNome(e.target.value.toUpperCase())} className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
          <button
            onClick={onAddNew}
            className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
          >
            Adicionar Template
          </button>
        </div>
      </div>

      {error && <div className="p-4 text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>}
      
      {renderContent()}

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o template "{selectedTemplate?.dre_nome}"? Esta ação também excluirá todas as linhas associadas.</p>
        <div className="flex justify-end pt-6 space-x-2">
          <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>

      <Modal isOpen={isCopyModalOpen} onClose={closeCopyModal} title="Copiar Template">
        <div className="space-y-4">
            <p className="text-gray-300">
                Criar uma cópia do template <span className="font-bold text-white">"{selectedTemplate?.dre_nome}"</span>.
            </p>
            <div>
                <label htmlFor="new_template_name" className="block text-sm font-medium text-gray-300">
                    Nome do Novo Template
                </label>
                <input
                    type="text"
                    id="new_template_name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeCopyModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!newTemplateName || loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed"
                >
                    {loading ? 'Copiando...' : 'Confirmar Cópia'}
                </button>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default TemplateListPage;