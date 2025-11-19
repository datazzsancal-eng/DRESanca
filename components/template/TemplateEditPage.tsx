
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';

// Type definitions
declare const jspdf: any;

interface Cliente { id: string; cli_nome: string | null; }
interface CnpjRaiz { cnpj_raiz: string; reduz_emp: string | null; }
interface TipoLinha { id: number; tipo_linha: string | null; }
interface EstiloLinha { id: number; estilo_nome: string | null; }
interface PlanoConta { conta_estru: string; conta_descri: string | null; }
interface Visao { id: string; vis_nome: string | null; }

interface TemplateHeader {
  id?: string;
  cliente_id: string | null;
  dre_nome: string | null;
  dre_uso: string | null;
  dre_cont: string | null;
  dre_ativo_sn: string;
  cliente_cnpj: string | null;
}
interface TemplateLinha {
  id?: number;
  dre_template_id?: string;
  dre_linha_seq: number;
  tipo_linha_id: number | null;
  estilo_linha_id: number | null;
  dre_linha_descri: string | null;
  dre_linha_nivel: number | null;
  dre_linha_visivel: string;
  dre_linha_valor: string | null;
  dre_linha_valor_fonte?: 'VALOR' | 'CONTA' | 'FORMULA' | null;
  visao_id?: string | null; // Visibilidade condicional
  perc_ref?: string | null; // Nova coluna
}
interface TemplateLinhaForState extends TemplateLinha {
  _internalKey: string | number;
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


const initialHeaderState: TemplateHeader = {
  cliente_id: '',
  dre_nome: '',
  dre_uso: '',
  dre_cont: '',
  dre_ativo_sn: 'S',
  cliente_cnpj: '',
};

interface TemplateEditPageProps {
  templateId: string | 'new';
  onBack: () => void;
}

const TemplateEditPage: React.FC<TemplateEditPageProps> = ({ templateId, onBack }) => {
  const [headerData, setHeaderData] = useState<TemplateHeader>(initialHeaderState);
  const [linhasData, setLinhasData] = useState<TemplateLinhaForState[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cnpjs, setCnpjs] = useState<CnpjRaiz[]>([]);
  const [visoes, setVisoes] = useState<Visao[]>([]); // Visões disponíveis para o cliente
  const [tiposLinha, setTiposLinha] = useState<TipoLinha[]>([]);
  const [estilosLinha, setEstilosLinha] = useState<EstiloLinha[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // View Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<TemplateViewData[]>([]);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);
  const [isFallbackView, setIsFallbackView] = useState(false);

  // Account Search Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [accountSearchResults, setAccountSearchResults] = useState<PlanoConta[]>([]);
  const [isSearchingAccounts, setIsSearchingAccounts] = useState(false);
  const [editingLinhaIndex, setEditingLinhaIndex] = useState<number | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const tiposLinhaMap = useMemo(() => new Map(tiposLinha.map(t => [t.id, t.tipo_linha?.toUpperCase()])), [tiposLinha]);
  
  const planoContasMap = useMemo(() => {
    return new Map(planoContas.map(acc => [acc.conta_estru, acc.conta_descri]));
  }, [planoContas]);

  const filteredViewData = useMemo(() => {
    if (showVisibleOnly) {
        return viewData.filter(row => row.dre_linha_visivel === 'S');
    }
    return viewData;
  }, [viewData, showVisibleOnly]);


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientesRes, tiposRes, estilosRes] = await Promise.all([
        supabase.from('dre_cliente').select('*').order('cli_nome'),
        supabase.from('tab_tipo_linha').select('*').order('tipo_linha'),
        supabase.from('tab_estilo_linha').select('*').order('estilo_nome'),
      ]);
      if (clientesRes.error) throw clientesRes.error;
      if (tiposRes.error) throw tiposRes.error;
      if (estilosRes.error) throw estilosRes.error;

      setClientes(clientesRes.data);
      setTiposLinha(tiposRes.data);
      setEstilosLinha(estilosRes.data);

      if (templateId !== 'new') {
        const { data: templateData, error: templateError } = await supabase.from('dre_template').select('*').eq('id', templateId).single();
        if (templateError) throw templateError;
        setHeaderData(templateData);

        const { data: linhasDataFromDb, error: linhasError } = await supabase.from('dre_template_linhas').select('*').eq('dre_template_id', templateId).order('dre_linha_seq');
        if (linhasError) throw linhasError;
        
        const parsedLinhas = linhasDataFromDb.map(l => ({ ...l, _internalKey: l.id }));
        setLinhasData(parsedLinhas);
      }
    } catch (err: any) {
      setError(`Falha ao carregar dados do template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  // Fetch CNPJs and Visões when Cliente changes
  useEffect(() => {
    const fetchClientData = async () => {
      if (!headerData.cliente_id) { 
          setCnpjs([]); 
          setPlanoContas([]); 
          setVisoes([]);
          return; 
      }
      
      // 1. CNPJs
      const { data: cnpjData, error: cnpjError } = await supabase.from('viw_cnpj_raiz').select('cnpj_raiz, reduz_emp').eq('cliente_id', headerData.cliente_id);
      if (cnpjError) console.error("Erro ao buscar CNPJs:", cnpjError);
      setCnpjs(cnpjData || []);

      // 2. Visões (for visibility restriction)
      const { data: visaoData, error: visaoError } = await supabase.from('dre_visao').select('id, vis_nome').eq('cliente_id', headerData.cliente_id).order('vis_nome');
      if (visaoError) console.error("Erro ao buscar Visões:", visaoError);
      setVisoes(visaoData || []);
    };
    fetchClientData();
  }, [headerData.cliente_id]);
  
  useEffect(() => {
    // This effect pre-fetches a portion of the accounts for quick display of descriptions.
    const fetchInitialPlanoContas = async () => {
        if (!headerData.cliente_cnpj) {
            setPlanoContas([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('dre_plano_contabil')
                .select('conta_estru, conta_descri')
                .eq('cnpj_raiz', headerData.cliente_cnpj)
                .limit(5000) // Fetch a reasonable number for initial description mapping
                .order('conta_estru');

            if (error) throw error;
            setPlanoContas(data || []);
        } catch (err: any) {
            setError(`Falha ao carregar plano de contas: ${err.message}`);
            setPlanoContas([]);
        }
    };
    fetchInitialPlanoContas();
  }, [headerData.cliente_cnpj]);

  // Debounced search for accounts in the modal
  useEffect(() => {
      if (!isAccountModalOpen || !accountSearchQuery || !headerData.cliente_cnpj) {
          setAccountSearchResults([]);
          return;
      }

      const handler = setTimeout(async () => {
          setIsSearchingAccounts(true);
          try {
              const { data, error } = await supabase
                  .from('dre_plano_contabil')
                  .select('conta_estru, conta_descri')
                  .eq('cnpj_raiz', headerData.cliente_cnpj)
                  .or(`conta_estru.ilike.%${accountSearchQuery}%,conta_descri.ilike.%${accountSearchQuery}%`)
                  .limit(100)
                  .order('conta_estru');
              if (error) throw error;
              setAccountSearchResults(data || []);
          } catch (err: any) {
              // Silently fail in modal, or show a small error message
              console.error("Account search error:", err.message || err);
              setAccountSearchResults([]);
          } finally {
              setIsSearchingAccounts(false);
          }
      }, 300); // 300ms debounce

      return () => clearTimeout(handler);
  }, [accountSearchQuery, isAccountModalOpen, headerData.cliente_cnpj]);


  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
        setHeaderData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked ? 'S' : 'N' }));
    } else {
        const upperValue = name !== 'cliente_cnpj' ? value.toUpperCase() : value;
        if (name === 'cliente_id') {
            setHeaderData(prev => ({
                ...prev,
                cliente_id: upperValue,
                cliente_cnpj: '', 
            }));
        } else {
            setHeaderData(prev => ({ ...prev, [name]: upperValue }));
        }
    }
  };


  const handleLinhaChange = (index: number, field: keyof TemplateLinha, value: any) => {
    setLinhasData(currentLinhas => {
        const newLinhas = [...currentLinhas];
        const linhaToUpdate = { ...newLinhas[index] };
        (linhaToUpdate as any)[field] = value;

        if (field === 'tipo_linha_id') {
            linhaToUpdate.dre_linha_valor = ''; 
            const newTipo = tiposLinhaMap.get(Number(value));
            
            if (newTipo === 'CONSTANTE') {
              linhaToUpdate.dre_linha_valor_fonte = 'VALOR';
              linhaToUpdate.estilo_linha_id = null;
              linhaToUpdate.dre_linha_visivel = 'N'; 
            } else {
              linhaToUpdate.dre_linha_valor_fonte = null;
              linhaToUpdate.dre_linha_visivel = 'S'; 
            }
        }
        
        if (field === 'dre_linha_valor_fonte') {
            linhaToUpdate.dre_linha_valor = '';
        }

        newLinhas[index] = linhaToUpdate;
        return newLinhas;
    });
  };

  const addLinha = () => {
    const newLinha: TemplateLinhaForState = {
      _internalKey: `new_${Date.now()}`,
      dre_linha_seq: linhasData.length > 0 ? Math.max(...linhasData.map(l => l.dre_linha_seq)) + 1 : 1,
      tipo_linha_id: null,
      estilo_linha_id: null,
      dre_linha_descri: '',
      dre_linha_nivel: 0,
      dre_linha_visivel: 'S',
      dre_linha_valor: '',
      dre_linha_valor_fonte: null,
      visao_id: null, // Default to null (visible in all visions)
      perc_ref: '', // Default empty
    };
    setLinhasData(prev => [...prev, newLinha]);
  };

  const removeLinha = (key: string | number) => {
    setLinhasData(prev => prev.filter(l => l._internalKey !== key));
  };
  
  const openAccountSearchModal = (index: number) => {
    setEditingLinhaIndex(index);
    setAccountSearchQuery('');
    setAccountSearchResults([]);
    setIsAccountModalOpen(true);
  };

  const selectAccount = (conta: PlanoConta) => {
    if (editingLinhaIndex !== null) {
        handleLinhaChange(editingLinhaIndex, 'dre_linha_valor', conta.conta_estru);
    }
    setIsAccountModalOpen(false);
    setEditingLinhaIndex(null);
  };


  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newLinhas = [...linhasData];
    const draggedItemContent = newLinhas.splice(dragItem.current, 1)[0];
    newLinhas.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setLinhasData(newLinhas);
  };
  
  const handleViewTemplate = async () => {
      if (!headerData.dre_cont) {
        setError("Este template não possui um código de controle para visualização. Salve o template primeiro.");
        setTimeout(() => setError(null), 4000);
        return;
      }
      setIsViewModalOpen(true);
      setIsViewLoading(true);
      setViewError(null);
      setViewData([]);
      setIsFallbackView(false);

      try {
        // Try Webhook first
        const response = await fetch(`https://webhook.moondog-ia.tech/webhook/temp_dre?cntr=${headerData.dre_cont}`);
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
        
        // Fallback if response not OK or empty or invalid JSON
        if (templateId === 'new') {
            // Can't fallback to DB for unsaved template
             throw new Error("Salve o template para visualizar a estrutura se o webhook estiver indisponível.");
        }
        
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
            .eq('dre_template_id', templateId)
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
        setViewError(`Falha ao carregar visualização: ${err.message}`);
      } finally {
        setIsViewLoading(false);
      }
    };

