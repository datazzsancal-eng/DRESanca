import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Shuttle from '../shared/Shuttle';
import { useAuth } from '../../contexts/AuthContext';

// Type definitions
interface Cliente { id: string; cli_nome: string; }
interface Empresa { id: string; emp_nome: string; emp_cnpj_raiz: string; emp_nome_reduz: string | null; emp_nome_cmpl: string | null; emp_cnpj: string | null; emp_cod_integra: string | null; }
interface TipoVisao { id: number; tpvis_nome: string; }
interface VisaoHeader {
  id?: string;
  vis_nome: string;
  tipo_visao_id: number | null;
  cliente_id: string | null;
  cnpj_raiz: string | null;
  vis_descri: string | null;
  vis_ativo_sn: string;
}

const initialHeaderState: VisaoHeader = {
  vis_nome: '',
  tipo_visao_id: null,
  cliente_id: null,
  cnpj_raiz: null,
  vis_descri: null,
  vis_ativo_sn: 'S',
};

interface VisaoEditPageProps {
  visaoId: string | 'new';
  onBack: () => void;
}

const VisaoEditPage: React.FC<VisaoEditPageProps> = ({ visaoId, onBack }) => {
  const { user } = useAuth();
  
  const [headerData, setHeaderData] = useState<VisaoHeader>(initialHeaderState);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposVisao, setTiposVisao] = useState<TipoVisao[]>([]);
  const [empresasDoCliente, setEmpresasDoCliente] = useState<Empresa[]>([]);
  const [selectedEmpresas, setSelectedEmpresas] = useState<Set<string>>(new Set());
  const [selectedGrupoCnpjs, setSelectedGrupoCnpjs] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permission State
  const [userPermissions, setUserPermissions] = useState<{
      allowedClientIds: Set<string>,
      clientFullAccess: Set<string>,
      allowedCompanyIds: Set<string>
  }>({ 
      allowedClientIds: new Set(), 
      clientFullAccess: new Set(),
      allowedCompanyIds: new Set()
  });

  const tiposVisaoMap = useMemo(() => new Map(tiposVisao.map(t => [t.id, t.tpvis_nome])), [tiposVisao]);
  const tipoVisaoAtual = useMemo(() => headerData.tipo_visao_id ? tiposVisaoMap.get(headerData.tipo_visao_id) : null, [headerData.tipo_visao_id, tiposVisaoMap]);

  const cnpjsComNomes = useMemo(() => {
    if (!empresasDoCliente) return [];
    const map = new Map<string, string>();
    empresasDoCliente.forEach(empresa => {
        if (empresa.emp_cnpj_raiz && !map.has(empresa.emp_cnpj_raiz)) {
            const displayName = empresa.emp_nome_reduz || empresa.emp_nome || 'NOME INDISPONÍVEL';
            map.set(empresa.emp_cnpj_raiz, displayName);
        }
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [empresasDoCliente]);

  const empresaItems = useMemo(() => {
    return empresasDoCliente.map(e => {
        const cnpjPart = `(${e.emp_cnpj || 'Sem CNPJ'})`;
        const nomeReduzCmpl = [e.emp_nome_reduz, e.emp_nome_cmpl].filter(Boolean).join(' ');
        const label = nomeReduzCmpl 
            ? `${cnpjPart} ${nomeReduzCmpl}` 
            : `${cnpjPart} ${e.emp_nome}`;
        return { id: e.id, label };
    });
  }, [empresasDoCliente]);

  const empresaLabelsMap = useMemo(() => new Map(empresaItems.map(item => [item.id, item.label])), [empresaItems]);


  // Initial Data Fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return;
      try {
        // 1. Fetch User Permissions
        const { data: relData, error: relError } = await supabase
            .from('rel_prof_cli_empr')
            .select('cliente_id, empresa_id')
            .eq('profile_id', user.id)
            .eq('rel_situacao_id', 'ATV');

        if (relError) throw relError;

        const perms = {
            allowedClientIds: new Set<string>(),
            clientFullAccess: new Set<string>(),
            allowedCompanyIds: new Set<string>()
        };

        if (relData) {
            relData.forEach((r: any) => {
                if (r.cliente_id) perms.allowedClientIds.add(r.cliente_id);
                if (r.empresa_id === null) {
                    if (r.cliente_id) perms.clientFullAccess.add(r.cliente_id);
                } else {
                    perms.allowedCompanyIds.add(r.empresa_id);
                }
            });
        }
        setUserPermissions(perms);

        // 2. Fetch Reference Data
        const [clientesRes, tiposRes] = await Promise.all([
          supabase.from('dre_cliente').select('id, cli_nome').in('id', Array.from(perms.allowedClientIds)).order('cli_nome'),
          supabase.from('tab_tipo_visao').select('id, tpvis_nome').eq('tpvis_visivel_sn', 'S').order('tpvis_nome'),
        ]);
        if (clientesRes.error) throw clientesRes.error;
        if (tiposRes.error) throw tiposRes.error;
        
        setClientes(clientesRes.data || []);
        setTiposVisao(tiposRes.data || []);

        if (visaoId !== 'new') {
          const { data, error: visaoError } = await supabase.from('dre_visao').select('*').eq('id', visaoId).single();
          if (visaoError) throw visaoError;
          
          // Security Check: Ensure user has access to this vision's client
          if (!perms.allowedClientIds.has(data.cliente_id)) {
              throw new Error("Permissão negada para editar esta visão.");
          }

          setHeaderData({ ...initialHeaderState, ...data });

          const { data: rels, error: relsError } = await supabase.from('rel_visao_empresa').select('empresa_id').eq('visao_id', visaoId);
          if (relsError) throw relsError;
          setSelectedEmpresas(new Set(rels.map(r => r.empresa_id).filter(Boolean) as string[]));

          const { data: grupos, error: gruposError } = await supabase.from('dre_visao_grupo_cnpj').select('cnpj_raiz').eq('visao_id', visaoId);
          if (gruposError) throw gruposError;
          setSelectedGrupoCnpjs(new Set(grupos.map(g => g.cnpj_raiz).filter(Boolean) as string[]));
        }
      } catch (err: any) {
        setError(`Falha ao carregar dados: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [visaoId, user]);

  // Fetch companies and CNPJs when client changes
  useEffect(() => {
    const fetchClientData = async () => {
      if (!headerData.cliente_id) {
        setEmpresasDoCliente([]);
        return;
      }
      setLoading(true);
      try {
        let query = supabase
            .from('dre_empresa')
            .select('id, emp_nome, emp_cnpj_raiz, emp_nome_reduz, emp_nome_cmpl, emp_cnpj, emp_cod_integra')
            .eq('cliente_id', headerData.cliente_id);
        
        // If user DOES NOT have full access, filter companies at fetch level or post-process
        // For security, doing filtered fetch via ID list if list is not empty
        if (!userPermissions.clientFullAccess.has(headerData.cliente_id)) {
             // If allow list is empty (shouldn't happen if client is in allowedClientIds but fullaccess is false), array will be empty -> no rows
             const allowedIds = Array.from(userPermissions.allowedCompanyIds);
             if (allowedIds.length > 0) {
                 query = query.in('id', allowedIds);
             } else {
                 setEmpresasDoCliente([]);
                 setLoading(false);
                 return;
             }
        }

        const { data, error } = await query;
        if (error) throw error;
        setEmpresasDoCliente(data || []);
      } catch (err: any) {
        setError(`Falha ao buscar empresas do cliente: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchClientData();
  }, [headerData.cliente_id, userPermissions]);

  // Auto-select companies based on vision type
  useEffect(() => {
    if (tipoVisaoAtual === 'CUSTOMIZADO') return;
    if (!empresasDoCliente.length) { setSelectedEmpresas(new Set()); return; }
    
    let newSelectedIds = new Set<string>();
    if (tipoVisaoAtual === 'CLIENTE') newSelectedIds = new Set(empresasDoCliente.map(e => e.id));
    else if (tipoVisaoAtual === 'CNPJ RAIZ' && headerData.cnpj_raiz) newSelectedIds = new Set(empresasDoCliente.filter(e => e.emp_cnpj_raiz === headerData.cnpj_raiz).map(e => e.id));
    else if (tipoVisaoAtual === 'GRUPO' && selectedGrupoCnpjs.size > 0) newSelectedIds = new Set(empresasDoCliente.filter(e => e.emp_cnpj_raiz && selectedGrupoCnpjs.has(e.emp_cnpj_raiz)).map(e => e.id));
    
    setSelectedEmpresas(newSelectedIds);
  }, [tipoVisaoAtual, headerData.cnpj_raiz, selectedGrupoCnpjs, empresasDoCliente]);

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;

    if (type === 'checkbox') finalValue = (e.target as HTMLInputElement).checked ? 'S' : 'N';
    else if (name === 'tipo_visao_id') finalValue = value ? parseInt(value, 10) : null;
    else if (name === 'vis_nome') finalValue = value.toUpperCase();
    
    setHeaderData(prev => {
      const newState = { ...prev, [name]: finalValue };
      if (['cliente_id', 'tipo_visao_id'].includes(name)) {
        newState.cnpj_raiz = null;
        setSelectedGrupoCnpjs(new Set());
        setSelectedEmpresas(new Set());
      }
      return newState;
    });
  };

  const handleGrupoCnpjChange = (cnpj: string) => {
    setSelectedGrupoCnpjs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cnpj)) newSet.delete(cnpj); else newSet.add(cnpj);
      return newSet;
    });
  };

  const performUniquenessCheck = async (): Promise<string | null> => {
    const checkType = tipoVisaoAtual;
    if (!checkType || !headerData.cliente_id || ['CUSTOMIZADO'].includes(checkType)) return null;

    let query = supabase.from('dre_visao').select('id, vis_nome, tipo_visao_id, cliente_id, cnpj_raiz, dre_visao_grupo_cnpj(cnpj_raiz)').eq('cliente_id', headerData.cliente_id).eq('tipo_visao_id', headerData.tipo_visao_id!);
    if (visaoId !== 'new') query = query.neq('id', visaoId);
    
    const { data: existingVisions, error: fetchError } = await query;

    if (fetchError) return `Erro ao verificar duplicidade: ${fetchError.message}`;
    if (!existingVisions || existingVisions.length === 0) return null;

    if (checkType === 'CLIENTE') return `Já existe uma visão do tipo 'CLIENTE' para este cliente.`;
    if (checkType === 'CNPJ RAIZ' && existingVisions.some(v => v.cnpj_raiz === headerData.cnpj_raiz)) return `Já existe uma visão para o cliente e CNPJ raiz selecionados.`;
    if (checkType === 'GRUPO') {
      const newCnpjs = Array.from(selectedGrupoCnpjs);
      const conflictingVision = existingVisions.find(v => (v as any).dre_visao_grupo_cnpj.some((g: any) => newCnpjs.includes(g.cnpj_raiz)));
      if (conflictingVision) return `Já existe uma visão ('${conflictingVision.vis_nome}') que inclui um dos CNPJs selecionados para este cliente.`;
    }
    return null;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const uniquenessError = await performUniquenessCheck();
      if (uniquenessError) throw new Error(uniquenessError);
      
      let currentVisaoId = visaoId !== 'new' ? visaoId : undefined;
      const { id, ...headerPayload } = headerData;

      if (visaoId === 'new') {
        const { data, error } = await supabase.from('dre_visao').insert(headerPayload).select().single();
        if (error) throw error;
        currentVisaoId = data.id;
      } else {
        const { error } = await supabase.from('dre_visao').update(headerPayload).eq('id', currentVisaoId);
        if (error) throw error;
      }
      
      if (!currentVisaoId) throw new Error("ID da visão não encontrado.");

      await supabase.from('rel_visao_empresa').delete().eq('visao_id', currentVisaoId);
      if (selectedEmpresas.size > 0) {
        const empresaIntegraMap = new Map(empresasDoCliente.map(e => [e.id, e.emp_cod_integra]));
        const relsPayload = Array.from(selectedEmpresas).map(empId => ({ visao_id: currentVisaoId, empresa_id: empId, empresa_integra_id: empresaIntegraMap.get(empId) || null, rel_vis_emp_atv_sn: 'S' }));
        const { error } = await supabase.from('rel_visao_empresa').insert(relsPayload);
        if (error) throw error;
      }
      
      await supabase.from('dre_visao_grupo_cnpj').delete().eq('visao_id', currentVisaoId);
      if (selectedGrupoCnpjs.size > 0 && tipoVisaoAtual === 'GRUPO') {
        const gruposPayload = Array.from(selectedGrupoCnpjs).map(cnpj => ({ visao_id: currentVisaoId, cnpj_raiz: cnpj }));
        const { error } = await supabase.from('dre_visao_grupo_cnpj').insert(gruposPayload);
        if (error) throw error;
      }
      onBack();
    } catch (err: any) {
      setError(`Falha ao salvar a visão: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{visaoId === 'new' ? 'Nova Visão' : 'Editar Visão'}</h2>
      </div>
      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}
      <div className="p-4 space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white">Dados da Visão</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Nome da Visão</label>
            <input type="text" name="vis_nome" value={headerData.vis_nome} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Cliente</label>
            <select name="cliente_id" value={headerData.cliente_id || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md">
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Tipo de Visão</label>
            <select name="tipo_visao_id" value={headerData.tipo_visao_id || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md">
              <option value="">Selecione...</option>
              {tiposVisao.map(t => {
                  // FILTER TYPES: If user has partial access, only allow 'CUSTOMIZADO'
                  if (headerData.cliente_id && !userPermissions.clientFullAccess.has(headerData.cliente_id)) {
                      if (t.tpvis_nome === 'CUSTOMIZADO') {
                          return <option key={t.id} value={t.id}>{t.tpvis_nome}</option>;
                      }
                      return null;
                  }
                  return <option key={t.id} value={t.id}>{t.tpvis_nome}</option>;
              })}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300">Descrição</label>
            <textarea name="vis_descri" value={headerData.vis_descri || ''} onChange={handleHeaderChange} rows={2} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md"></textarea>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
              <input type="checkbox" name="vis_ativo_sn" checked={headerData.vis_ativo_sn === 'S'} onChange={handleHeaderChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
              <span>Visão Ativa?</span>
            </label>
          </div>
        </div>
      </div>
      
      {tipoVisaoAtual === 'CNPJ RAIZ' && (
        <div className="p-4 space-y-2 bg-gray-900/50 border border-gray-700 rounded-lg">
          <label className="block text-sm font-medium text-gray-300">Selecione o CNPJ Raiz</label>
          <select name="cnpj_raiz" value={headerData.cnpj_raiz || ''} onChange={handleHeaderChange} className="w-full max-w-md px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md">
            <option value="">Selecione...</option>
            {cnpjsComNomes.map(c => <option key={c.cnpj} value={c.cnpj}>{c.nome} ({c.cnpj})</option>)}
          </select>
        </div>
      )}
      {tipoVisaoAtual === 'GRUPO' && (
        <div className="p-4 space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white">CNPJs do Grupo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
            {cnpjsComNomes.map(({ cnpj, nome }) => (
              <label key={cnpj} className="flex items-center p-2 space-x-3 bg-gray-800 rounded-md cursor-pointer hover:bg-gray-700">
                <input type="checkbox" checked={selectedGrupoCnpjs.has(cnpj)} onChange={() => handleGrupoCnpjChange(cnpj)} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                <span className="text-sm text-gray-300">{nome} ({cnpj})</span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      {tipoVisaoAtual === 'CUSTOMIZADO' && (
        <div className="p-4 space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white">Empresas da Visão</h3>
          <Shuttle items={empresaItems} selectedIds={selectedEmpresas} onChange={setSelectedEmpresas} height="350px"/>
        </div>
      )}
      {tipoVisaoAtual && !['CUSTOMIZADO'].includes(tipoVisaoAtual) && (
        <div className="p-4 space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white">Empresas Associadas ({selectedEmpresas.size})</h3>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {empresasDoCliente.filter(e => selectedEmpresas.has(e.id)).map(empresa => {
                const label = empresaLabelsMap.get(empresa.id) || empresa.emp_nome;
                return (
                    <li key={empresa.id} className="px-3 py-2 text-sm text-gray-300 bg-gray-700 rounded-md truncate" title={label}>
                        {label}
                    </li>
                );
            })}
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-700">
        <button onClick={onBack} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 disabled:opacity-50">Voltar</button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">
          {saving ? 'Salvando...' : 'Salvar Visão'}
        </button>
      </div>
    </div>
  );
};

export default VisaoEditPage;