
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth, ClientContext } from '../contexts/AuthContext';
import ClientePage from './cliente/ClientePage';
import GrupoEmpresarialPage from './grupo-empresarial/GrupoEmpresarialPage';
import EmpresaPage from './empresa/EmpresaPage';
import PlanoContabilPage from './plano-contabil/PlanoContabilPage';
import TemplatePage from './template/TemplatePage';
import SituacaoPage from './situacao/SituacaoPage';
import TipoLinhaPage from './tipo-linha/TipoLinhaPage';
import EstiloLinhaPage from './estilo-linha/EstiloLinhaPage';
import TipoVisaoPage from './tipo-visao/TipoVisaoPage';
import VisaoPage from './visao/VisaoPage';
import UsuarioPage from './usuario/UsuarioPage';
import * as XLSX from 'xlsx';

// Type definitions
interface Periodo { retorno: number; display: string; }
interface Visao { id: string; vis_nome: string; vis_descri: string | null; cliente_id?: string | null; }
interface DreDataRow {
    seq: number; desc: string; jan: number; fev: number; mar: number; abr: number; mai: number; jun: number; jul: number; ago: number; set: number; out: number; nov: number; dez: number;
    accumulated: number; percentage: number; isBold: boolean; isItalic: boolean; indentationLevel: number;
}
interface CardConfig { id: number; crd_posicao: number; tit_card_ajust: string | null; dre_linha_seq: number | null; vlr_linha_01: 'ACUM' | 'PERC'; vlr_linha_02: 'ACUM' | 'PERC'; }
interface LineStyle { seq: number; tipografia: 'NORMAL' | 'NEGRITO' | 'ITALICO' | 'NEGR/ITAL' | null; indentacao: number; }

const safeParseJson = (text: string): unknown => {
  // Alguns webhooks retornam 200 com body vazio; isso quebra res.json() com "Unexpected end of JSON input"
  if (!text || !text.trim()) return [];
  return JSON.parse(text);
};

// --- Safe Formatting Helpers ---
const safeToLocaleString = (val: any, options?: Intl.NumberFormatOptions): string => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n)) return '0,00';
    return n.toLocaleString('pt-BR', options);
};

const safeFormatNumber = (val: any): string => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n) || n === 0) return '-';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const safeFormatPercentage = (val: any): string => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n) || n === 0) return '-';
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

// Icons
const Icon = ({ path, className = "h-6 w-6" }: { path: string, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>
);
const DashboardIcon = () => <Icon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />;
const VisionIcon = () => <Icon path="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />;
const StructureIcon = () => <Icon path="M8 9l4-4 4 4m0 6l-4 4-4-4" />;
const SettingsIcon = () => <Icon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
const AdminIcon = () => <Icon path="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />;
const ChevronDownIcon = () => <Icon path="M19 9l-7 7-7-7" className="h-4 w-4" />;
const ChevronUpIcon = () => <Icon path="M5 15l7-7 7 7" className="h-4 w-4" />;
const LogoutIcon = () => <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />;
const XlsxIcon = () => <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="h-5 w-5 mr-1 text-green-500" />;
const SwitchIcon = () => <Icon path="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" className="h-4 w-4" />;
const MenuIcon = () => <Icon path="M4 6h16M4 12h16M4 18h16" />;
const CloseIcon = () => <Icon path="M6 18L18 6M6 6l12 12" />;
const ChevronDoubleLeftIcon = () => <Icon path="M11 17l-5-5 5-5M18 17l-5-5 5-5" className="h-5 w-5"/>;
const ChevronDoubleRightIcon = () => <Icon path="M13 17l5-5-5-5M6 17l5-5-5-5" className="h-5 w-5"/>;

const SancalLogo = () => (
  <img src="https://www.sancal.com.br/wp-content/uploads/elementor/thumbs/logo-white-qfydekyggou3snwsfrlsc913ym97p1hveemqwoinls.png" alt="Sancal Logo" className="h-8 w-auto"/>
);

const navigationData: any[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'analise-modelos', label: 'Análise & Modelos', icon: VisionIcon, children: [{ id: 'visao', label: 'Visões' }, { id: 'templates', label: 'Templates' }] },
  { id: 'estrutura', label: 'Estrutura', icon: StructureIcon, children: [{ id: 'cliente', label: 'Cliente' }, { id: 'grupo-empresarial', label: 'Grupo Empresarial' }, { id: 'empresa', label: 'Empresa' }, { id: 'plano-contabil', label: 'Plano Contábil' }] },
  { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon, children: [{ id: 'situacao', label: 'Situação' }, { id: 'tipo-linha', label: 'Tipo Linha DRE' }, { id: 'estilo-linha', label: 'Estilo Linha DRE' }, { id: 'tipo-visao', label: 'Tipo Visão DRE' }] },
  { id: 'administracao', label: 'Administração', icon: AdminIcon, children: [{ id: 'usuarios', label: 'Usuários' }] },
];