    const closeViewModal = () => {
      setIsViewModalOpen(false);
      setViewData([]);
      setViewError(null);
      setShowVisibleOnly(false);
    };

    const handleExportPdf = () => {
        if (!headerData.dre_nome || filteredViewData.length === 0) return;

        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        const title = `Template: ${headerData.dre_nome}`;
        doc.text(title, 14, 16);

        const tableColumn = ["SEQ", "Descrição", "Tipo", "Valor / Conta / Fórmula", "Visão", "Fonte", "Visível"];
        const tableRows: (string | number)[][] = [];

        filteredViewData.forEach(item => {
            const rowData = [
                item.dre_linha_seq,
                item.dre_linha_descri || '',
                item.tipo_linha || '',
                item.dre_linha_valor_descri || '',
                item.visao_nome || 'Todas',
                item.dre_linha_valor_fonte || 'N/A',
                item.dre_linha_visivel === 'S' ? 'Sim' : 'Não'
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 24,
            theme: 'grid',
            headStyles: { fillColor: [34, 41, 51] }, // Dark gray header
            styles: { font: 'Roboto', cellPadding: 2, fontSize: 8 },
        });

        doc.save(`template_${headerData.dre_nome?.toLowerCase().replace(/\s/g, '_')}.pdf`);
    };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    let currentTemplateId = templateId !== 'new' ? templateId : undefined;

    try {
      // Step 1: Save Header
      const { id, ...headerPayload } = headerData;
      if (templateId === 'new') {
        const { data, error } = await supabase.from('dre_template').insert(headerPayload).select().single();
        if (error) throw error;
        currentTemplateId = data.id;
      } else {
        const { error } = await supabase.from('dre_template').update(headerPayload).eq('id', currentTemplateId);
        if (error) throw error;
      }
      
      if (!currentTemplateId) throw new Error("Não foi possível obter o ID do template.");

      // Step 2: Delete existing lines
      const { error: deleteError } = await supabase.from('dre_template_linhas').delete().eq('dre_template_id', currentTemplateId);
      if (deleteError) throw deleteError;
      
      // Step 3: Prepare and insert new lines
      if (linhasData.length > 0) {
        const linhasPayload = linhasData.map((linha, index) => {
            const tipoLinha = tiposLinhaMap.get(linha.tipo_linha_id as number);
            return {
                dre_template_id: currentTemplateId,
                dre_linha_seq: index + 1,
                tipo_linha_id: linha.tipo_linha_id,
                estilo_linha_id: linha.estilo_linha_id,
                dre_linha_descri: linha.dre_linha_descri,
                dre_linha_nivel: linha.dre_linha_nivel,
                dre_linha_visivel: linha.dre_linha_visivel,
                dre_linha_valor: linha.dre_linha_valor,
                dre_linha_valor_fonte: tipoLinha === 'CONSTANTE' ? (linha.dre_linha_valor_fonte || 'VALOR') : null,
                visao_id: linha.visao_id || null, // Save condition
                perc_ref: linha.perc_ref || null, // Save perc_ref
            };
        });

        const { error: insertError } = await supabase.from('dre_template_linhas').insert(linhasPayload);
        if (insertError) throw insertError;
      }
      onBack();
    } catch (err: any) {
        console.error("Save error:", err);
        setError(`Falha ao salvar template: ${err.message}`);
    } finally {
        setSaving(false);
    }
  };

