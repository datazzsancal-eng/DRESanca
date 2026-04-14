import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface EmpresaRaiz {
  cnpj_raiz: string;
  reduz_emp: string | null;
}

const CargaPlanoPage: React.FC = () => {
  const { selectedClient, user, profile } = useAuth();
  const [empresasRaiz, setEmpresasRaiz] = useState<EmpresaRaiz[]>([]);
  const [selectedCnpjRaiz, setSelectedCnpjRaiz] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEmpresasRaiz = async () => {
      if (!selectedClient || !user) {
        setEmpresasRaiz([]);
        setSelectedCnpjRaiz('');
        return;
      }
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        let hasFullAccess = false;
        const allowedRoots = new Set<string>();

        if (profile?.function === 'MASTER') {
            hasFullAccess = true;
        } else {
            const { data: relData, error: relError } = await supabase
                .from('rel_prof_cli_empr')
                .select(`
                    empresa_id,
                    dre_empresa ( emp_cnpj_raiz )
                `)
                .eq('profile_id', user.id)
                .eq('cliente_id', selectedClient.id)
                .eq('rel_situacao_id', 'ATV');

            if (relError) throw relError;

            if (relData) {
                relData.forEach((item: any) => {
                    if (item.empresa_id === null) {
                        hasFullAccess = true;
                    } else if (item.dre_empresa?.emp_cnpj_raiz) {
                        allowedRoots.add(item.dre_empresa.emp_cnpj_raiz);
                    }
                });
            }
        }

        const { data: viewData, error: viewError } = await supabase
            .from('viw_cnpj_raiz')
            .select('cnpj_raiz, reduz_emp')
            .eq('cliente_id', selectedClient.id)
            .order('reduz_emp');
        
        if (viewError) throw viewError;

        const allRoots = viewData || [];

        if (hasFullAccess) {
            setEmpresasRaiz(allRoots);
        } else {
            const filteredRoots = allRoots.filter(r => allowedRoots.has(r.cnpj_raiz));
            setEmpresasRaiz(filteredRoots);
        }

      } catch (err: any) {
        console.error("Erro ao buscar empresas permitidas:", err);
        setError(`Falha ao carregar lista de empresas: ${err.message}`);
        setEmpresasRaiz([]);
      } finally {
        setSelectedCnpjRaiz('');
        setLoading(false);
      }
    };
    fetchEmpresasRaiz();
  }, [selectedClient, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCnpjRaiz(e.target.value);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = async () => {
    if (!selectedClient || !selectedCnpjRaiz || !file) {
      setError("Selecione a empresa e um arquivo para enviar.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Cria um caminho único para o arquivo: cliente_id/cnpj_raiz/timestamp_nomeOriginal
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${selectedClient.id}/${selectedCnpjRaiz}/${timestamp}_${safeFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('conta_upload')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Usa o caminho exato retornado pelo Supabase (evita problemas com encoding de caracteres)
      const savedPath = uploadData?.path || filePath;

      // Dispara o webhook para processar a carga
      const webhookUrl = (import.meta as any).env?.VITE_CARGA_WEBHOOK_URL || 'https://webhook.synapiens.com.br/webhook/csv-upsert';
      
      const selectedEmpresa = empresasRaiz.find(e => e.cnpj_raiz === selectedCnpjRaiz);

      const payload = {
        file_path: savedPath,
        bucket: "conta_upload",
        table: "dre_plano_contabil",
        on_conflict: "id",
        cliente_id: selectedClient.id,
        emp_nome_reduzido: selectedEmpresa?.reduz_emp || null,
        cnpj_raiz: selectedCnpjRaiz
      };

      let webhookRes;
      try {
        webhookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr: any) {
        throw new Error(`Falha de conexão com o webhook (CORS ou servidor indisponível): ${fetchErr.message}`);
      }

      if (!webhookRes.ok) {
        let errorDetail = '';
        try {
          errorDetail = await webhookRes.text();
        } catch (e) {
          // Ignore if we can't read the text
        }
        throw new Error(`Upload concluído, mas o processamento falhou (${webhookRes.status}). Detalhes: ${errorDetail}`);
      }

      setSuccess(`Arquivo "${file.name}" enviado e processado com sucesso!`);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      console.error("Erro no upload:", err);
      setError(`Falha ao enviar arquivo: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Carga de Plano Contábil ({selectedClient?.cli_nome || 'Nenhum Cliente'})</h2>
      </div>

      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}
      {success && <div className="p-3 text-green-300 bg-green-900/40 border border-green-700 rounded-md">{success}</div>}

      <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Empresa (CNPJ Raiz)</label>
          <select 
            value={selectedCnpjRaiz} 
            onChange={handleCnpjChange} 
            disabled={!selectedClient || empresasRaiz.length === 0 || loading || uploading}
            className="w-full md:w-1/2 px-3 py-2 text-sm text-gray-200 bg-gray-800 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            <option value="">Selecione a Empresa (CNPJ Raiz)</option>
            {empresasRaiz.map(e => <option key={e.cnpj_raiz} value={e.cnpj_raiz}>{e.reduz_emp} ({e.cnpj_raiz})</option>)}
          </select>
          {loading && <p className="text-xs text-gray-400 mt-1">Carregando empresas...</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Arquivo de Carga (CSV/Excel)</label>
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={!selectedCnpjRaiz || uploading}
              className="block w-full md:w-1/2 text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-600">
          <button
            onClick={handleUpload}
            disabled={!selectedCnpjRaiz || !file || uploading}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed flex items-center"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                Enviando...
              </>
            ) : (
              'Processar Carga'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CargaPlanoPage;
