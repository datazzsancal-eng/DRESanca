import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, Upload, FileText, Play } from 'lucide-react';

interface Empresa {
  id: string;
  emp_nome: string;
  emp_cnpj: string;
  emp_cnpj_raiz: string;
}

type ProcessStatus = 'idle' | 'waiting' | 'uploading' | 'processing' | 'calculating' | 'success' | 'error';

interface EmpresaProcessState {
  empresa: Empresa;
  file: File | null;
  status: ProcessStatus;
  error?: string;
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

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1];
  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
  ];

  useEffect(() => {
    const fetchEmpresasPermitidas = async () => {
      if (!selectedClient || !user) {
        setEmpresas([]);
        setProcessStates([]);
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
          .select('id, emp_nome, emp_cnpj, emp_cnpj_raiz')
          .eq('cliente_id', selectedClient.id)
          .order('emp_nome');

        if (empError) throw empError;

        const finalEmpresas = hasFullAccess 
          ? (empData || []) 
          : (empData || []).filter(e => allowedEmpresaIds.has(e.id));

        setEmpresas(finalEmpresas);
        setProcessStates(finalEmpresas.map(emp => ({
          empresa: emp,
          file: null,
          status: 'idle'
        })));
      } catch (err: any) {
        console.error("Erro ao buscar empresas:", err);
        setGlobalError(`Falha ao carregar empresas: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresasPermitidas();
  }, [selectedClient, user, profile]);

  const handleFileChange = (empresaId: string, file: File | null) => {
    setProcessStates(prev => prev.map(state => 
      state.empresa.id === empresaId ? { ...state, file, status: file ? 'waiting' : 'idle', error: undefined } : state
    ));
  };

  const updateEmpresaStatus = (empresaId: string, status: ProcessStatus, error?: string) => {
    setProcessStates(prev => prev.map(state => 
      state.empresa.id === empresaId ? { ...state, status, error } : state
    ));
  };

  const processSingleEmpresa = async (state: EmpresaProcessState) => {
    if (!state.file || !selectedClient) return;

    const { empresa, file } = state;
    const periodo = `${selectedYear}${selectedMonth.toString().padStart(2, '0')}`;

    try {
      // 1. Uploading
      updateEmpresaStatus(empresa.id, 'uploading');
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${selectedClient.id}/${empresa.emp_cnpj_raiz}/${periodo}/${timestamp}_${safeFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('movimento_upload')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // 2. Processing (Webhook)
      updateEmpresaStatus(empresa.id, 'processing');
      const webhookUrl = (import.meta as any).env?.VITE_MOVIMENTO_WEBHOOK_URL || 'https://webhook.synapiens.com.br/webhook/movimento-upsert';
      
      const payload = {
        file_path: uploadData?.path || filePath,
        bucket: "movimento_upload",
        cliente_id: selectedClient.id,
        empresa_id: empresa.id,
        periodo: periodo,
        cnpj_raiz: empresa.emp_cnpj_raiz
      };

      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!webhookRes.ok) {
        const detail = await webhookRes.text().catch(() => '');
        throw new Error(`Erro no processamento: ${webhookRes.status} ${detail}`);
      }

      // 3. Calculating (Simulated step as requested)
      updateEmpresaStatus(empresa.id, 'calculating');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate calculation time

      updateEmpresaStatus(empresa.id, 'success');
    } catch (err: any) {
      console.error(`Erro processando ${empresa.emp_nome}:`, err);
      updateEmpresaStatus(empresa.id, 'error', err.message);
      throw err; // Re-throw to stop batch if needed or handle in loop
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

  const getStatusIcon = (status: ProcessStatus) => {
    switch (status) {
      case 'idle': return <Circle className="w-5 h-5 text-gray-600" />;
      case 'waiting': return <Clock className="w-5 h-5 text-indigo-400" />;
      case 'uploading': return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'processing': return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'calculating': return <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (status: ProcessStatus) => {
    switch (status) {
      case 'idle': return 'Aguardando arquivo';
      case 'waiting': return 'Pronto para processar';
      case 'uploading': return 'Enviando arquivo...';
      case 'processing': return 'Processando carga...';
      case 'calculating': return 'Executando cálculos...';
      case 'success': return 'Concluído com sucesso';
      case 'error': return 'Falha no processamento';
    }
  };

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-gray-300 space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white">Carga de Movimento Serializada</h2>
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
        <div className="p-4 bg-gray-700/30 border-b border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold text-white">Empresas Disponíveis ({processStates.length})</h3>
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
            processStates.map((state) => (
              <div key={state.empresa.id} className={`p-4 transition-colors ${state.status === 'uploading' || state.status === 'processing' || state.status === 'calculating' ? 'bg-indigo-900/10' : 'hover:bg-gray-700/30'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white truncate">{state.empresa.emp_nome}</h4>
                      <span className="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{state.empresa.emp_cnpj}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(state.status)}
                      <span className={`text-xs font-medium ${
                        state.status === 'success' ? 'text-green-500' : 
                        state.status === 'error' ? 'text-red-500' : 
                        state.status === 'idle' ? 'text-gray-500' : 'text-indigo-400'
                      }`}>
                        {getStatusText(state.status)}
                      </span>
                      {state.error && <span className="text-xs text-red-400 italic truncate">— {state.error}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <input
                        type="file"
                        id={`file-${state.empresa.id}`}
                        className="hidden"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={(e) => handleFileChange(state.empresa.id, e.target.files?.[0] || null)}
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
                    </div>
                  </div>
                </div>

                {/* Progress Bar for active item */}
                {(state.status === 'uploading' || state.status === 'processing' || state.status === 'calculating') && (
                  <div className="mt-4 h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full animate-progress-indefinite ${
                      state.status === 'uploading' ? 'bg-blue-500' : 
                      state.status === 'processing' ? 'bg-yellow-500' : 'bg-purple-500'
                    }`} />
                  </div>
                )}
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
