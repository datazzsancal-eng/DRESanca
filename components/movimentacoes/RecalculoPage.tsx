import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle2, AlertCircle, Loader2, Play, Search, X, Plus } from 'lucide-react';

interface Empresa {
  id: string;
  emp_nome: string;
  emp_cnpj: string;
  emp_cnpj_raiz: string;
  emp_cod_integra: string | null;
  emp_nome_reduz: string | null;
  emp_nome_cmpl: string | null;
}

interface Periodo {
  retorno: number;
  display: string;
}

interface CorpPeriodo extends Periodo {
  cliente_id: string;
  visao_id: string;
}

type RecalculoStatus = 'idle' | 'processing' | 'success' | 'error';

interface EmpresaRecalculoState {
  empresa: Empresa;
  status: RecalculoStatus;
  error?: string;
  availablePeriods: Periodo[];
  selectedPeriods: Set<number>;
}

const FILLER_CLIENT_ID = '54c506f0-d07e-4335-9071-8f2fa6d88309';

const RecalculoPage: React.FC = () => {
  const { selectedClient, user, profile } = useAuth();
  const [recalculoStates, setRecalculoStates] = useState<EmpresaRecalculoState[]>([]);
  const [corpPeriods, setCorpPeriods] = useState<CorpPeriodo[]>([]);
  const [corpProcessing, setCorpProcessing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showManualCorp, setShowManualCorp] = useState(false);
  const [manualCorpPeriod, setManualCorpPeriod] = useState('');

  const lastLoadedClientId = useRef<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedClient || !user) {
        setRecalculoStates([]);
        setCorpPeriods([]);
        lastLoadedClientId.current = null;
        return;
      }

      if (lastLoadedClientId.current === selectedClient.id && recalculoStates.length > 0) {
        return;
      }

      setLoading(true);
      setGlobalError(null);

      try {
        let hasFullAccess = false;
        const allowedEmpresaIds = new Set<string>();

        if (profile?.function === 'MASTER') {
          hasFullAccess = true;
        } else {
          const { data: relData, error: relError } = await supabase
            .from('rel_prof_cli_empr')
            .select('empresa_id')
            .eq('profile_id', user.id)
            .eq('cliente_id', selectedClient.id)
            .eq('rel_situacao_id', 'ATV');

          if (relError) throw relError;

          if (relData) {
            relData.forEach((item: any) => {
              if (item.empresa_id === null) {
                hasFullAccess = true;
              } else {
                allowedEmpresaIds.add(item.empresa_id);
              }
            });
          }
        }

        // Fetch Empresas
        const { data: empData, error: empError } = await supabase
          .from('dre_empresa')
          .select('id, emp_nome, emp_cnpj, emp_cnpj_raiz, emp_cod_integra, emp_nome_reduz, emp_nome_cmpl')
          .eq('cliente_id', selectedClient.id)
          .order('emp_nome_reduz');

        if (empError) throw empError;

        const filteredEmpresas = hasFullAccess 
          ? (empData || []) 
          : (empData || []).filter(e => allowedEmpresaIds.has(e.id));

        const integraIds = filteredEmpresas.map(e => e.emp_cod_integra).filter(Boolean) as string[];

        // Fetch Periods for these companies
        const { data: pData, error: pError } = await supabase
          .from('viw_periodo_calc')
          .select('emp_cod_integra, retorno, display')
          .in('emp_cod_integra', integraIds)
          .order('retorno', { ascending: false });

        if (pError) throw pError;

        // Group periods by integra_id
        const periodsByIntegra = new Map<string, Periodo[]>();
        pData?.forEach(p => {
          const list = periodsByIntegra.get(p.emp_cod_integra) || [];
          if (!list.find(item => item.retorno === p.retorno)) {
            list.push({ retorno: p.retorno, display: p.display });
          }
          periodsByIntegra.set(p.emp_cod_integra, list);
        });

        // Special logic for Filler Client (Corporate)
        const isFillerClient = selectedClient.id === FILLER_CLIENT_ID || 
                              selectedClient.cli_nome?.toUpperCase().includes('FILLER');

        if (isFillerClient) {
          console.log("Detectado cliente Filler - Buscando períodos corporativos através da view viw_filler_corp_periodo...");
          
          const { data: viewData, error: viewError } = await supabase
            .from('viw_filler_corp_periodo')
            .select('retorno, display, cliente_id, visao_id')
            .eq('cliente_id', selectedClient.id)
            .order('retorno', { ascending: false });
          
          if (viewError) {
            console.error("Erro ao carregar viw_filler_corp_periodo:", viewError);
            // Fallback para a tabela física se a view falhar (opcional, mas seguro por enqto)
            const { data: rawData } = await supabase.from('dre_calc_filler_corp').select('*');
            if (rawData && rawData.length > 0) {
              const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
              const normalized = rawData.map((c: any) => ({
                retorno: Number(c.retorno || c.crg_periodo || c.periodo),
                display: c.display || (c.retorno ? `${monthNames[(c.retorno % 100) - 1]}/${Math.floor(c.retorno / 100)}` : 'S/D'),
                cliente_id: c.cliente_id || selectedClient.id,
                visao_id: c.visao_id || ''
              })).filter(c => !isNaN(c.retorno));
              setCorpPeriods(Array.from(new Map(normalized.map(i => [i.retorno, i])).values()) as CorpPeriodo[]);
            }
          } else if (viewData && viewData.length > 0) {
            const normalizedCorp = viewData.map((v: any) => ({
              retorno: Number(v.retorno),
              display: v.display || v.retorno.toString(), // Caso o campo de texto venha com outro nome ou nulo
              cliente_id: v.cliente_id,
              visao_id: v.visao_id
            }));

            // Remover duplicados (DISTINCT)
            const uniqueCorp = Array.from(
              new Map(normalizedCorp.map(item => [item.retorno, item])).values()
            );

            setCorpPeriods(uniqueCorp as CorpPeriodo[]);
          } else {
            console.warn("Nenhum dado retornado de viw_filler_corp_periodo");
            setCorpPeriods([]);
          }
        } else {
          setCorpPeriods([]);
        }

        setRecalculoStates(filteredEmpresas.map(emp => ({
          empresa: emp,
          status: 'idle',
          availablePeriods: periodsByIntegra.get(emp.emp_cod_integra || '') || [],
          selectedPeriods: new Set<number>()
        })));
        
        lastLoadedClientId.current = selectedClient.id;
      } catch (err: any) {
        console.error("Erro ao carregar dados:", err);
        setGlobalError(`Falha ao carregar dados: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedClient?.id, user?.id, profile?.function]);

  const togglePeriod = (empresaId: string, retorno: number) => {
    setRecalculoStates(prev => prev.map(state => {
      if (state.empresa.id === empresaId) {
        const next = new Set(state.selectedPeriods);
        if (next.has(retorno)) next.delete(retorno);
        else next.add(retorno);
        return { ...state, selectedPeriods: next };
      }
      return state;
    }));
  };

  const handleCorpRecalculo = async (p: CorpPeriodo) => {
    if (corpProcessing !== null || isBatchProcessing) return;
    
    setCorpProcessing(p.retorno);
    setGlobalError(null);
    setGlobalSuccess(null);

    try {
      const corpWebhookUrl = 'https://webhook.synapiens.com.br/webhook/corp';
      const payload = {
        periodo: p.retorno,
        cliente_id: p.cliente_id,
        visao_id: p.visao_id
      };

      const response = await fetch(corpWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      
      setGlobalSuccess(`Recálculo Corporativo enviado para o período ${p.display}.`);
    } catch (err: any) {
      console.error("Erro no recálculo corporativo:", err);
      setGlobalError(`Falha no recálculo corporativo: ${err.message}`);
    } finally {
      setCorpProcessing(null);
    }
  };

  const handleManualCorpRecalculo = () => {
    if (!manualCorpPeriod || manualCorpPeriod.length !== 6 || isNaN(Number(manualCorpPeriod))) {
      alert("Por favor, insira o período no formato YYYYMM (ex: 202603)");
      return;
    }

    const ano = manualCorpPeriod.substring(0, 4);
    const mesNum = Number(manualCorpPeriod.substring(4, 6));
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const display = `${monthNames[mesNum - 1] || '???'}/${ano}`;

    const manualPeriodObj: CorpPeriodo = {
      retorno: Number(manualCorpPeriod),
      display: display,
      cliente_id: selectedClient?.id || FILLER_CLIENT_ID,
      visao_id: 'e4267bff-0efe-47de-af32-e6d8dc9cb690' // Visão padrão informada anteriormente
    };

    handleCorpRecalculo(manualPeriodObj);
    setShowManualCorp(false);
    setManualCorpPeriod('');
  };

  const selectAll = (select: boolean) => {
    setRecalculoStates(prev => prev.map(state => {
      const next = select 
        ? new Set(state.availablePeriods.map(p => p.retorno))
        : new Set<number>();
      return { ...state, selectedPeriods: next };
    }));
  };

  const handleBatchRecalculo = async () => {
    const payloads: any[] = [];
    
    recalculoStates.forEach(state => {
      state.selectedPeriods.forEach(retorno => {
        const ano = Math.floor(retorno / 100);
        const mes = retorno % 100;
        
        payloads.push({
          empresaId: state.empresa.id,
          empresaNome: state.empresa.emp_nome_reduz || state.empresa.emp_nome,
          retorno,
          data: {
            file_path: "", // Recálculo não tem upload novo
            bucket: "movto_upload",
            table: "dre_calc_contabil",
            on_conflict: "id",
            cliente_id: selectedClient?.id,
            emp_cod_integra: state.empresa.emp_cod_integra,
            cnpj_emp: state.empresa.emp_cnpj,
            crg_emp_periodo_ano: ano,
            crg_emp_periodo_mes: mes,
            user_id: user?.email,
            empresa_id: state.empresa.id
          }
        });
      });
    });

    if (payloads.length === 0) {
      setGlobalError("Nenhum período selecionado para recálculo.");
      return;
    }

    setIsBatchProcessing(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    const calcWebhookUrl = (import.meta as any).env?.VITE_CALC_WEBHOOK_URL || 'https://webhook.synapiens.com.br/webhook/calc_dre';
    let successCount = 0;
    let failCount = 0;

    for (const item of payloads) {
      try {
        // Atualiza status da empresa para processing
        setRecalculoStates(prev => prev.map(s => 
          s.empresa.id === item.empresaId ? { ...s, status: 'processing' } : s
        ));

        const response = await fetch(calcWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);
        
        successCount++;
      } catch (err) {
        console.error(`Erro ao recalcular ${item.empresaNome} (${item.retorno}):`, err);
        failCount++;
      }
    }

    setRecalculoStates(prev => prev.map(s => ({ ...s, status: 'idle' })));
    setIsBatchProcessing(false);

    if (failCount === 0) {
      setGlobalSuccess(`Sucesso! ${successCount} recálculos processados.`);
    } else {
      setGlobalError(`${failCount} falhas e ${successCount} sucessos no processamento.`);
    }
  };

  const totalSelectedCount = recalculoStates.reduce((acc, s) => acc + s.selectedPeriods.size, 0);

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-gray-300 space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white">Recálculo</h2>
          <p className="text-gray-400 mt-1">Selecione os períodos que deseja recalcular para cada empresa</p>
        </div>
        <div className="px-4 py-2 bg-indigo-900/20 border border-indigo-700 rounded-lg">
          <p className="text-xs font-bold text-indigo-400 uppercase">Cliente Selecionado</p>
          <p className="text-sm font-semibold text-white">{selectedClient?.cli_nome || 'Nenhum'}</p>
        </div>
      </div>

      {globalError && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{globalError}</p>
        </div>
      )}

      {globalSuccess && (
        <div className="p-4 bg-green-900/30 border border-green-800 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p>{globalSuccess}</p>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-gray-700/30 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <h3 className="font-semibold text-white whitespace-nowrap">Recursos disponíveis ({recalculoStates.length + (corpPeriods.length > 0 ? 1 : 0)})</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nome, integra ou cnpj..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <button
              onClick={() => selectAll(true)}
              className="px-3 py-1.5 text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg border border-gray-600"
            >
              Selecionar Tudo
            </button>
            <button
              onClick={() => selectAll(false)}
              className="px-3 py-1.5 text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg border border-gray-600"
            >
              Limpar Seleção
            </button>
            <button
              onClick={handleBatchRecalculo}
              disabled={isBatchProcessing || totalSelectedCount === 0}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-900/20"
            >
              {isBatchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isBatchProcessing ? 'Processando...' : `Recalcular (${totalSelectedCount})`}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-700">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando dados e períodos...</p>
            </div>
          ) : (
            <>
              {/* Linha Especial Corporativo */}
              {(selectedClient?.id === FILLER_CLIENT_ID || selectedClient?.cli_nome?.toUpperCase().includes('FILLER')) && (
                <div className="p-4 bg-indigo-900/10 border-b border-indigo-800/50">
                   <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-[250px]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <h4 className="font-black text-indigo-400 uppercase tracking-wider">CORPORATIVO</h4>
                        </div>
                        <p className="text-[10px] text-indigo-500 font-bold mt-1 uppercase">Processamento imediato ao clicar</p>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {corpPeriods.length > 0 ? (
                            corpPeriods.map(p => (
                              <button
                                key={p.retorno}
                                onClick={() => handleCorpRecalculo(p)}
                                disabled={corpProcessing !== null || isBatchProcessing}
                                className={`px-3 py-1.5 text-[10px] font-black rounded-md border transition-all flex items-center gap-2 ${
                                  corpProcessing === p.retorno
                                    ? 'bg-yellow-600 border-yellow-500 text-white animate-pulse'
                                    : 'bg-indigo-800 border-indigo-600 text-white hover:bg-indigo-700'
                                } shadow-lg shadow-indigo-900/20`}
                              >
                                {corpProcessing === p.retorno ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                                {p.display}
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-indigo-400/60 italic mr-4">Nenhum período corporativo disponível</span>
                          )}

                          {corpPeriods.length === 0 && (
                            showManualCorp ? (
                              <div className="flex items-center gap-2 bg-indigo-900/20 p-1.5 rounded-md border border-indigo-500/30 animate-in fade-in slide-in-from-left-2">
                                <input
                                  type="text"
                                  placeholder="YYYYMM"
                                  maxLength={6}
                                  value={manualCorpPeriod}
                                  onChange={(e) => setManualCorpPeriod(e.target.value.replace(/\D/g, ''))}
                                  className="w-20 bg-gray-900 border border-indigo-500/50 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-400 font-mono"
                                />
                                <button
                                  onClick={handleManualCorpRecalculo}
                                  className="p-1 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                                  title="Confirmar"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => { setShowManualCorp(false); setManualCorpPeriod(''); }}
                                  className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowManualCorp(true)}
                                className="px-3 py-1.5 text-[10px] font-black rounded-md border border-indigo-500/50 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/10"
                              >
                                <Plus className="w-3 h-3" />
                                NOVO CÁLCULO
                              </button>
                            )
                          )}
                        </div>
                        
                        {corpProcessing !== null && (
                          <div className="mt-3 h-1 w-full bg-indigo-900/50 rounded-full overflow-hidden">
                            <div className="h-full animate-progress-indefinite bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              )}

              {recalculoStates.length === 0 && corpPeriods.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <p>Nenhuma empresa encontrada para este cliente.</p>
                </div>
              ) : (
                recalculoStates
                  .filter(state => {
                    const term = searchTerm.toLowerCase();
                    return (
                      state.empresa.emp_nome_reduz?.toLowerCase().includes(term) ||
                      state.empresa.emp_nome_cmpl?.toLowerCase().includes(term) ||
                      state.empresa.emp_cod_integra?.toLowerCase().includes(term) ||
                      state.empresa.emp_cnpj?.toLowerCase().includes(term)
                    );
                  })
                  .map((state) => (
                    <div 
                      key={state.empresa.id} 
                      className="p-4 hover:bg-gray-700/20 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 min-w-[250px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-400 font-mono bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-800/50">
                              {state.empresa.emp_cod_integra || '---'}
                            </span>
                            <h4 className="font-bold text-white truncate">{state.empresa.emp_nome_reduz || state.empresa.emp_nome}</h4>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                            <span>{state.empresa.emp_cnpj}</span>
                            {state.empresa.emp_nome_cmpl && <span className="truncate max-w-[200px]">• {state.empresa.emp_nome_cmpl}</span>}
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-1.5">
                            {state.availablePeriods.length > 0 ? (
                              state.availablePeriods.map(p => (
                                <button
                                  key={p.retorno}
                                  onClick={() => togglePeriod(state.empresa.id, p.retorno)}
                                  disabled={isBatchProcessing}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                                    state.selectedPeriods.has(p.retorno)
                                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/30'
                                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                                  }`}
                                >
                                  {p.display}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-gray-600 italic">Sem períodos calculados</span>
                            )}
                          </div>

                          {state.status === 'processing' && (
                            <div className="mt-3 h-1 w-full bg-gray-900 rounded-full overflow-hidden">
                              <div className="h-full animate-progress-indefinite bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes progress-indefinite {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress-indefinite {
          width: 50%;
          animation: progress-indefinite 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default RecalculoPage;