  // Action Buttons Component
  const ActionButtons = ({ showTopBorder = false }: { showTopBorder?: boolean }) => (
    <div className={`flex justify-between items-center ${showTopBorder ? 'pt-4 mt-4 border-t border-gray-700' : 'pb-2'}`}>
      <button 
        onClick={onBack} 
        disabled={saving} 
        className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 disabled:opacity-50"
      >
        Voltar
      </button>
      <div className="flex items-center space-x-3">
        <button onClick={addLinha} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700">
          Adicionar Linha
        </button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">
          {saving ? 'Salvando...' : 'Salvar Template'}
        </button>
      </div>
    </div>
  );
  
  const renderValorCell = (linha: TemplateLinhaForState, index: number) => {
    const tipo = tiposLinhaMap.get(linha.tipo_linha_id as number);
    const isDisabled = !headerData.cliente_cnpj;

    const renderContaInput = () => {
      const descri = planoContasMap.get(linha.dre_linha_valor || '');
      const displayValue = descri ? `${linha.dre_linha_valor} - ${descri}` : (linha.dre_linha_valor || '');
      return (
        <div className="flex items-center w-full">
            <input 
                type="text" 
                value={displayValue} 
                disabled 
                className="w-full px-2 py-1 text-gray-300 bg-gray-600 border-gray-500 rounded-l-md" 
                placeholder="Nenhuma conta selecionada"
            />
            <button 
                type="button" 
                onClick={() => openAccountSearchModal(index)} 
                disabled={isDisabled}
                className="px-3 py-1 text-white bg-indigo-600 rounded-r-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed"
            >
                <i className="fas fa-search"></i>
            </button>
        </div>
      );
    };

    const renderFormulaInput = () => (
      <input type="text" value={linha.dre_linha_valor || ''} onChange={(e) => handleLinhaChange(index, 'dre_linha_valor', e.target.value.toUpperCase())} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ex: L1-L2"/>
    );

    switch (tipo) {
      case 'TITULO': case 'SEPARADOR':
        return <input type="text" value="N/A" disabled className="w-full px-2 py-1 text-gray-400 bg-gray-600 border-gray-500 rounded-md cursor-not-allowed" />;
      case 'CONTA':
        return renderContaInput();
      case 'FORMULA':
      case 'ACUM VLR ANT':
        return renderFormulaInput();
      case 'CONSTANTE':
        const fonte = linha.dre_linha_valor_fonte || 'VALOR';
        switch (fonte) {
            case 'CONTA': return renderContaInput();
            case 'FORMULA': return renderFormulaInput();
            case 'VALOR': default:
                return <input type="number" step="0.01" value={linha.dre_linha_valor || ''} onChange={(e) => handleLinhaChange(index, 'dre_linha_valor', e.target.value)} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />;
        }
      default:
        return <input type="text" value={linha.dre_linha_valor || ''} disabled className="w-full px-2 py-1 text-gray-400 bg-gray-600 border-gray-500 rounded-md cursor-not-allowed" />;
    }
  };


