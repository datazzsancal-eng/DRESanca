
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { useAuth } from '../../contexts/AuthContext';

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
  id?: string | number;
  dre_template_id?: string;
  dre_linha_seq: number;
  tipo_linha_id: number | null;
  estilo_linha_id: number | null;
  dre_linha_descri: string | null;
  dre_linha_nivel: number | null;
  dre_linha_visivel: string;
  dre_linha_valor: string | null;
  dre_linha_valor_fonte?: 'VALOR' | 'CONTA' | 'FORMULA' | null;
  visao_id?: string | null;
  perc_ref?: string | null;
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

interface TemplateEditPageProps {
  templateId: string | 'new';
  onBack: () => void;
}

const TemplateEditPage: React.FC<TemplateEditPageProps> = ({ templateId, onBack }) => {
  const { user, selectedClient } = useAuth();
  
  const [headerData, setHeaderData] = useState<TemplateHeader>({
    cliente_id: selectedClient?.id || '',
    dre_nome: '',
    dre_uso: '',
    dre_cont: '',
    dre_ativo_sn: 'S',
    cliente_cnpj: '',
  });
  
  const [linhasData, setLinhasData] = useState<TemplateLinhaForState[]>([]);
  const [cnpjs, setCnpjs] = useState<CnpjRaiz[]>([]);
  const [visoes, setVisoes] = useState<Visao[]>([]);
  const [tiposLinha, setTiposLinha] = useState<TipoLinha[]>([]);
  const [estilosLinha, setEstilosLinha] = useState<EstiloLinha[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Permissions Cache within Client
  const [userPermissions, setUserPermissions] = useState<{
      allowedRoots: Set<string>,
      clientFullAccess: boolean
  }>({ allowedRoots: new Set(), clientFullAccess: false });

  // Modals state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<TemplateViewData[]>([]);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);
  
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [accountSearchResults, setAccountSearchResults] = useState<PlanoConta[]>([]);
  const [isSearchingAccounts, setIsSearchingAccounts] = useState(false);
  const [editingLinhaIndex, setEditingLinhaIndex] = useState<number | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const tiposLinhaMap = useMemo(() => {
      const map = new Map<number, string>();
      tiposLinha.forEach(t => t.tipo_linha && map.set(t.id, t.tipo_linha.toUpperCase()));
      return map;
  }, [tiposLinha]);
  
  const planoContasMap = useMemo(() => new Map(planoContas.map(acc => [acc.conta_estru, acc.conta_descri])), [planoContas]);

  const filteredViewData = useMemo(() => showVisibleOnly ? viewData.filter(row => row.dre_linha_visivel === 'S') : viewData, [viewData, showVisibleOnly]);

  const fetchData = useCallback(async () => {
    if (!user || !selectedClient) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch reference tables and permissions in parallel
      const [relRes, tiposRes, estilosRes] = await Promise.all([
        supabase.from('rel_prof_cli_empr').select('empresa_id, dre_empresa(emp_cnpj_raiz)').eq('profile_id', user.id).eq('cliente_id', selectedClient.id).eq('rel_situacao_id', 'ATV'),
        supabase.from('tab_tipo_linha').select('*').order('tipo_linha'),
        supabase.from('tab_estilo_linha').select('*').order('estilo_nome'),
      ]);

      if (relRes.error) throw relRes.error;
      if (tiposRes.error) throw tiposRes.error;
      if (estilosRes.error) throw estilosRes.error;

      const clientFullAccess = relRes.data?.some((r: any) => r.empresa_id === null) || false;
      const allowedRoots = new Set<string>();
      if (!clientFullAccess && relRes.data) {
          relRes.data.forEach((r: any) => r.dre_empresa?.emp_cnpj_raiz && allowedRoots.add(r.dre_empresa.emp_cnpj_raiz));
      }
      
      setUserPermissions({ allowedRoots, clientFullAccess });
      setTiposLinha(tiposRes.data);
      setEstilosLinha(estilosRes.data);

      // 2. Fetch Client Specific Data (Roots and Visions)
      const [cnpjRes, visaoRes] = await Promise.all([
        supabase.from('viw_cnpj_raiz').select('cnpj_raiz, reduz_emp').eq('cliente_id', selectedClient.id),
        supabase.from('dre_visao').select('id, vis_nome').eq('cliente_id', selectedClient.id).order('vis_nome')
      ]);

      if (cnpjRes.error) throw cnpjRes.error;
      if (visaoRes.error) throw visaoRes.error;

      const allCnpjs = cnpjRes.data || [];
      setCnpjs(clientFullAccess ? allCnpjs : allCnpjs.filter(c => allowedRoots.has(c.cnpj_raiz)));
      setVisoes(visaoRes.data || []);

      // 3. If editing, fetch Template data
      if (templateId !== 'new') {
        const { data: templateData, error: templateError } = await supabase.from('dre_template').select('*').eq('id', templateId).single();
        if (templateError) throw templateError;
        
        // Security check
        if (templateData.cliente_id !== selectedClient.id) throw new Error("Acesso negado: Este template pertence a outro cliente.");

        setHeaderData(templateData);
        const { data: lines, error: linesError } = await supabase.from('dre_template_linhas').select('*').eq('dre_template_id', templateId).order('dre_linha_seq');
        if (linesError) throw linesError;
        setLinhasData(lines.map((l: any) => ({ ...l, _internalKey: l.id })));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [templateId, user, selectedClient]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  useEffect(() => {
    const fetchAccounts = async () => {
        if (!headerData.cliente_cnpj) { setPlanoContas([]); return; }
        try {
            const { data, error } = await supabase.from('dre_plano_contabil').select('conta_estru, conta_descri').eq('cnpj_raiz', headerData.cliente_cnpj).limit(5000).order('conta_estru');
            if (error) throw error;
            setPlanoContas(data || []);
        } catch (err: any) { setPlanoContas([]); }
    };
    fetchAccounts();
  }, [headerData.cliente_cnpj]);

  useEffect(() => {
      if (!isAccountModalOpen || !accountSearchQuery || !headerData.cliente_cnpj) return;
      const handler = setTimeout(async () => {
          setIsSearchingAccounts(true);
          try {
              const { data, error } = await supabase.from('dre_plano_contabil').select('conta_estru, conta_descri').eq('cnpj_raiz', headerData.cliente_cnpj).or(`conta_estru.ilike.%${accountSearchQuery}%,conta_descri.ilike.%${accountSearchQuery}%`).limit(100).order('conta_estru');
              if (error) throw error;
              setAccountSearchResults(data || []);
          } catch (e) { setAccountSearchResults([]); } finally { setIsSearchingAccounts(false); }
      }, 300);
      return () => clearTimeout(handler);
  }, [accountSearchQuery, isAccountModalOpen, headerData.cliente_cnpj]);

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'checkbox' ? ((e.target as HTMLInputElement).checked ? 'S' : 'N') : value.toUpperCase();
    setHeaderData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleLinhaChange = (index: number, field: keyof TemplateLinha, value: any) => {
    setLinhasData(current => {
        const newLinhas = [...current];
        const linha = { ...newLinhas[index], [field]: value };
        if (field === 'tipo_linha_id') {
            linha.dre_linha_valor = ''; 
            const newTipo = tiposLinhaMap.get(Number(value));
            if (newTipo === 'CONSTANTE') { linha.dre_linha_valor_fonte = 'VALOR'; linha.estilo_linha_id = null; linha.dre_linha_visivel = 'N'; }
            else { linha.dre_linha_valor_fonte = null; linha.dre_linha_visivel = 'S'; }
        }
        if (field === 'dre_linha_valor_fonte') linha.dre_linha_valor = '';
        newLinhas[index] = linha;
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
      visao_id: null,
      perc_ref: '',
    };
    setLinhasData(prev => [...prev, newLinha]);
  };

  const removeLinha = (key: string | number) => setLinhasData(prev => prev.filter(l => l._internalKey !== key));
  const openAccountSearchModal = (index: number) => { setEditingLinhaIndex(index); setAccountSearchQuery(''); setIsAccountModalOpen(true); };
  const selectAccount = (conta: PlanoConta) => { if (editingLinhaIndex !== null) handleLinhaChange(editingLinhaIndex, 'dre_linha_valor', conta.conta_estru); setIsAccountModalOpen(false); };
  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newLinhas = [...linhasData];
    const dragged = newLinhas.splice(dragItem.current, 1)[0];
    newLinhas.splice(dragOverItem.current, 0, dragged);
    dragItem.current = null; dragOverItem.current = null;
    setLinhasData(newLinhas);
  };
  
  const handleViewTemplate = async () => {
      if (!headerData.dre_cont) { setError("Salve o template primeiro para gerar o código de controle."); return; }
      setIsViewModalOpen(true); setIsViewLoading(true); setViewError(null); setViewData([]);
      try {
        const response = await fetch(`https://webhook.moondog-ia.tech/webhook/temp_dre?cntr=${headerData.dre_cont}`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) { setViewData(data.sort((a, b) => a.dre_linha_seq - b.dre_linha_seq)); return; }
        }
        throw new Error("Webhook indisponível.");
      } catch (err: any) { setViewError(err.message); } finally { setIsViewLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      let currentId = templateId !== 'new' ? templateId : undefined;
      const { id, ...headerPayload } = headerData;
      if (templateId === 'new') {
        const { data, error } = await supabase.from('dre_template').insert(headerPayload).select().single();
        if (error) throw error;
        currentId = data.id;
      } else {
        const { error } = await supabase.from('dre_template').update(headerPayload).eq('id', currentId);
        if (error) throw error;
      }
      
      const { data: existing } = await supabase.from('dre_template_linhas').select('id').eq('dre_template_id', currentId);
      const existingIds = new Set(existing?.map((l: any) => l.id) || []);
      const incomingIds = new Set(linhasData.map(l => l.id).filter(Boolean));
      const toDelete = [...existingIds].filter(id => !incomingIds.has(id));

      if (toDelete.length > 0) {
         const { error: delErr } = await supabase.from('dre_template_linhas').delete().in('id', toDelete);
         if (delErr) throw new Error(delErr.code === '23503' ? "Linhas em uso em Cards não podem ser excluídas." : delErr.message);
      }
      
      const inserts: any[] = [];
      const updates: any[] = [];
      linhasData.forEach((l, i) => {
        const payload = {
            dre_template_id: currentId,
            dre_linha_seq: i + 1,
            tipo_linha_id: l.tipo_linha_id,
            estilo_linha_id: l.estilo_linha_id,
            dre_linha_descri: l.dre_linha_descri,
            dre_linha_nivel: l.dre_linha_nivel,
            dre_linha_visivel: l.dre_linha_visivel,
            dre_linha_valor: l.dre_linha_valor,
            dre_linha_valor_fonte: l.dre_linha_valor_fonte,
            visao_id: l.visao_id || null,
            perc_ref: l.perc_ref || null,
        };
        if (l.id) updates.push({ ...payload, id: l.id }); else inserts.push(payload);
      });

      if (updates.length > 0) await supabase.from('dre_template_linhas').upsert(updates);
      if (inserts.length > 0) await supabase.from('dre_template_linhas').insert(inserts);
      onBack();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center p-8 font-medium text-gray-300">Carregando formulário...</div>;

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{templateId === 'new' ? 'Novo Template' : 'Editar Template'}</h2>
        {templateId !== 'new' && <button onClick={handleViewTemplate} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700">Visualizar Estrutura</button>}
      </div>

      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}

      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-gray-300">Cliente</label><input type="text" value={selectedClient?.cli_nome || ''} disabled className="w-full px-3 py-2 mt-1 text-gray-400 bg-gray-800 border border-gray-700 rounded-md cursor-not-allowed" /></div>
          <div><label className="block text-sm font-medium text-gray-300">Nome do Template</label><input type="text" name="dre_nome" value={headerData.dre_nome || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" /></div>
          <div><label className="block text-sm font-medium text-gray-300">CNPJ Raiz (Audit)</label><select name="cliente_cnpj" value={headerData.cliente_cnpj || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md"><option value="">Selecione...</option>{cnpjs.map(c => <option key={c.cnpj_raiz} value={c.cnpj_raiz}>{c.reduz_emp} ({c.cnpj_raiz})</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-300">Uso</label><input type="text" name="dre_uso" value={headerData.dre_uso || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" /></div>
          <div><label className="block text-sm font-medium text-gray-300">Controle</label><input type="text" name="dre_cont" value={headerData.dre_cont || ''} onChange={handleHeaderChange} maxLength={10} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" /></div>
          <div className="flex items-end"><label className="flex items-center space-x-2 text-sm font-medium text-gray-300"><input type="checkbox" name="dre_ativo_sn" checked={headerData.dre_ativo_sn === 'S'} onChange={handleHeaderChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded" /><span>Ativo?</span></label></div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Linhas</h3>
            <div className="space-x-2">
                <button onClick={addLinha} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md">Adicionar Linha</button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Template'}</button>
            </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2 text-left text-gray-400">SEQ</th>
                <th className="px-2 py-2 text-left text-gray-400 min-w-[250px]">Descrição</th>
                <th className="px-2 py-2 text-left text-gray-400">Tipo</th>
                <th className="px-2 py-2 text-left text-gray-400 min-w-[250px]">Valor / Conta</th>
                <th className="px-2 py-2 text-left text-gray-400">Visão</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {linhasData.map((linha, index) => (
                <tr key={linha._internalKey} draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleDragSort} onDragOver={e => e.preventDefault()} className="hover:bg-gray-700/50 cursor-move">
                  <td className="px-2 text-gray-500">☰</td>
                  <td className="px-2 text-gray-400">{index + 1}</td>
                  <td className="px-1"><input type="text" value={linha.dre_linha_descri || ''} onChange={e => handleLinhaChange(index, 'dre_linha_descri', e.target.value.toUpperCase())} className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded" /></td>
                  <td className="px-1"><select value={linha.tipo_linha_id || ''} onChange={e => handleLinhaChange(index, 'tipo_linha_id', Number(e.target.value))} className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded"><option value="">-</option>{tiposLinha.map(t => <option key={t.id} value={t.id}>{t.tipo_linha}</option>)}</select></td>
                  <td className="px-1">
                      {tiposLinhaMap.get(Number(linha.tipo_linha_id)) === 'CONTA' ? (
                          <div className="flex"><input type="text" value={linha.dre_linha_valor || ''} disabled className="flex-1 px-2 py-1 bg-gray-600 text-gray-300 rounded-l" /><button onClick={() => openAccountSearchModal(index)} className="px-3 bg-indigo-600 rounded-r"><i className="fas fa-search"></i></button></div>
                      ) : <input type="text" value={linha.dre_linha_valor || ''} onChange={e => handleLinhaChange(index, 'dre_linha_valor', e.target.value.toUpperCase())} className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded" />}
                  </td>
                  <td className="px-1"><select value={linha.visao_id || ''} onChange={e => handleLinhaChange(index, 'visao_id', e.target.value || null)} className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded"><option value="">Padrão</option>{visoes.map(v => <option key={v.id} value={v.id}>{v.vis_nome}</option>)}</select></td>
                  <td className="px-2"><button onClick={() => removeLinha(linha._internalKey)} className="text-red-500"><i className="fas fa-times"></i></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title="Buscar Conta">
        <input type="text" value={accountSearchQuery} onChange={e => setAccountSearchQuery(e.target.value)} placeholder="Pesquisar..." className="w-full px-3 py-2 bg-gray-700 text-white rounded mb-4" autoFocus />
        <div className="max-h-60 overflow-y-auto">
            {isSearchingAccounts ? <div className="text-center py-4">Buscando...</div> : accountSearchResults.map(c => <div key={c.conta_estru} onClick={() => selectAccount(c)} className="p-2 hover:bg-indigo-600 cursor-pointer text-sm border-b border-gray-700">{c.conta_estru} - {c.conta_descri}</div>)}
        </div>
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Prévia da Estrutura" size="4xl">
        {isViewLoading ? <div className="text-center py-8">Carregando...</div> : (
            <table className="min-w-full text-xs">
                <thead className="bg-gray-700 text-gray-400"><tr><th className="p-2 text-left">SEQ</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Valor/Conta</th></tr></thead>
                <tbody>{viewData.map(r => <tr key={r.dre_linha_seq} className="border-b border-gray-700"><td className="p-2">{r.dre_linha_seq}</td><td className="p-2">{r.dre_linha_descri}</td><td className="p-2">{r.tipo_linha}</td><td className="p-2">{r.dre_linha_valor_descri}</td></tr>)}</tbody>
            </table>
        )}
      </Modal>
    </div>
  );
};

export default TemplateEditPage;
