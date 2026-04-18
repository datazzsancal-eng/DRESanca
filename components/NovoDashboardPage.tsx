
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { TableSkeleton, CardSkeleton } from './shared/Skeleton';
import DreTable, { DreDataRow } from './shared/DreTable';
import StatCard from './shared/StatCard';
import * as XLSX from 'xlsx';
import { AlertCircle, LayoutGrid, Building2, FileText, Download, Loader2, RefreshCw } from 'lucide-react';

// Icons
const RefreshIcon = () => <RefreshCw className="h-4 w-4 mr-1.5" />;
const XlsxIcon = () => <Download className="h-4 w-4 mr-1.5 text-green-500" />;
const CsvIcon = () => <FileText className="h-4 w-4 mr-1.5 text-blue-400" />;

// Type definitions
interface Periodo { retorno: number; display: string; }
interface Visao { id: string; vis_nome: string; vis_descri: string | null; cliente_id?: string | null; }
interface Empresa { id: string; emp_nome_reduz: string; emp_cod_integra: string; emp_cnpj: string; }
interface CardConfig { id: number; crd_posicao: number; tit_card_ajust: string | null; dre_linha_seq: number | null; vlr_linha_01: 'ACUM' | 'PERC'; vlr_linha_02: 'ACUM' | 'PERC'; }
interface LineStyle { seq: number; tipografia: 'NORMAL' | 'NEGRITO' | 'ITALICO' | 'NEGR/ITAL' | null; indentacao: number; }

const safeParseJson = (text: string): unknown => {
  if (!text || !text.trim()) return [];
  try {
    return JSON.parse(text);
  } catch (e) {
    return [];
  }
};

const safeToLocaleString = (val: any, options?: Intl.NumberFormatOptions): string => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n)) return '0,00';
    return n.toLocaleString('pt-BR', options);
};