interface SidebarProps {
  isSidebarOpen: boolean; setIsSidebarOpen: (isOpen: boolean) => void; activePage: string; setActivePage: (page: string) => void; isCollapsed: boolean; onToggleCollapse: () => void; selectedClient: ClientContext | null; onChangeClient: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen, activePage, setActivePage, isCollapsed, onToggleCollapse, selectedClient, onChangeClient }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({ 'analise-modelos': true, estrutura: true });
  useEffect(() => { if (isCollapsed) setOpenMenus({}); }, [isCollapsed]);
  const toggleMenu = (id: string) =>
    setOpenMenus((prev: { [key: string]: boolean }) => ({ ...prev, [id]: !prev[id] }));
  const getNavItemClasses = (p: string) => `flex items-center w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-2' : 'px-4'} ${activePage === p ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'}`;

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`flex items-center h-16 px-4 border-b border-gray-700 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed ? <SancalLogo /> : <DashboardIcon />}
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><CloseIcon /></button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navigationData.map((item: any) => (
            <div key={item.id}>
              <button onClick={() => item.children ? (!isCollapsed && toggleMenu(item.id)) : setActivePage(item.id)} className={getNavItemClasses(item.id)} title={isCollapsed ? item.label : ''}>
                <div className="flex items-center"><item.icon />{!isCollapsed && <span className="ml-3">{item.label}</span>}</div>
                {!isCollapsed && item.children && (openMenus[item.id] ? <ChevronUpIcon /> : <ChevronDownIcon />)}
              </button>
              {!isCollapsed && item.children && openMenus[item.id] && (
                <div className="py-1 pl-2 space-y-1">
                  {item.children.map((child: any) => (
                    <button key={child.id} onClick={() => setActivePage(child.id)} className={`flex items-center w-full py-2 pl-11 pr-4 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors ${activePage === child.id ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>{child.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-700 flex flex-col gap-2">
          {!isCollapsed && selectedClient && (
            <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="truncate flex-1"><p className="text-[10px] uppercase text-gray-400 font-bold">Cliente Atual</p><p className="text-sm font-semibold text-white truncate">{selectedClient.cli_nome}</p></div>
                <button onClick={onChangeClient} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full"><SwitchIcon /></button>
            </div>
          )}
          {isCollapsed && <button onClick={onChangeClient} className="flex justify-center w-full p-2 text-gray-400 hover:bg-gray-600 rounded-lg"><SwitchIcon /></button>}
           <button onClick={onToggleCollapse} className={`hidden lg:flex items-center w-full p-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-600 ${isCollapsed ? 'justify-center' : ''}`}>{isCollapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}{!isCollapsed && <span className="ml-2">Recolher</span>}</button>
        </div>
      </aside>
    </>
  );
};