  if (loading) return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{templateId === 'new' ? 'Novo Template de DRE' : 'Editar Template de DRE'}</h2>
        {templateId !== 'new' && (
            <button
                onClick={handleViewTemplate}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700"
            >
                <i className="fas fa-eye mr-2"></i>
                Visualizar Estrutura
            </button>
        )}
      </div>

      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}

      <div className="p-4 space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Cliente</label>
            <select name="cliente_id" value={headerData.cliente_id || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">Selecione um cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Nome do Template</label>
            <input type="text" name="dre_nome" value={headerData.dre_nome || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">CNPJ Raiz (Plano de Contas)</label>
            <select name="cliente_cnpj" value={headerData.cliente_cnpj || ''} onChange={handleHeaderChange} disabled={!headerData.cliente_id} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed">
              <option value="">Selecione um CNPJ</option>
              {cnpjs.map(c => <option key={c.cnpj_raiz} value={c.cnpj_raiz}>{c.reduz_emp} ({c.cnpj_raiz})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Uso do Template</label>
            <input type="text" name="dre_uso" value={headerData.dre_uso || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Controle</label>
            <input type="text" name="dre_cont" value={headerData.dre_cont || ''} onChange={handleHeaderChange} maxLength={10} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
              <input type="checkbox" name="dre_ativo_sn" checked={headerData.dre_ativo_sn === 'S'} onChange={handleHeaderChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
              <span>Template Ativo?</span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Linhas do Template</h3>
        
        <ActionButtons />
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2 text-xs text-left text-gray-400">SEQ</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[250px]">Descrição</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400">Nível</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[120px]">Tipo</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[150px]">Estilo / Fonte</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 w-20">% REF</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[250px]">Valor / Conta / Fórmula</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[150px]">Visão Exclusiva</th>
                <th className="px-2 py-2 text-xs text-center text-gray-400">Visível</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {linhasData.map((linha, index) => {
                const isConstant = tiposLinhaMap.get(linha.tipo_linha_id as number) === 'CONSTANTE';
                return (
                  <tr key={linha._internalKey} draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleDragSort} onDragOver={(e) => e.preventDefault()} className="hover:bg-gray-700/50 cursor-move">
                    <td className="px-2 py-1 text-center text-gray-500">☰</td>
                    <td className="px-2 py-1 text-gray-400">{index + 1}</td>
                    <td className="px-1 py-1"><input type="text" value={linha.dre_linha_descri || ''} onChange={(e) => handleLinhaChange(index, 'dre_linha_descri', e.target.value.toUpperCase())} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md"/></td>
                    <td className="px-1 py-1"><input type="number" value={linha.dre_linha_nivel || 0} onChange={(e) => handleLinhaChange(index, 'dre_linha_nivel', parseInt(e.target.value, 10))} className="w-16 px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md"/></td>
                    <td className="px-1 py-1">
                      <select value={linha.tipo_linha_id || ''} onChange={(e) => handleLinhaChange(index, 'tipo_linha_id', parseInt(e.target.value, 10))} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                        <option value="" disabled>Selecione</option>
                        {tiposLinha.map(t => <option key={t.id} value={t.id}>{t.tipo_linha}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      {isConstant ? (
                        <select value={linha.dre_linha_valor_fonte || 'VALOR'} onChange={(e) => handleLinhaChange(index, 'dre_linha_valor_fonte', e.target.value as TemplateLinha['dre_linha_valor_fonte'])} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                            <option value="VALOR">Valor Fixo</option>
                            <option value="CONTA">Conta Contábil</option>
                            <option value="FORMULA">Fórmula</option>
                        </select>
                      ) : (
                        <select value={linha.estilo_linha_id || ''} onChange={(e) => handleLinhaChange(index, 'estilo_linha_id', parseInt(e.target.value, 10))} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                            <option value="">Nenhum</option>
                            {estilosLinha.map(e => <option key={e.id} value={e.id}>{e.estilo_nome}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-1 py-1">
                        <input 
                            type="text" 
                            value={linha.perc_ref || ''} 
                            onChange={(e) => handleLinhaChange(index, 'perc_ref', e.target.value.toUpperCase())}
                            className="w-20 px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md" 
                            maxLength={10}
                        />
                    </td>
                    <td className="px-1 py-1">
                      {renderValorCell(linha, index)}
                    </td>
                    <td className="px-1 py-1">
                        <select 
                          value={linha.visao_id || ''} 
                          onChange={(e) => handleLinhaChange(index, 'visao_id', e.target.value || null)} 
                          disabled={!headerData.cliente_id}
                          className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600"
                        >
                            <option value="">Todas (Padrão)</option>
                            {visoes.map(v => <option key={v.id} value={v.id}>{v.vis_nome}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 text-center"><input type="checkbox" checked={linha.dre_linha_visivel === 'S'} onChange={(e) => handleLinhaChange(index, 'dre_linha_visivel', e.target.checked ? 'S' : 'N')} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" /></td>
                    <td className="px-2 py-1 text-center"><button onClick={() => removeLinha(linha._internalKey)} className="text-red-500 hover:text-red-400"><i className="fas fa-times"></i></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ActionButtons showTopBorder={true} />
      </div>

      <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title="Buscar Conta Contábil" size="2xl">
        <div className="space-y-4">
            <input 
                type="text"
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
                placeholder="Digite o código ou a descrição da conta..."
                className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
            />
            <div className="max-h-80 overflow-y-auto">
                {isSearchingAccounts ? (
                     <div className="flex items-center justify-center p-4"><div className="w-6 h-6 border-2 border-t-transparent border-indigo-400 rounded-full animate-spin"></div></div>
                ) : accountSearchResults.length > 0 ? (
                    <ul className="divide-y divide-gray-700">
                        {accountSearchResults.map(conta => (
                            <li 
                                key={conta.conta_estru} 
                                onClick={() => selectAccount(conta)}
                                className="p-2 cursor-pointer hover:bg-indigo-600 rounded-md"
                            >
                                <div className="font-semibold text-white">{conta.conta_estru}</div>
                                <div className="text-sm text-gray-300">{conta.conta_descri}</div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-4 text-center text-gray-400">
                        {accountSearchQuery ? "Nenhuma conta encontrada." : "Digite para buscar."}
                    </div>
                )}
            </div>
        </div>
      </Modal>

       <Modal isOpen={isViewModalOpen} onClose={closeViewModal} title={`Visualização: ${headerData?.dre_nome || ''}`} size="screen80">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-end">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showVisibleOnly}
                            onChange={(e) => setShowVisibleOnly(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                        />
                        <span>Mostrar apenas linhas visíveis</span>
                    </label>
                </div>
                {isViewLoading && (
                <div className="flex items-center justify-center p-8">
                    <div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div>
                    <span className="ml-4 text-gray-300">Buscando dados...</span>
                </div>
                )}
                {viewError && (
                <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{viewError}</div>
                )}
                
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
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-center text-gray-400">Visível</th>
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
                            <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row.dre_linha_visivel === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                                    {row.dre_linha_visivel === 'S' ? 'Sim' : 'Não'}
                                </span>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                )}
                {!isViewLoading && !viewError && filteredViewData.length === 0 && (
                    <div className="p-6 text-center bg-gray-800/50">
                        <p className="text-gray-400">{showVisibleOnly ? "Nenhuma linha visível encontrada." : "Nenhum dado retornado para este template."}</p>
                    </div>
                )}
            </div>
            <div className="flex justify-end pt-4 mt-4 border-t border-gray-700 space-x-2">
                 <button 
                    type="button" 
                    onClick={handleExportPdf} 
                    disabled={filteredViewData.length === 0 || isViewLoading}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
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

export default TemplateEditPage;