const NovoDashboardPage: React.FC = () => {
    const { user, profile, selectedClient } = useAuth();
    
    // UI State
    const [mode, setMode] = useState<'visao' | 'empresa'>('visao');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    
    // Data List States
    const [visoes, setVisoes] = useState<Visao[]>([]);
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [periods, setPeriods] = useState<Periodo[]>([]);
    
    // Selection States
    const [selectedVisao, setSelectedVisao] = useState<string>('');
    const [selectedEmpresa, setSelectedEmpresa] = useState<string>(''); // ID integra
    const [selectedPeriod, setSelectedPeriod] = useState<number | ''>('');
    
    // Dashboard States
    const [rawDreData, setRawDreData] = useState<any[]>([]);
    const [dreData, setDreData] = useState<DreDataRow[]>([]);
    const [cardConfigs, setCardConfigs] = useState<CardConfig[]>([]);
    const [lineStyles, setLineStyles] = useState<Map<number, LineStyle>>(new Map());
    const [refreshKey, setRefreshKey] = useState(0);
    
    const dreCacheRef = useRef<Record<string, any[]>>({});

    const handleRefresh = () => {
        const visaoIdParam = mode === 'empresa' ? 'EMP' : selectedVisao;
        const empIntegraParam = mode === 'empresa' ? selectedEmpresa : '0';
        const cacheKey = `${visaoIdParam}-${empIntegraParam}-${selectedPeriod}`;
        if (dreCacheRef.current[cacheKey]) {
            delete dreCacheRef.current[cacheKey];
        }
        setRefreshKey(prev => prev + 1);
    };

    // 1. Fetch Visões e Empresas when Client changes
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.id || !selectedClient?.id) return;
            
            try {
                // Fetch Permissions
                let hasFull = false;
                let allowedEmpresaIds = new Set<string>();

                if (profile?.function === 'MASTER') {
                    hasFull = true;
                } else {
                    const { data: relData } = await supabase
                        .from('rel_prof_cli_empr')
                        .select('empresa_id')
                        .eq('profile_id', user.id)
                        .eq('cliente_id', selectedClient.id)
                        .eq('rel_situacao_id', 'ATV');

                    hasFull = relData?.some((r: any) => r.empresa_id === null) ?? false;
                    allowedEmpresaIds = new Set(relData?.map((r: any) => r.empresa_id).filter(Boolean));
                }

                // Fetch Visões
                const { data: vData } = await supabase
                    .from('dre_visao')
                    .select('id, vis_nome, cliente_id, rel_visao_empresa(empresa_id)')
                    .eq('cliente_id', selectedClient.id)
                    .order('vis_nome');

                const filteredVisoes = (vData || []).filter((v: any) =>
                    hasFull || !v.rel_visao_empresa?.length || v.rel_visao_empresa.every((r: any) => allowedEmpresaIds.has(r.empresa_id))
                ).map(v => ({ id: String(v.id), vis_nome: v.vis_nome, vis_descri: null, cliente_id: v.cliente_id }));

                setVisoes(filteredVisoes);
                if (filteredVisoes.length && !selectedVisao) setSelectedVisao(filteredVisoes[0].id);

                // Fetch Empresas
                let empresaQuery = supabase
                    .from('dre_empresa')
                    .select('id, emp_nome_reduz, emp_cod_integra, emp_cnpj')
                    .eq('cliente_id', selectedClient.id)
                    .order('emp_nome_reduz');

                if (!hasFull) {
                    empresaQuery = empresaQuery.in('id', Array.from(allowedEmpresaIds));
                }

                const { data: eData } = await empresaQuery;
                setEmpresas(eData || []);
                if (eData?.length && !selectedEmpresa) setSelectedEmpresa(eData[0].emp_cod_integra);

            } catch (err) {
                console.error("Error fetching visoes/empresas:", err);
            }
        };
        
        fetchData();
    }, [selectedClient?.id, user?.id, profile?.function]);

    // 2. Fetch Períodos based on selection
    useEffect(() => {
        const fetchPeriods = async () => {
            if (!selectedClient?.id) return;
            
            try {
                let allowedIntegraIds: string[] = [];
                
                if (mode === 'visao') {
                    if (!selectedVisao) return;
                    const { data: relData } = await supabase
                        .from('rel_visao_empresa')
                        .select('empresa_integra_id')
                        .eq('visao_id', selectedVisao);
                    allowedIntegraIds = (relData || []).map(r => r.empresa_integra_id).filter(Boolean);
                } else {
                    if (!selectedEmpresa) return;
                    allowedIntegraIds = [selectedEmpresa];
                }

                if (allowedIntegraIds.length === 0) {
                    setPeriods([]);
                    setSelectedPeriod('');
                    return;
                }

                const { data: pData } = await supabase
                    .from('viw_periodo_calc')
                    .select('retorno, display')
                    .in('emp_cod_integra', allowedIntegraIds)
                    .order('retorno', { ascending: false });

                if (pData) {
                    const uniqueMap = new Map();
                    pData.forEach(item => {
                        if (!uniqueMap.has(item.retorno)) {
                            uniqueMap.set(item.retorno, item);
                        }
                    });
                    const uniquePeriods = Array.from(uniqueMap.values());
                    setPeriods(uniquePeriods);

                    if (uniquePeriods.length > 0) {
                        const isValid = uniquePeriods.some(p => Number(p.retorno) === Number(selectedPeriod));
                        if (!isValid) setSelectedPeriod(Number(uniquePeriods[0].retorno));
                    } else {
                        setSelectedPeriod('');
                    }
                }
            } catch (err) {
                console.error("Error fetching periods:", err);
            }
        };
        fetchPeriods();
    }, [mode, selectedVisao, selectedEmpresa, selectedClient?.id]);

    // 3. Fetch Dashboard Data
    useEffect(() => {
        const visaoIdParam = mode === 'empresa' ? 'EMP' : selectedVisao;
        const empIntegraParam = mode === 'empresa' ? selectedEmpresa : '0';
        
        if (!visaoIdParam || !selectedPeriod || !selectedClient?.id) return;

        const cacheKey = `${visaoIdParam}-${empIntegraParam}-${selectedPeriod}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const loadData = async () => {
            setLoading(true);
            setError(null);
            setWarning(null);

            try {
                // Configs Fetch
                const fetchConfigsPromise = async () => {
                    // We need a template ID. We use the client's active template.
                    const { data: tmps } = await supabase
                        .from('dre_template')
                        .select('id')
                        .eq('cliente_id', selectedClient.id)
                        .order('dre_ativo_sn', { ascending: false })
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (!tmps?.length) return { cards: [], styles: new Map() };
                    
                    const activeTemplateId = tmps[0].id;

                    const [cardsRes, linesRes] = await Promise.all([
                        supabase.from('dre_template_card').select('*').eq('dre_template_id', activeTemplateId).order('crd_posicao'),
                        supabase.from('dre_template_linhas').select(`dre_linha_seq, tab_estilo_linha ( est_tipg_tela, est_nivel_ident )`).eq('dre_template_id', activeTemplateId),
                    ]);

                    const stylesMap = new Map();
                    (linesRes.data || []).forEach((l: any) => {
                        if (l.tab_estilo_linha) {
                            stylesMap.set(Number(l.dre_linha_seq), { 
                                seq: Number(l.dre_linha_seq), 
                                tipografia: l.tab_estilo_linha.est_tipg_tela, 
                                indentacao: l.tab_estilo_linha.est_nivel_ident || 0,
                            });
                        }
                    });

                    return { cards: cardsRes.data || [], styles: stylesMap };
                };

                // Webhook Data Fetch
                const fetchDrePromise = async () => {
                    if (dreCacheRef.current[cacheKey]) return dreCacheRef.current[cacheKey];

                    const webhookUrl = 'https://webhook.synapiens.com.br/webhook/dre_busca_novo';
                    const res = await fetch(
                        `${webhookUrl}?carga=${selectedPeriod}&id=${visaoIdParam}&emp_id_integra=${empIntegraParam}`,
                        { signal: controller.signal }
                    );

                    if (!res.ok) throw new Error(`Erro API: ${res.status}`);
                    const text = await res.text();
                    const parsed = safeParseJson(text);
                    const arr = Array.isArray(parsed) ? parsed : [];
                    dreCacheRef.current[cacheKey] = arr;
                    return arr;
                };

                const [configs, dreResult] = await Promise.all([fetchConfigsPromise(), fetchDrePromise()]);

                if (!controller.signal.aborted) {
                    setCardConfigs(configs.cards);
                    setLineStyles(configs.styles);
                    setRawDreData(dreResult);
                    if (!dreResult.length) setWarning('Sem Dados no Momento');
                }

            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Dashboard error:", err);
                    setError(err.message || 'Erro ao carregar dados');
                    setRawDreData([]);
                }
            } finally {
                clearTimeout(timeoutId);
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        loadData();
        return () => controller.abort();
    }, [mode, selectedVisao, selectedEmpresa, selectedPeriod, selectedClient?.id, refreshKey]);

    // 4. Transform Raw Data for Table
    useEffect(() => {
        if (!rawDreData.length) { setDreData([]); return; }
        
        const visible = rawDreData.filter((r: any) => r.dre_linha_visivel === 'S');
        setDreData(visible.map((r: any) => {
            const seq = Number(r.dre_linha_seq || 0);
            const s = lineStyles.get(seq);
            const t = r.est_tipg_tela || s?.tipografia;
            return {
                seq, desc: r.dre_linha_descri || '',
                jan: Number(r.conta_janeiro ?? 0), fev: Number(r.conta_fevereiro ?? 0), mar: Number(r.conta_marco ?? 0), abr: Number(r.conta_abril ?? 0), mai: Number(r.conta_maio ?? 0), jun: Number(r.conta_junho ?? 0), jul: Number(r.conta_julho ?? 0), ago: Number(r.conta_agosto ?? 0), set: Number(r.conta_setembro ?? 0), out: Number(r.conta_outubro ?? 0), nov: Number(r.conta_novembro ?? 0), dez: Number(r.conta_dezembro ?? 0),
                accumulated: Number(r.conta_acumulado ?? 0), percentage: Number(r.conta_perc ?? 0),
                isBold: t === 'NEGRITO' || t === 'NEGR/ITAL', isItalic: t === 'ITALICO' || t === 'NEGR/ITAL', indentationLevel: Number(r.est_nivel_ident ?? s?.indentacao ?? 0)
            };
        }));
    }, [rawDreData, lineStyles]);

    const processCard = useCallback((pos: number) => {
        const cfg = cardConfigs.find((c: CardConfig) => Number(c.crd_posicao) === pos);
        if (!cfg || cfg.dre_linha_seq === null) return { title: `Card ${pos}`, subtitle: 'Não configurado', value: '-', percentage: '-', variation: 0 };
        
        const targetSeq = String(cfg.dre_linha_seq).trim();
        const r = rawDreData.find((row: any) => String(row?.dre_linha_seq).trim() === targetSeq);
        
        if (!r) return { title: cfg.tit_card_ajust || `Card ${pos}`, subtitle: 'Sem dados', value: '-', percentage: '-', variation: 0 };

        const format = (type: 'ACUM' | 'PERC') => {
            const v = Number(type === 'ACUM' ? (r.conta_acumulado ?? 0) : (r.conta_perc ?? 0));
            return type === 'ACUM' 
              ? `R$ ${safeToLocaleString(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
              : `${safeToLocaleString(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
        };

        let vnt = 0;
        if (selectedPeriod) {
            const m = (Number(selectedPeriod) % 100);
            if (m > 1) {
                 const keys = ['conta_janeiro', 'conta_fevereiro', 'conta_marco', 'conta_abril', 'conta_maio', 'conta_junho', 'conta_julho', 'conta_agosto', 'conta_setembro', 'conta_outubro', 'conta_novembro', 'conta_dezembro'];
                 const cur = Number(r[keys[m - 1]] ?? 0); 
                 const pre = Number(r[keys[m - 2]] ?? 0);
                 vnt = pre !== 0 ? ((cur - pre) / Math.abs(pre)) * 100 : (cur !== 0 ? 100 : 0);
            }
        }
        return { title: cfg.tit_card_ajust || r.dre_linha_descri, subtitle: 'vs Mês Anterior', value: format(cfg.vlr_linha_01), percentage: format(cfg.vlr_linha_02), variation: vnt };
    }, [cardConfigs, rawDreData, selectedPeriod]);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Control Bar */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
                           {mode === 'visao' ? <LayoutGrid className="w-5 h-5 text-indigo-500" /> : <Building2 className="w-5 h-5 text-indigo-500" />}
                           {mode === 'visao' ? 'DRE Consolidada' : 'Análise Unidade'}
                        </h2>
                        
                        {/* Mode Toggles */}
                        <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
                            <button 
                                onClick={() => setMode('visao')}
                                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${mode === 'visao' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Visão
                            </button>
                            <button 
                                onClick={() => setMode('empresa')}
                                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${mode === 'empresa' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                Empresa
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                        {/* Dynamic Alvo Select */}
                        {mode === 'visao' ? (
                            <select 
                                value={selectedVisao} 
                                onChange={(e) => setSelectedVisao(e.target.value)}
                                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-w-[200px]"
                            >
                                {visoes.map(v => <option key={v.id} value={v.id}>{v.vis_nome}</option>)}
                            </select>
                        ) : (
                            <select 
                                value={selectedEmpresa} 
                                onChange={(e) => setSelectedEmpresa(e.target.value)}
                                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-w-[200px]"
                            >
                                {empresas.map(e => (
                                    <option key={e.id} value={e.emp_cod_integra}>
                                        {e.emp_nome_reduz} ({e.emp_cod_integra})
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Period Select */}
                        <select 
                            value={selectedPeriod} 
                            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                            className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        >
                            {periods.map(p => <option key={p.retorno} value={p.retorno}>{p.display}</option>)}
                        </select>

                        {/* Export Buttons */}
                        <div className="flex gap-2">
                            <button 
                                onClick={handleRefresh} 
                                disabled={loading || !selectedPeriod || (mode === 'visao' ? !selectedVisao : !selectedEmpresa)} 
                                className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-gray-600 transition-all disabled:opacity-50"
                            >
                                <RefreshIcon /> Atualizar
                            </button>
                             <button onClick={() => {
                                const ws = XLSX.utils.json_to_sheet(dreData.map(({ isBold, isItalic, indentationLevel, ...rest }) => rest));
                                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DRE");
                                XLSX.writeFile(wb, `DRE_${selectedPeriod}.xlsx`);
                            }} disabled={!dreData.length} className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-gray-600 transition-all disabled:opacity-50"><XlsxIcon /> XLSX</button>
                            <button onClick={() => {
                                const ws = XLSX.utils.json_to_sheet(dreData.map(({ isBold, isItalic, indentationLevel, ...rest }) => rest));
                                const csv = XLSX.utils.sheet_to_csv(ws);
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement("a");
                                link.href = URL.createObjectURL(blob);
                                link.download = `DRE_${selectedPeriod}.csv`;
                                link.click();
                            }} disabled={!dreData.length} className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-gray-600 transition-all disabled:opacity-50"><CsvIcon /> CSV</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error/Warning Messages */}
            {(error || warning) && (
                <div className={`p-4 rounded-xl text-sm flex items-center gap-3 border animate-in slide-in-from-top-4 duration-300 ${error ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'}`}>
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error || warning}</p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
                ) : cardConfigs.length > 0 ? (
                    cardConfigs.map(cfg => { 
                        const d = processCard(cfg.crd_posicao); 
                        return <StatCard key={cfg.id} title={d.title} subtitle={d.subtitle} value={d.value} percentage={d.percentage} variation={d.variation} />; 
                    })
                ) : null}
            </div>

            {/* Main Table */}
            <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 min-h-[400px]">
                {loading ? (
                    <TableSkeleton rows={12} cols={6} />
                ) : dreData.length > 0 ? (
                    <DreTable data={dreData} selectedPeriod={selectedPeriod} />
                ) : !loading && (
                    <div className="text-center py-20 flex flex-col items-center justify-center opacity-50">
                        <LayoutGrid className="w-12 h-12 mb-4 text-gray-600" />
                        <h3 className="text-xl font-bold text-white mb-2">Sem Dados</h3>
                        <p className="text-gray-400">Não há registros para o período e alvo selecionados.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NovoDashboardPage;