interface StatCardProps { title: string; subtitle: string; value: string; percentage: string; variation: number; }
const StatCard: React.FC<StatCardProps> = ({ title, subtitle, value, percentage, variation }) => {
  const isPositive = (Number(variation) || 0) >= 0;
  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md min-h-[120px] flex flex-col justify-between">
      <p className="text-sm font-medium text-gray-400 truncate" title={title}>{title}</p>
      <div className="mt-2">
        <h3 className="text-2xl font-bold text-white truncate">{value}</h3>
        <p className="text-sm text-gray-400 truncate">{percentage}</p>
      </div>
      <div className={`text-xs font-semibold text-right mt-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? '▲' : '▼'} {Math.abs(Number(variation) || 0).toFixed(2)}%
        <span className="text-gray-500 ml-1 font-normal">{subtitle}</span>
      </div>
    </div>
  );
};

interface DreTableProps { data: DreDataRow[]; selectedPeriod: number | ''; }
const DreTable: React.FC<DreTableProps> = ({ data, selectedPeriod }) => {
    const allMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const visibleMonths = allMonths.slice(0, selectedPeriod ? (Number(selectedPeriod) % 100) : 12);

    return (
        <div className="overflow-auto bg-gray-800 border border-gray-700 rounded-lg shadow-md max-h-[70vh]">
            <table className="min-w-full text-sm divide-y divide-gray-700 border-separate border-spacing-0">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="sticky left-0 top-0 z-20 bg-gray-700 px-3 py-2 text-xs font-semibold text-left text-gray-400 uppercase shadow-[1px_0_0_0_rgba(75,85,99,1)]">Descrição</th>
                        {visibleMonths.map((m: string) => (
                          <th
                            key={m}
                            className="sticky top-0 z-10 bg-gray-700 px-3 py-2 text-xs font-semibold text-right text-gray-400 uppercase"
                          >
                            {m}
                          </th>
                        ))}
                        <th className="sticky top-0 z-10 bg-gray-700 px-3 py-2 text-xs font-semibold text-right text-gray-400 uppercase">Acumulado</th>
                        <th className="sticky top-0 z-10 bg-gray-700 px-3 py-2 text-xs font-semibold text-right text-gray-400 uppercase">%</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map((row: DreDataRow, idx: number) => (
                        <tr key={idx} className="group hover:bg-gray-700/50">
                            <td className="sticky left-0 z-10 bg-gray-800 group-hover:bg-gray-700 px-3 py-2 whitespace-nowrap text-gray-300 shadow-[1px_0_0_0_rgba(55,65,81,1)]" style={{ fontWeight: row.isBold ? 'bold' : 'normal', fontStyle: row.isItalic ? 'italic' : 'normal', paddingLeft: `calc(0.75rem + ${row.indentationLevel}ch)` }}>{row.desc}</td>
                            {visibleMonths.map((m: string) => (
                              <td
                                key={m}
                                className={`px-3 py-2 text-right whitespace-nowrap ${
                                  (row[m.toLowerCase() as keyof DreDataRow] as number) < 0
                                    ? 'text-red-500'
                                    : 'text-gray-200'
                                }`}
                              >
                                {safeFormatNumber(row[m.toLowerCase() as keyof DreDataRow])}
                              </td>
                            ))}
                            <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${row.accumulated < 0 ? 'text-red-500' : 'text-white'}`}>{safeFormatNumber(row.accumulated)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-gray-400">{safeFormatPercentage(row.percentage)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const DashboardPage: React.FC = () => {
  const { signOut, user, profile, selectedClient, selectClient } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [dropdownsInitialized, setDropdownsInitialized] = useState(false);
  const [rawDreData, setRawDreData] = useState<any[]>([]);
  const [dreData, setDreData] = useState<DreDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Periodo[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | ''>('');
  const [visoes, setVisoes] = useState<Visao[]>([]);
  const [selectedVisao, setSelectedVisao] = useState<string>('');
  const [cardConfigs, setCardConfigs] = useState<CardConfig[]>([]);
  const [lineStyles, setLineStyles] = useState<Map<number, LineStyle>>(new Map());
  const dreCacheRef = useRef<Record<string, any[]>>({});

  // Dropdowns (Períodos e Visões) – regras otimizadas
  useEffect(() => {
    const fetchDropdowns = async () => {
      if (!user?.id || !selectedClient?.id) return;
      try {
        // Se já inicializado e só o activePage mudou, não recarrega tudo
        if (dropdownsInitialized && periods.length && visoes.length) return;

        const { data: pData } = await supabase
          .from('viw_periodo_calc')
          .select('retorno, display')
          .order('retorno', { ascending: false });

        if (pData?.length) {
          setPeriods(pData);
          setSelectedPeriod((prev: number | '') => (prev === '' ? Number(pData[0].retorno) : prev));
        }

        const { data: relData } = await supabase
          .from('rel_prof_cli_empr')
          .select('empresa_id')
          .eq('profile_id', user.id)
          .eq('cliente_id', selectedClient.id)
          .eq('rel_situacao_id', 'ATV');

        const hasFull = relData?.some((r: any) => r.empresa_id === null);
        const allowedIds = new Set(
          relData?.map((r: any) => r.empresa_id).filter(Boolean)
        );

        const { data: vData } = await supabase
          .from('dre_visao')
          .select(`id, vis_nome, cliente_id, rel_visao_empresa ( empresa_id )`)
          .eq('cliente_id', selectedClient.id)
          .order('vis_nome');

        const filtered = (vData || []).filter((v: any) =>
          hasFull ||
          !v.rel_visao_empresa?.length ||
          v.rel_visao_empresa.every((r: any) => allowedIds.has(r.empresa_id))
        );

        if (filtered.length) {
          // Garante shape compatível com Visao (preenchendo vis_descri quando não vier da query)
          const normalized: Visao[] = filtered.map((v: any) => ({
            id: String(v.id),
            vis_nome: String(v.vis_nome),
            vis_descri: v.vis_descri ?? null,
            cliente_id: v.cliente_id ?? null,
          }));
          setVisoes(normalized);
          setSelectedVisao((prev: string) => (prev ? prev : normalized[0].id));
        } else {
          setVisoes([]);
          setSelectedVisao('');
        }
        setDropdownsInitialized(true);
      } catch (e) {
        setDropdownsInitialized(true);
      }
    };
    if (activePage === 'dashboard') fetchDropdowns();
  }, [activePage, user?.id, selectedClient?.id, dropdownsInitialized, periods.length, visoes.length]);

  // Configs - Improved resiliency
  useEffect(() => {
    const fetchConfigs = async () => {
      if (!selectedVisao) {
        setCardConfigs([]);
        setLineStyles(new Map());
        return;
      }
      try {
        const currentVisao = visoes.find((vis: Visao) => vis.id === selectedVisao);
        if (!currentVisao) return;

        // Carrega mais detalhes da visão para direcionar o template correto (por CNPJ raiz, quando existir)
        const { data: visaoDetails } = await supabase
          .from('dre_visao')
          .select('id, cliente_id, cnpj_raiz')
          .eq('id', selectedVisao)
          .single();

        const visaoCnpjRaiz: string | null = (visaoDetails as any)?.cnpj_raiz || null;

        // Busca template ativo priorizando o CNPJ raiz da visão (quando informado).
        // Se não houver match exato por CNPJ, cai no fallback antigo (qualquer template ativo do cliente).
        let templateQuery = supabase
          .from('dre_template')
          .select('id, cliente_cnpj, dre_ativo_sn, created_at')
          .eq('cliente_id', currentVisao.cliente_id);

        if (visaoCnpjRaiz) {
          templateQuery = templateQuery.eq('cliente_cnpj', visaoCnpjRaiz);
        }

        const { data: tmps } = await templateQuery
          .order('dre_ativo_sn', { ascending: false }) // 'S' vem antes de 'N'
          .order('created_at', { ascending: false })
          .limit(1);

        if (!tmps?.length) {
          setCardConfigs([]);
          setLineStyles(new Map());
          return;
        }
        
        const activeTemplateId = tmps[0].id;

        // Busca cards e estilos simultaneamente
        const [cardsRes, linesRes] = await Promise.all([
          supabase
            .from('dre_template_card')
            .select('*')
            .eq('dre_template_id', activeTemplateId)
            .order('crd_posicao'),
          supabase
            .from('dre_template_linhas')
            .select(
              `dre_linha_seq, tab_estilo_linha ( est_tipg_tela, est_nivel_ident )`
            )
            .eq('dre_template_id', activeTemplateId),
        ]);

        setCardConfigs(cardsRes.data || []);
        
        const map = new Map<number, LineStyle>();
        (linesRes.data || []).forEach((l: any) => {
          if (l.tab_estilo_linha) {
            map.set(Number(l.dre_linha_seq), { 
              seq: Number(l.dre_linha_seq), 
              tipografia: l.tab_estilo_linha.est_tipg_tela, 
              indentacao: l.tab_estilo_linha.est_nivel_ident || 0,
            });
          }
        });
        setLineStyles(map);
      } catch (e) {
        console.error("Error loading dashboard configs", e);
        setCardConfigs([]);
        setLineStyles(new Map());
      }
    };
    if (activePage === 'dashboard') {
      fetchConfigs();
    }
  }, [activePage, selectedVisao, visoes]);

  // Webhook DRE – com regras mais estritas e abort controller + cache em memória
  useEffect(() => {
    if (activePage !== 'dashboard' || !selectedVisao || !selectedPeriod) {
      return;
    }

    const cacheKey = `${selectedVisao}-${selectedPeriod}`;
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);

      // 1) Tenta do cache primeiro
      if (dreCacheRef.current[cacheKey]) {
        const cached = dreCacheRef.current[cacheKey];
        setRawDreData(cached);
        if (!cached.length) {
          setWarning('Sem Dados no Momento');
        }
        setLoading(false);
        return;
      }

      try {
        const webhookUrl =
          (import.meta as any).env?.VITE_DRE_WEBHOOK_URL ||
          'https://webhook.moondog-ia.tech/webhook/dre';

        const res = await fetch(
          `${webhookUrl}?carga=${selectedPeriod}&id=${selectedVisao}`,
          { signal: controller.signal }
        );
        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();

        if (!res.ok) {
          // inclui preview no debug acima (não joga corpo inteiro no console por segurança/perf)
          throw new Error(`Falha na resposta do servidor (${res.status})`);
        }

        let parsed: unknown;
        try {
          parsed = safeParseJson(rawText);
        } catch (parseErr) {
          throw new Error('Resposta do webhook não é um JSON válido');
        }

        const arr = Array.isArray(parsed) ? parsed : [];

        // cache em memória (ref) para evitar re-render/loops
        dreCacheRef.current[cacheKey] = arr;

        setRawDreData(arr);
        if (!arr.length) {
          setWarning('Sem Dados no Momento');
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          return;
        }
        console.error('Erro ao buscar DRE:', e);
        setRawDreData([]);
        setWarning('Sem Dados no Momento');
        setError(
          e?.message === 'Failed to fetch'
            ? 'Falha de comunicação com o servidor de DRE.'
            : 'Erro ao carregar dados da DRE.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [activePage, selectedVisao, selectedPeriod]);

  // Processing Table Data
  useEffect(() => {
    if (!rawDreData.length) { setDreData([]); return; }
    
    // Filtra pela visão atual para garantir que não pegamos lixo de outras visões (se o webhook retornar multi-contexto)
    const filteredByVisao = rawDreData.filter((r: any) => !r.visao_id || String(r.visao_id) === String(selectedVisao));
    const visible = filteredByVisao.filter((r: any) => r.dre_linha_visivel === 'S');
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
  }, [rawDreData, lineStyles, selectedVisao]);

  const processCard = useCallback((pos: number) => {
      const cfg = cardConfigs.find((c: CardConfig) => Number(c.crd_posicao) === pos);
      if (!cfg || cfg.dre_linha_seq === null) return { title: `Card ${pos}`, subtitle: 'Não configurado', value: '-', percentage: '-', variation: 0 };
      
      // Busca a linha correspondente garantindo que seja da visão selecionada
      const targetSeq = String(cfg.dre_linha_seq).trim();
      const candidatesSameSeq = rawDreData.filter((row: any) => String(row?.dre_linha_seq).trim() === targetSeq);
      const r = candidatesSameSeq.find((row: any) =>
        (!row.visao_id || String(row.visao_id) === String(selectedVisao))
      );
      
      if (!r) {
        return { title: cfg.tit_card_ajust || `Card ${pos}`, subtitle: 'Sem dados', value: '-', percentage: '-', variation: 0 };
      }

      const format = (type: 'ACUM' | 'PERC', compact: boolean) => {
          const v = Number(type === 'ACUM' ? (r.conta_acumulado ?? 0) : (r.conta_perc ?? 0));
          return type === 'ACUM' 
            ? `R$ ${safeToLocaleString(v, { minimumFractionDigits: 2, maximumFractionDigits: 2, notation: compact ? "compact" : "standard" })}` 
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
      // Alterado para format(..., false) para exibir valor full em vez de compacto
      return { title: cfg.tit_card_ajust || r.dre_linha_descri, subtitle: 'vs Mês Anterior', value: format(cfg.vlr_linha_01, false), percentage: format(cfg.vlr_linha_02, false), variation: vnt };
  }, [cardConfigs, rawDreData, selectedPeriod, selectedVisao]);

  const getInitials = (n: any) => { if (!n) return 'U'; const p = String(n).trim().split(' '); return p.length === 1 ? p[0].substring(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase(); };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} activePage={activePage} setActivePage={setActivePage} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} selectedClient={selectedClient} onChangeClient={() => selectClient(null)} />
      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        <header className="flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700 sticky top-0 z-20">
            <div className="flex items-center"><button className="lg:hidden mr-4" onClick={() => setIsSidebarOpen(true)}><MenuIcon /></button><h1 className="text-xl font-semibold text-white">{activePage === 'dashboard' ? 'Dashboard' : 'Gestão'}</h1></div>
            <div className="flex items-center gap-4"><div className="hidden md:block text-right"><p className="text-sm font-bold text-white leading-tight">{profile?.full_name || 'Usuário'}</p><p className="text-xs text-gray-400">{user?.email}</p></div><div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold border border-indigo-500">{getInitials(profile?.full_name)}</div><div className="border-l border-gray-600 h-8 mx-2"></div><button onClick={signOut} className="p-2 text-gray-300 hover:text-red-400 group"><LogoutIcon /></button></div>
        </header>
        <main className="p-4">
          {activePage === 'dashboard' && (
            <div>
              <div className="mb-4">
                  {(error || warning) && <div className={`p-3 mb-4 text-sm rounded-lg ${error ? 'text-red-400 bg-red-900/50 border border-red-800' : 'text-yellow-400 bg-yellow-900/50 border border-yellow-800'}`}>{error || warning}</div>}
                  <div className="px-4 py-2 mb-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-white uppercase">DRE Visão Consolidada</h2>
                    <div className="flex gap-2">
                        <select value={selectedPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(Number(e.target.value))} className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md">{periods.map((p: Periodo) => <option key={p.retorno} value={p.retorno}>{p.display}</option>)}</select>
                        <select value={selectedVisao} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedVisao(e.target.value)} className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md">{visoes.map((v: Visao) => <option key={v.id} value={v.id}>{v.vis_nome}</option>)}</select>
                        <button onClick={() => {
                            const ws = XLSX.utils.json_to_sheet(dreData);
                            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DRE");
                            XLSX.writeFile(wb, `DRE_${selectedPeriod}.xlsx`);
                        }} disabled={!dreData.length} className="flex items-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"><XlsxIcon /> XLSX</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(p => { const d = processCard(p); return <StatCard key={p} title={d.title} subtitle={d.subtitle} value={d.value} percentage={d.percentage} variation={d.variation} />; })}
                  </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">{loading ? <div className="flex flex-col items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div></div> : dreData.length ? <DreTable data={dreData} selectedPeriod={selectedPeriod} /> : <div className="text-center p-8 min-h-[400px] flex flex-col justify-center"><h3 className="text-xl font-bold text-white mb-2">Sem Dados</h3><p className="text-gray-400">Não há registros para os filtros selecionados.</p></div>}</div>
            </div>
          )}
          {activePage === 'visao' && <VisaoPage />}
          {activePage === 'cliente' && <ClientePage />}
          {activePage === 'grupo-empresarial' && <GrupoEmpresarialPage />}
          {activePage === 'empresa' && <EmpresaPage />}
          {activePage === 'plano-contabil' && <PlanoContabilPage />}
          {activePage === 'templates' && <TemplatePage />}
          {activePage === 'situacao' && <SituacaoPage />}
          {activePage === 'tipo-linha' && <TipoLinhaPage />}
          {activePage === 'estilo-linha' && <EstiloLinhaPage />}
          {activePage === 'tipo-visao' && <TipoVisaoPage />}
          {activePage === 'usuarios' && <UsuarioPage />}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
