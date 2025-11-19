
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definitions
declare const jspdf: any;

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
  dre_cont: string | null;
  dre_ativo_sn: string;
  cliente_cnpj: string | null;
}

interface TemplateViewData {
  dre_linha_seq: number;
  dre_linha_descri: string | null;
  tipo_linha: string | null;
  dre_linha_valor_descri: string | null;
  dre_linha_valor_fonte: string | null;
  dre_linha_visivel: string;
  visao_nome?: string | null;
}

interface TemplateListPageProps {
  onEditTemplate: (id: string) => void;
  onAddNew: () => void;
  onManageCards: (id: string) => void;
}

export const TemplateListPage: React.FC<TemplateListPageProps> = ({ onEditTemplate, onAddNew, onManageCards }) => {
  // State management
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [templateForAction, setTemplateForAction] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // View Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<TemplateViewData[]>([]);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [isFallbackView, setIsFallbackView] = useState(false);

  // Filter state
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroNome, setFiltroNome] = useState('');

  const filteredViewData = useMemo(() => {
    return viewData.filter(row => row.dre_linha_visivel === 'S');
  }, [viewData]);

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
  
  // Fetch view data when modal is opened
  useEffect(() => {
    const fetchViewData = async () => {
        if (!isViewModalOpen || !templateForAction) {
            return;
        }
        
        setIsViewLoading(true);
        setViewError(null);
        setViewData([]);
        setIsFallbackView(false);

        try {
            // Try Webhook first
            if (templateForAction.dre_cont) {
                const response = await fetch(`https://webhook.moondog-ia.tech/webhook/temp_dre?cntr=${templateForAction.dre_cont}`);
                
                if (response.ok) {
                    const text = await response.text();
                    if (text && text.trim().length > 0) {
                         try {
                             const data: TemplateViewData[] = JSON.parse(text);
                             if (Array.isArray(data)) {
                                 data.sort((a, b) => a.dre_linha_seq - b.dre_linha_seq);
                                 setViewData(data);
                                 return; // Success
                             }
                         } catch (e) {
                             console.warn("Webhook returned invalid JSON, trying fallback...");
                         }
                    }
                }
            }
            
            // Fallback to Supabase if Webhook fails, returns empty, or no control code
            console.log("Using Supabase fallback for visualization");
            const { data: lines, error: dbError } = await supabase
                .from('dre_template_linhas')
                .select(`
                    dre_linha_seq, 
                    dre_linha_descri, 
                    dre_linha_valor, 
                    dre_linha_valor_fonte, 
                    dre_linha_visivel, 
                    tab_tipo_linha ( tipo_linha ),
                    dre_visao ( vis_nome )
                `)
                .eq('dre_template_id', templateForAction.id)
                .order('dre_linha_seq');

            if (dbError) throw dbError;

            const fallbackData: TemplateViewData[] = (lines || []).map((l: any) => ({
                dre_linha_seq: l.dre_linha_seq,
                dre_linha_descri: l.dre_linha_descri,
                tipo_linha: l.tab_tipo_linha?.tipo_linha || '',
                dre_linha_valor_descri: l.dre_linha_valor, // Show raw value
                dre_linha_valor_fonte: l.dre_linha_valor_fonte,
                dre_linha_visivel: l.dre_linha_visivel,
                visao_nome: l.dre_visao?.vis_nome || null
            }));
            
            setViewData(fallbackData);
            setIsFallbackView(true);

        } catch (err: any) {
            console.error("View fetch error:", err);
            setViewError(`Falha ao carregar visualização: ${err.message}`);
        } finally {
            setIsViewLoading(false);
        }
    };
    fetchViewData();
  }, [isViewModalOpen, templateForAction]);


  // Modal handlers
  const openDeleteModal = (template: Template) => {
    setTemplateForAction(template);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setTemplateForAction(null);
  };

  const openCopyModal = (template: Template) => {
    setTemplateForAction(template);
    setNewTemplateName(`CÓPIA - ${template.dre_nome || ''}`);
    setIsCopyModalOpen(true);
  };

  const closeCopyModal = () => {
    setIsCopyModalOpen(false);
    setTemplateForAction(null);
    setNewTemplateName('');
  };

  const openViewModal = (template: Template) => {
    setTemplateForAction(template);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setTemplateForAction(null);
    setViewData([]);
    setViewError(null);
  };


  const handleDelete = async () => {
    if (!templateForAction) return;

    // First, delete all associated lines from dre_template_linhas
    const { error: linesError } = await supabase
      .from('dre_template_linhas')
      .delete()
      .eq('dre_template_id', templateForAction.id);

    if (linesError) {
      setError(`Falha ao excluir as linhas do template: ${linesError.message}`);
      return; // Stop if we can't delete the lines
    }

    // Then, delete the template header itself
    const { error: templateError } = await supabase
      .from('dre_template')
      .delete()
      .eq('id', templateForAction.id);

    if (templateError) {
      setError(`Falha ao excluir o template: ${templateError.message}`);
    } else {
      closeDeleteModal();
      fetchData();
    }
  };

  const handleCopy = async () => {
    if (!templateForAction || !newTemplateName) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch source template header
      const { data: sourceHeader, error: headerError } = await supabase
        .from('dre_template')
        .select('*')
        .eq('id', templateForAction.id)
        .single();
      if (headerError) throw headerError;

      // 2. Fetch source template lines
      const { data: sourceLines, error: linesError } = await supabase
        .from('dre_template_linhas')
        .select('*')
        .eq('dre_template_id', templateForAction.id);
      if (linesError) throw linesError;

      // 3. Create new header
      const { id, created_at, ...newHeaderData } = sourceHeader;
      newHeaderData.dre_nome = newTemplateName;
      newHeaderData.dre_cont = null; // Set the control field to null to avoid unique constraint violation

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

  const handleExportPdf = () => {
    if (!templateForAction?.dre_nome || filteredViewData.length === 0) return;

    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    const title = `Template: ${templateForAction.dre_nome}`;
    doc.text(title, 14, 16);

    const tableColumn = ["SEQ", "Descrição", "Tipo", "Valor / Conta / Fórmula", "Visão", "Fonte"];
    const tableRows: (string | number)[][] = [];

    filteredViewData.forEach(item => {
        const rowData = [
            item.dre_linha_seq,
            item.dre_linha_descri || '',
            item.tipo_linha || '',
            item.dre_linha_valor_descri || '',
            item.visao_nome || 'Todas',
            item.dre_linha_valor_fonte || 'N/A',
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 24,
        theme: 'grid',
        headStyles: { fillColor: [34, 41, 51] },
        styles: { font: 'Roboto', cellPadding: 2, fontSize: 8 },
    });

    doc.save(`template_${templateForAction.dre_nome?.toLowerCase().replace(/\s/g, '_')}.pdf`);
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
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Uso</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {templates.map(template => (
              <tr key={template.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{template.dre_nome}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{template.cliente_id ? clientesMap.get(template.cliente_id) || 'Inválido' : 'Global'}</td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{template.dre_uso}</td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${template.dre_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                    {template.dre_ativo_sn === 'S' ? 'Sim' : 'Não'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openViewModal(template)} className="text-cyan-400 hover:text-cyan-300" title="Visualizar"><i className="fas fa-eye"></i></button>
                    <button onClick={() => onManageCards(template.id)} className="text-orange-400 hover:text-orange-300" title="Gerenciar Cards"><i className="fa-solid fa-table-cells-large"></i></button>
                    <button onClick={() => onEditTemplate(template.id)} className="text-indigo-400 hover:text-indigo-300" title="Editar"><i className="fas fa-pencil-alt"></i></button>
                    <button onClick={() => openCopyModal(template)} className="text-teal-400 hover:text-teal-300" title="Copiar"><i className="fas fa-copy"></i></button>
                    <button onClick={() => openDeleteModal(template)} className="text-red-500 hover:text-red-400" title="Excluir"><i className="fas fa-trash"></i></button>
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
        <h2 className="text-lg font-bold text-white">Templates de DRE</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm"
          >
            <option value="">Todos os Clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
          </select>
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value.toUpperCase())}
            className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm"
          />
          <button onClick={onAddNew} className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            Adicionar Template
          </button>
        </div>
      </div>

      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}

      {renderContent()}

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o template "{templateForAction?.dre_nome}"? Todas as suas linhas serão removidas permanentemente.</p>
        <div className="flex justify-end pt-6 space-x-2">
          <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
      
      {/* Copy Modal */}
      <Modal isOpen={isCopyModalOpen} onClose={closeCopyModal} title="Copiar Template">
        <div className="space-y-4">
            <p className="text-gray-300">Criar uma cópia de "{templateForAction?.dre_nome}".</p>
            <div>
                <label htmlFor="newTemplateName" className="block text-sm font-medium text-gray-300">Novo Nome do Template</label>
                <input
                    type="text"
                    id="newTemplateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500"
                    required
                />
            </div>
             <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeCopyModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="button" onClick={handleCopy} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Copiar</button>
            </div>
        </div>
      </Modal>
      
      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={closeViewModal} title={`Visualização: ${templateForAction?.dre_nome || ''}`} size="4xl">
         <div className="space-y-4 max-h-[70vh] overflow-y-auto">
             {isViewLoading && <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4">Buscando dados...</span></div>}
             {viewError && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{viewError}</div>}
             
             {isFallbackView && !isViewLoading && !viewError && (
                 <div className="p-3 mb-4 text-sm text-yellow-300 bg-yellow-900/30 border border-yellow-700 rounded-md">
                     A visualização processada não está disponível. Exibindo estrutura bruta do banco de dados.
                 </div>
             )}

             {!isViewLoading && !viewError && filteredViewData.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400">SEQ</th>
                                <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400">Descrição</th>
                                <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400">Tipo</th>
                                <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400">Valor / Conta / Fórmula</th>
                                <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400">Visão</th>
                                <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400">Fonte</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {filteredViewData.map(row => (
                                <tr key={row.dre_linha_seq}>
                                    <td className="px-3 py-2 text-gray-400">{row.dre_linha_seq}</td>
                                    <td className="px-3 py-2 text-white">{row.dre_linha_descri}</td>
                                    <td className="px-3 py-2 text-gray-300">{row.tipo_linha}</td>
                                    <td className="px-3 py-2 text-gray-300">{row.dre_linha_valor_descri}</td>
                                    <td className="px-3 py-2 text-gray-300">{row.visao_nome || 'Todas'}</td>
                                    <td className="px-3 py-2 text-gray-400">{row.dre_linha_valor_fonte || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
            {!isViewLoading && !viewError && filteredViewData.length === 0 && (
                <div className="p-6 text-center bg-gray-800/50">
                    <p className="text-gray-400">Nenhum dado retornado para este template.</p>
                </div>
            )}
         </div>
         <div className="flex justify-end pt-4 mt-4 border-t border-gray-700 space-x-2">
            <button 
                type="button" 
                onClick={handleExportPdf} 
                disabled={filteredViewData.length === 0 || isViewLoading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed"
            >
                <i className="fas fa-file-pdf mr-2"></i>
                Exportar PDF
            </button>
            <button type="button" onClick={closeViewModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">
                Fechar
            </button>
        </div>
      </Modal>
    </div>
  );
};
