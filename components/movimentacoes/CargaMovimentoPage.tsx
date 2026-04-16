import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, Upload, FileText, Play, X, Search } from 'lucide-react';

interface Empresa {
  id: string;
  emp_nome: string;
  emp_cnpj: string;
  emp_cnpj_raiz: string;
  emp_cod_integra: string | null;
  emp_nome_reduz: string | null;
  emp_nome_cmpl: string | null;
}

type OverallStatus = 'idle' | 'waiting' | 'processing' | 'success' | 'error';
type CargaStatus = 'idle' | 'uploading' | 'upload_success' | 'processing' | 'success' | 'error';
type CalcStatus = 'idle' | 'processing' | 'success' | 'error';

interface EmpresaProcessState {
  empresa: Empresa;
  file: File | null;
  status: OverallStatus;
  cargaStatus: CargaStatus;
  cargaError?: string;
  calcStatus: CalcStatus;
  calcError?: string;
}

const CargaMovimentoPage: React.FC = () => {
  const { selectedClient, user, profile } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [processStates, setProcessStates] = useState<EmpresaProcessState[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1];
  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
  ];

  const lastLoadedClientId = useRef<string | null>(null);

  useEffect(() => {
    const fetchEmpresasPermitidas = async () => {
      if (!selectedClient || !user) {
        setEmpresas([]);
        setProcessStates([]);
        lastLoadedClientId.current = null;
        return;
      }

      // Prevent redundant fetches if the client hasn't changed
      if (lastLoadedClientId.current === selectedClient.id && empresas.length > 0) {
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

        const { data: empData, error: empError } = await supabase
          .from('dre_empresa')
          .select('id, emp_nome, emp_cnpj, emp_cnpj_raiz, emp_cod_integra, emp_nome_reduz, emp_nome_cmpl')
          .eq('cliente_id', selectedClient.id)
          .order('emp_nome_reduz');

        if (empError) throw empError;

        const finalEmpresas = hasFullAccess 
          ? (empData || []) 
          : (empData || []).filter(e => allowedEmpresaIds.has(e.id));

        setEmpresas(finalEmpresas);
        setProcessStates(finalEmpresas.map(emp => ({
          empresa: emp,
          file: null,
          status: 'idle',
          cargaStatus: 'idle',
          calcStatus: 'idle'
        })));
        
        lastLoadedClientId.current = selectedClient.id;
      } catch (err: any) {
        console.error("Erro ao buscar empresas:", err);
        setGlobalError(`Falha ao carregar empresas: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresasPermitidas();
  }, [selectedClient?.id, user?.id, profile?.function]);

  const handleFileChange = (empresaId: string, file: File | null) => {
    setProcessStates(prev => prev.map(state => 
      state.empresa.id === empresaId ? { 
        ...state, 
        file, 
        status: file ? 'waiting' : 'idle', 
        cargaStatus: 'idle',
        calcStatus: 'idle',
        cargaError: undefined,
        calcError: undefined
      } : state
    ));
  };

  const updateState = (empresaId: string, updates: Partial<EmpresaProcessState>) => {
    setProcessStates(prev => prev.map(state => 
      state.empresa.id === empresaId ? { ...state, ...updates } : state
    ));
  };

  const processSingleEmpresa = async (state: EmpresaProcessState) => {
    if (!state.file || !selectedClient) return;

    const { empresa, file } = state;
    const periodo = `${selectedYear}${selectedMonth.toString().padStart(2, '0')}`;

    try {
      // 1. Uploading
      updateState(empresa.id, { status: 'processing', cargaStatus: 'uploading', cargaError: undefined, calcError: undefined });
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${selectedClient.id}/${empresa.emp_cnpj_raiz}/${periodo}/${timestamp}_${safeFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('movto_upload')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        updateState(empresa.id, { status: 'error', cargaStatus: 'error', cargaError: 'Erro de upload' });
        throw uploadError;
      }

      updateState(empresa.id, { cargaStatus: 'upload_success' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to show status

      // 2. Processing (Webhook)
      updateState(empresa.id, { cargaStatus: 'processing' });
      const webhookUrl = (import.meta as any).env?.VITE_MOVTO_WEBHOOK_URL || 'https://webhook.synapiens.com.br/webhook/movto_upsert';
      
      const payload = {
        file_path: uploadData?.path || filePath,
        bucket: "movto_upload",
        table: "dre_carga_contabil",
        on_conflict: "id",
        cliente_id: selectedClient.id,
        emp_cod_integra: empresa.emp_cod_integra,
        cnpj_emp: empresa.emp_cnpj,
        crg_emp_periodo_ano: selectedYear,
        crg_emp_periodo_mes: selectedMonth
      };

      let webhookRes;
      try {
        webhookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr: any) {
        console.error("Erro de conexão com o webhook:", fetchErr);
        throw new Error(`Falha de conexão com o servidor (CORS ou rede): ${fetchErr.message}`);
      }

      if (!webhookRes.ok) {
        const detail = await webhookRes.text().catch(() => '');
        throw new Error(`Erro na carga: ${webhookRes.status} ${detail}`);
      }

      updateState(empresa.id, { cargaStatus: 'success' });

      // 3. Calculating (Second Webhook)
      updateState(empresa.id, { calcStatus: 'processing' });
      const calcWebhookUrl = (import.meta as any).env?.VITE_CALC_WEBHOOK_URL || 'https://webhook.synapiens.com.br/webhook/calc_dre';
      
      const calcPayload = {
        ...payload,
        table: "dre_calc_contabil",
        user_id: user?.email,
        empresa_id: empresa.id
      };

      let calcWebhookRes;
      try {
        calcWebhookRes = await fetch(calcWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calcPayload),
        });
      } catch (calcErr: any) {
        console.error("Erro de conexão com o webhook de cálculo:", calcErr);
        throw new Error(`Falha de conexão com o servidor de cálculo: ${calcErr.message}`);
      }

      if (!calcWebhookRes.ok) {
        const detail = await calcWebhookRes.text().catch(() => '');
        throw new Error(`Erro no cálculo: ${calcWebhookRes.status} ${detail}`);
      }

      updateState(empresa.id, { status: 'success', calcStatus: 'success' });
    } catch (err: any) {
      console.error(`Erro processando ${empresa.emp_nome}:`, err);
      const errorMessage = err.message?.includes('Erro de upload') ? 'Erro de upload' : (err.message || 'Erro na carga');
      
      setProcessStates(prev => prev.map(s => {
        if (s.empresa.id === empresa.id) {
          if (s.calcStatus === 'processing') {
             return { ...s, status: 'error', calcStatus: 'error', calcError: errorMessage };
          } else {
             return { ...s, status: 'error', cargaStatus: 'error', cargaError: errorMessage };
          }
        }
        return s;
      }));
      throw err;
    }
  };

  const handleBatchProcess = async () => {
    const toProcess = processStates.filter(s => s.file && s.status !== 'success');
    if (toProcess.length === 0) {
      setGlobalError("Nenhum arquivo selecionado para processamento.");
      return;
    }

    setIsBatchProcessing(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    for (const state of toProcess) {
      try {
        await processSingleEmpresa(state);
      } catch (e) {
        // Continue to next company even if one fails
        console.warn(`Falha na empresa ${state.empresa.emp_nome}, continuando...`);
      }
    }

    setIsBatchProcessing(false);
    setGlobalSuccess("Processamento em lote concluído.");
  };

  const getCargaStatusIcon = (status: CargaStatus) => {
    switch (status) {
      case 'idle': return <Circle className="w-4 h-4 text-gray-600" />;
      case 'uploading': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'upload_success': return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getCargaStatusText = (status: CargaStatus) => {
    switch (status) {
      case 'idle': return 'Aguardando...';
      case 'uploading': return 'Enviando arquivo...';
      case 'upload_success': return 'Upload efetuado';
      case 'processing': return 'Início da carga...';
      case 'success': return 'Carga executada com sucesso';
      case 'error': return 'Erro na carga';
    }
  };

  const getCalcStatusIcon = (status: CalcStatus) => {
    switch (status) {
      case 'idle': return <Circle className="w-4 h-4 text-gray-600" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getCalcStatusText = (status: CalcStatus) => {
    switch (status) {
      case 'idle': return 'Aguardando...';
      case 'processing': return 'Executando cálculos...';
      case 'success': return 'Cálculo executado com sucesso';
      case 'error': return 'Erro no cálculo';
    }
  };

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-gray-300 space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white">Carga do Movimento</h2>
          <p className="text-gray-400 mt-1">{selectedClient?.cli_nome || 'Selecione um cliente'}</p>
        </div>
        
        <div className="flex gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Mês</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              disabled={isBatchProcessing}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Ano</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={isBatchProcessing}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
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
            <h3 className="font-semibold text-white whitespace-nowrap">Empresas Disponíveis ({processStates.length})</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nome, integra ou cnpj..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={handleBatchProcess}
            disabled={isBatchProcessing || processStates.every(s => !s.file || s.status === 'success')}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-900/20"
          >
            {isBatchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isBatchProcessing ? 'Processando Lote...' : 'Processar Carga do Movimento'}
          </button>
        </div>

        <div className="divide-y divide-gray-700">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando empresas...</p>
            </div>
          ) : processStates.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>Nenhuma empresa encontrada para este cliente.</p>
            </div>
          ) : (
            processStates
              .filter(state => {
                const term = searchTerm.toLowerCase();
                return (
                  state.empresa.emp_nome_reduz?.toLowerCase().includes(term) ||
                  state.empresa.emp_nome_cmpl?.toLowerCase().includes(term) ||
                  state.empresa.emp_cod_integra?.toLowerCase().includes(term) ||
                  state.empresa.emp_cnpj?.toLowerCase().includes(term) ||
                  state.empresa.emp_nome?.toLowerCase().includes(term)
                );
              })
              .map((state) => (
              <div key={state.empresa.id} className={`p-4 transition-colors ${state.status === 'processing' ? 'bg-indigo-900/10' : 'hover:bg-gray-700/30'}`}>
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {state.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                      {state.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                      
                      <span className="text-xs font-bold text-indigo-400 font-mono bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-800/50">
                        {state.empresa.emp_cod_integra || '---'}
                      </span>
                      <h4 className="font-bold text-white truncate">{state.empresa.emp_nome_reduz || state.empresa.emp_nome}</h4>
                      {state.empresa.emp_nome_cmpl && state.empresa.emp_nome_cmpl !== state.empresa.emp_nome_reduz && (
                        <span className="text-xs text-gray-400 truncate hidden md:inline">
                          ({state.empresa.emp_nome_cmpl})
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{state.empresa.emp_cnpj}</span>
                    </div>
                    
                    {/* Status Sequences */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Carga Sequence */}
                      <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">1. Carga de Dados</div>
                        <div className="flex items-center gap-2">
                          {getCargaStatusIcon(state.cargaStatus)}
                          <span className={`text-xs font-medium ${
                            state.cargaStatus === 'success' ? 'text-green-500' : 
                            state.cargaStatus === 'error' ? 'text-red-500' : 
                            state.cargaStatus === 'idle' ? 'text-gray-500' : 'text-blue-400'
                          }`}>
                            {getCargaStatusText(state.cargaStatus)}
                          </span>
                        </div>
                        {state.cargaError && <div className="text-xs text-red-400 italic mt-1 truncate" title={state.cargaError}>— {state.cargaError}</div>}
                        
                        {/* Progress Bar Carga */}
                        {(state.cargaStatus === 'uploading' || state.cargaStatus === 'processing') && (
                          <div className="mt-2 h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full animate-progress-indefinite ${
                              state.cargaStatus === 'uploading' ? 'bg-blue-500' : 'bg-yellow-500'
                            }`} />
                          </div>
                        )}
                      </div>

                      {/* Calc Sequence */}
                      <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">2. Cálculo DRE</div>
                        <div className="flex items-center gap-2">
                          {getCalcStatusIcon(state.calcStatus)}
                          <span className={`text-xs font-medium ${
                            state.calcStatus === 'success' ? 'text-green-500' : 
                            state.calcStatus === 'error' ? 'text-red-500' : 
                            state.calcStatus === 'idle' ? 'text-gray-500' : 'text-purple-400'
                          }`}>
                            {getCalcStatusText(state.calcStatus)}
                          </span>
                        </div>
                        {state.calcError && <div className="text-xs text-red-400 italic mt-1 truncate" title={state.calcError}>— {state.calcError}</div>}
                        
                        {/* Progress Bar Calc */}
                        {state.calcStatus === 'processing' && (
                          <div className="mt-2 h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full animate-progress-indefinite bg-purple-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 lg:mt-0">
                    <div className="relative group flex items-center gap-2">
                      <input
                        type="file"
                        id={`file-${state.empresa.id}`}
                        className="hidden"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={(e) => {
                          handleFileChange(state.empresa.id, e.target.files?.[0] || null);
                          e.target.value = ''; // Reset value to allow re-selecting the same file
                        }}
                        disabled={isBatchProcessing || state.status === 'success'}
                      />
                      <label
                        htmlFor={`file-${state.empresa.id}`}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
                          state.file 
                            ? 'border-indigo-500 bg-indigo-900/20 text-indigo-300' 
                            : 'border-gray-600 hover:border-gray-500 text-gray-400'
                        } ${isBatchProcessing || state.status === 'success' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {state.file ? <FileText className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                        <span className="text-sm font-medium truncate max-w-[150px]">
                          {state.file ? state.file.name : 'Selecionar Arquivo'}
                        </span>
                      </label>

                      {state.file && !isBatchProcessing && state.status !== 'success' && (
                        <button
                          onClick={() => handleFileChange(state.empresa.id, null)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-full hover:bg-red-900/20"
                          title="Limpar arquivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
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

export default CargaMovimentoPage;
