import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Type definitions
interface Cliente {
  id: string;
  cli_nome: string | null;
}

interface EmpresaRaiz {
  cnpj_raiz: string;
  reduz_emp: string | null;
}

// Fix: Add type definition for plano de contas data
interface PlanoConta {
  conta_estru: string | null;
  conta_descri: string | null;
}

interface ComparisonRow {
  key: string;
  conta1: string | null;
  descri1: string | null;
  conta2: string | null;
  descri2: string | null;
  descriptionMatch: 'MATCH' | 'MISMATCH' | null;
}

interface PlanoContabilComparePageProps {
  onBack: () => void;
}

const PlanoContabilComparePage: React.FC<PlanoContabilComparePageProps> = ({ onBack }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresasRaiz, setEmpresasRaiz] = useState<EmpresaRaiz[]>([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedEmpresa1, setSelectedEmpresa1] = useState('');
  const [selectedEmpresa2, setSelectedEmpresa2] = useState('');
  const [comparisonData, setComparisonData] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEmpresa1, setFiltroEmpresa1] = useState('');

  // Initial data fetching for clients
  useEffect(() => {
    const fetchClientes = async () => {
      const { data, error } = await supabase.from('dre_cliente').select('id, cli_nome').order('cli_nome');
      if (error) setError(`Falha ao carregar clientes: ${error.message}`);
      else setClientes(data || []);
    };
    fetchClientes();
  }, []);

  // Fetch distinct CNPJ roots when a client is selected
  useEffect(() => {
    const fetchEmpresasRaiz = async () => {
      if (!selectedCliente) {
        setEmpresasRaiz([]);
        setSelectedEmpresa1('');
        setSelectedEmpresa2('');
        setComparisonData([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.from('viw_cnpj_raiz').select('cnpj_raiz, reduz_emp').eq('cliente_id', selectedCliente);
      if (error) setError(`Falha ao carregar CNPJs: ${error.message}`);
      else setEmpresasRaiz(data || []);
      
      setSelectedEmpresa1('');
      setSelectedEmpresa2('');
      setComparisonData([]);
      setLoading(false);
    };
    fetchEmpresasRaiz();
  }, [selectedCliente]);

  const handleCompare = useCallback(async () => {
    if (!selectedCliente || !selectedEmpresa1 || !selectedEmpresa2) {
      setError("Selecione um cliente e duas empresas para comparar.");
      setComparisonData([]);
      return;
    }
     if (selectedEmpresa1 === selectedEmpresa2) {
      setError("Selecione duas empresas diferentes para a comparação.");
      setComparisonData([]);
      return;
    }

    setLoading(true);
    setError(null);
    setComparisonData([]);

    try {
      const [plano1Res, plano2Res] = await Promise.all([
        supabase.from('dre_plano_contabil').select('conta_estru, conta_descri').eq('cnpj_raiz', selectedEmpresa1),
        supabase.from('dre_plano_contabil').select('conta_estru, conta_descri').eq('cnpj_raiz', selectedEmpresa2)
      ]);

      if (plano1Res.error) throw plano1Res.error;
      if (plano2Res.error) throw plano2Res.error;

      // Fix: Type the response data and filter out null keys to ensure type safety.
      const plano1Data: PlanoConta[] = plano1Res.data || [];
      const plano2Data: PlanoConta[] = plano2Res.data || [];

      const plano1Map = new Map(plano1Data.map(c => [c.conta_estru, c.conta_descri]));
      const plano2Map = new Map(plano2Data.map(c => [c.conta_estru, c.conta_descri]));

      const allKeys = new Set([...plano1Map.keys(), ...plano2Map.keys()]);
      const sortedKeys = Array.from(allKeys).filter((k): k is string => k != null).sort();

      const mergedData: ComparisonRow[] = sortedKeys.map(key => {
        const conta1Exists = plano1Map.has(key);
        const conta2Exists = plano2Map.has(key);
        const descri1 = plano1Map.get(key);
        const descri2 = plano2Map.get(key);
        let descriptionMatch: 'MATCH' | 'MISMATCH' | null = null;

        if (conta1Exists && conta2Exists) {
            descriptionMatch = descri1 === descri2 ? 'MATCH' : 'MISMATCH';
        }

        return {
          key,
          conta1: conta1Exists ? key : null,
          descri1: conta1Exists ? descri1 ?? null : null,
          conta2: conta2Exists ? key : null,
          descri2: conta2Exists ? descri2 ?? null : null,
          descriptionMatch,
        };
      });

      setComparisonData(mergedData);
    } catch (err: any) {
      setError(`Falha ao comparar planos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCliente, selectedEmpresa1, selectedEmpresa2]);

  const filteredComparisonData = useMemo(() => {
    if (!filtroEmpresa1) {
      return comparisonData;
    }
    const lowercasedFilter = filtroEmpresa1.toLowerCase();
    return comparisonData.filter(row => 
      (row.conta1 && row.conta1.toLowerCase().includes(lowercasedFilter)) ||
      (row.descri1 && row.descri1.toLowerCase().includes(lowercasedFilter))
    );
  }, [comparisonData, filtroEmpresa1]);


  const renderContent = () => {
    if (loading) {
      return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (comparisonData.length === 0 && !loading) {
      return (
        <div className="p-6 text-center bg-gray-800/50">
          <h2 className="text-lg font-bold text-white">Nenhum dado para exibir</h2>
          <p className="mt-1 text-gray-400">Selecione os filtros e clique em 'Comparar' para ver os resultados.</p>
        </div>
      );
    }
    if (filteredComparisonData.length === 0 && comparisonData.length > 0) {
      return (
        <div className="p-6 text-center bg-gray-800/50">
            <h2 className="text-lg font-bold text-white">Nenhum Resultado</h2>
            <p className="mt-1 text-gray-400">Nenhuma conta da Empresa 1 corresponde ao filtro de busca.</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase border-r border-gray-600">Conta (Empresa 1)</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Descrição (Empresa 1)</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase border-l border-gray-600">Conta (Empresa 2)</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Descrição (Empresa 2)</th>
              <th className="px-2 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Comp.</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {filteredComparisonData.map(row => {
              const missingAccount = !row.conta1 || !row.conta2;
              return (
                <tr key={row.key} className={`${missingAccount ? 'bg-[#D8BFD8]/20' : ''} hover:bg-gray-700/50`}>
                  <td className="px-4 py-2 font-medium text-white whitespace-nowrap border-r border-gray-700">{row.conta1}</td>
                  <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{row.descri1}</td>
                  <td className="px-4 py-2 font-medium text-white whitespace-nowrap border-l border-gray-700">{row.conta2}</td>
                  <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{row.descri2}</td>
                  <td className="px-2 py-2 text-center">
                    {row.descriptionMatch === 'MATCH' && (
                        <i className="fas fa-check-circle text-green-500" title="Descrições idênticas"></i>
                    )}
                    {row.descriptionMatch === 'MISMATCH' && (
                        <i className="fas fa-times-circle text-red-500" title="Descrições diferentes"></i>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white">Comparativo de Plano de Contas</h2>
        <button onClick={onBack} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">
          Voltar à Lista
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 p-4 bg-gray-900/50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400">Cliente</label>
          <select value={selectedCliente} onChange={(e) => setSelectedCliente(e.target.value)} className="w-full px-3 py-1.5 mt-1 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">Selecione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400">Empresa 1</label>
          <select value={selectedEmpresa1} onChange={(e) => setSelectedEmpresa1(e.target.value)} disabled={!selectedCliente} className="w-full px-3 py-1.5 mt-1 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm disabled:bg-gray-600">
            <option value="">Selecione...</option>
            {empresasRaiz.map(e => <option key={e.cnpj_raiz} value={e.cnpj_raiz}>{e.reduz_emp} ({e.cnpj_raiz})</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400">Filtrar Contas (Empresa 1)</label>
          <input 
              type="text"
              placeholder="Buscar por conta ou descrição..."
              value={filtroEmpresa1}
              onChange={(e) => setFiltroEmpresa1(e.target.value)}
              disabled={!selectedEmpresa1}
              className="w-full px-3 py-1.5 mt-1 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-600"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400">Empresa 2</label>
          <select value={selectedEmpresa2} onChange={(e) => setSelectedEmpresa2(e.target.value)} disabled={!selectedCliente} className="w-full px-3 py-1.5 mt-1 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm disabled:bg-gray-600">
            <option value="">Selecione...</option>
            {empresasRaiz.map(e => <option key={e.cnpj_raiz} value={e.cnpj_raiz}>{e.reduz_emp} ({e.cnpj_raiz})</option>)}
          </select>
        </div>
        <div>
          <button onClick={handleCompare} disabled={loading || !selectedEmpresa1 || !selectedEmpresa2} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed">
            {loading ? '...' : 'Comparar'}
          </button>
        </div>
      </div>
      
      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}
      
      {renderContent()}
    </div>
  );
};

export default PlanoContabilComparePage;