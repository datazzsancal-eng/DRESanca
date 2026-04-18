
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth, ClientContext } from '../contexts/AuthContext';
import ClientePage from './cliente/ClientePage';
import EmpresaPage from './empresa/EmpresaPage';
import PlanoContabilPage from './plano-contabil/PlanoContabilPage';
import CargaPlanoPage from './plano-contabil/CargaPlanoPage';
import CargaMovimentoPage from './movimentacoes/CargaMovimentoPage';
import RecalculoPage from './movimentacoes/RecalculoPage';
import TemplatePage from './template/TemplatePage';
import SituacaoPage from './situacao/SituacaoPage';
import TipoLinhaPage from './tipo-linha/TipoLinhaPage';
import EstiloLinhaPage from './estilo-linha/EstiloLinhaPage';
import TipoVisaoPage from './tipo-visao/TipoVisaoPage';
import VisaoPage from './visao/VisaoPage';
import UsuarioPage from './usuario/UsuarioPage';
import NovoDashboardPage from './NovoDashboardPage';
import { TableSkeleton, CardSkeleton } from './shared/Skeleton';
import DreTable, { DreDataRow } from './shared/DreTable';
import StatCard from './shared/StatCard';
import * as XLSX from 'xlsx';
import appMetadata from '../app_metadata.json';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

// Type definitions
interface Periodo { retorno: number; display: string; }
interface Visao { id: string; vis_nome: string; vis_descri: string | null; cliente_id?: string | null; }
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
const CsvIcon = () => <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="h-5 w-5 mr-1 text-blue-400" />;
const SwitchIcon = () => <Icon path="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" className="h-4 w-4" />;
const MenuIcon = () => <Icon path="M4 6h16M4 12h16M4 18h16" />;
const CloseIcon = () => <Icon path="M6 18L18 6M6 6l12 12" />;
const ChevronDoubleLeftIcon = () => <Icon path="M11 17l-5-5 5-5M18 17l-5-5 5-5" className="h-5 w-5"/>;
const ChevronDoubleRightIcon = () => <Icon path="M13 17l5-5-5-5M6 17l5-5-5-5" className="h-5 w-5"/>;
const KeyIcon = () => <Icon path="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" className="h-4 w-4" />;

const SancalLogo = () => (
  <img src="https://www.sancal.com.br/wp-content/uploads/elementor/thumbs/logo-white-qfydekyggou3snwsfrlsc913ym97p1hveemqwoinls.png" alt="Sancal Logo" className="h-8 w-auto"/>
);

const navigationData: any[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN', 'GESTOR CONTA', 'COLABORADOR', 'LEITOR'] },
  { id: 'novo-dash', label: 'Novo Dash', icon: () => <Icon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN', 'GESTOR CONTA', 'COLABORADOR', 'LEITOR'] },
  { id: 'movimentacoes', label: 'Movimentações', icon: () => <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN', 'GESTOR CONTA', 'COLABORADOR'], children: [
    { id: 'carga-movimento', label: 'Carga do Movimento' },
    { id: 'recalculo', label: 'Recálculo' }
  ]},
  { id: 'analise-modelos', label: 'Análise & Modelos', icon: VisionIcon, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN', 'GESTOR CONTA'], children: [{ id: 'visao', label: 'Visões' }, { id: 'templates', label: 'Templates' }] },
  { id: 'estrutura', label: 'Estrutura', icon: StructureIcon, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN', 'GESTOR CONTA', 'COLABORADOR'], children: [
    { id: 'cliente', label: 'Cliente', roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN'] }, 
    { id: 'empresa', label: 'Empresa', roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN', 'GESTOR CONTA'] }, 
    { id: 'menu-plano-contabil', label: 'Plano Contábil', children: [
      { id: 'plano-contabil', label: 'Visão Plano' },
      { id: 'carga-plano', label: 'Carga' }
    ]}
  ]},
  { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN'], children: [{ id: 'situacao', label: 'Situação' }, { id: 'tipo-linha', label: 'Tipo Linha DRE' }, { id: 'estilo-linha', label: 'Estilo Linha DRE' }, { id: 'tipo-visao', label: 'Tipo Visão DRE' }] },
  { id: 'administracao', label: 'Administração', icon: AdminIcon, roles: ['MASTER', 'GESTOR CLIENTE', 'ADMIN'], children: [{ id: 'usuarios', label: 'Usuários' }] },
];

interface SidebarProps {
  isSidebarOpen: boolean; setIsSidebarOpen: (isOpen: boolean) => void; activePage: string; setActivePage: (page: string) => void; isCollapsed: boolean; onToggleCollapse: () => void; selectedClient: ClientContext | null; onChangeClient: () => void; userRole: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen, activePage, setActivePage, isCollapsed, onToggleCollapse, selectedClient, onChangeClient, userRole }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({ 'analise-modelos': true, estrutura: true });
  useEffect(() => { if (isCollapsed) setOpenMenus({}); }, [isCollapsed]);
  const toggleMenu = (id: string) =>
    setOpenMenus((prev: { [key: string]: boolean }) => ({ ...prev, [id]: !prev[id] }));
  const getNavItemClasses = (p: string) => `flex items-center w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-2' : 'px-4'} ${activePage === p ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'}`;

  const filteredNav = useMemo(() => {
    const filterItems = (items: any[]): any[] => {
      return items
        .filter(item => !item.roles || (userRole && item.roles.includes(userRole)))
        .map(item => {
          if (item.children) {
            return { ...item, children: filterItems(item.children) };
          }
          return item;
        })
        .filter(item => !item.children || item.children.length > 0);
    };
    return filterItems(navigationData);
  }, [userRole]);

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} relative`}>
        {/* Floating Toggle Button */}
        <button 
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-20 z-50 items-center justify-center w-6 h-6 bg-gray-700 border border-gray-600 rounded-full text-gray-300 hover:text-white hover:bg-gray-600 transition-all shadow-md"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}
        </button>

        <div className={`flex items-center h-16 px-4 border-b border-gray-700 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed ? <SancalLogo /> : <DashboardIcon />}
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><CloseIcon /></button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {filteredNav.map((item: any) => (
            <div key={item.id}>
              <button onClick={() => item.children ? (!isCollapsed && toggleMenu(item.id)) : setActivePage(item.id)} className={getNavItemClasses(item.id)} title={isCollapsed ? item.label : ''}>
                <div className="flex items-center"><item.icon />{!isCollapsed && <span className="ml-3">{item.label}</span>}</div>
                {!isCollapsed && item.children && (openMenus[item.id] ? <ChevronUpIcon /> : <ChevronDownIcon />)}
              </button>
              {!isCollapsed && item.children && openMenus[item.id] && (
                <div className="py-1 pl-2 space-y-1">
                  {item.children.map((child: any) => (
                    <div key={child.id}>
                      <button onClick={() => child.children ? (!isCollapsed && toggleMenu(child.id)) : setActivePage(child.id)} className={`flex items-center w-full py-2 pl-11 pr-4 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors ${activePage === child.id ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                        <span className="flex-1 text-left">{child.label}</span>
                        {!isCollapsed && child.children && (openMenus[child.id] ? <ChevronUpIcon /> : <ChevronDownIcon />)}
                      </button>
                      {!isCollapsed && child.children && openMenus[child.id] && (
                        <div className="py-1 space-y-1">
                          {child.children.map((grandchild: any) => (
                            <button key={grandchild.id} onClick={() => setActivePage(grandchild.id)} className={`flex items-center w-full py-2 pl-14 pr-4 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors ${activePage === grandchild.id ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>{grandchild.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
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
          
          <div className={`flex flex-col items-center pt-2 border-t border-gray-700/50 mt-1 ${isCollapsed ? 'px-1' : 'px-2'}`}>
            <img 
              src="https://raw.githubusercontent.com/synapiens/uteis/refs/heads/main/LogoSynapiens/Synapiens_logo_hor.png" 
              alt="Synapiens" 
              className={`${isCollapsed ? 'h-4 w-auto' : 'h-7 w-auto'}`}
            />
            {!isCollapsed && (
              <span className="text-[10px] text-gray-500 mt-1 font-mono">
                {appMetadata.app_version}
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const dreCacheRef = useRef<Record<string, any[]>>({});
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Fetch de Visões (quando o cliente muda)
  useEffect(() => {
    const fetchVisoes = async () => {
      if (!user?.id || !selectedClient?.id || activePage !== 'dashboard') return;
      try {
        let hasFull = false;
        let allowedIds = new Set<string>();

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
            allowedIds = new Set(
              relData?.map((r: any) => r.empresa_id).filter(Boolean)
            );
        }

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
      } catch (e) {
        console.error("Erro ao carregar visões:", e);
      }
    };
    fetchVisoes();
  }, [activePage, user?.id, selectedClient?.id, profile?.function]);

  // 2. Fetch de Períodos (quando a Visão muda - Lógica Dinâmica)
  useEffect(() => {
    const fetchPeriods = async () => {
      if (!selectedVisao || activePage !== 'dashboard') return;
      try {
        // Step 1: Obter os IDs de integração das empresas da Visão selecionada
        const { data: relData } = await supabase
          .from('rel_visao_empresa')
          .select('empresa_integra_id')
          .eq('visao_id', selectedVisao);

        if (!relData || relData.length === 0) {
          setPeriods([]);
          setSelectedPeriod('');
          return;
        }

        const allowedIntegraIds = relData.map(r => r.empresa_integra_id).filter(Boolean);

        // Step 2: Buscar períodos na view filtrando por essas empresas
        const { data: pData } = await supabase
          .from('viw_periodo_calc')
          .select('retorno, display')
          .in('emp_cod_integra', allowedIntegraIds)
          .order('retorno', { ascending: false });

        if (pData) {
          // Deduplicar no JS para obter DISTINC retorno, display
          const uniqueMap = new Map();
          pData.forEach(item => {
            if (!uniqueMap.has(item.retorno)) {
              uniqueMap.set(item.retorno, item);
            }
          });
          const uniquePeriods = Array.from(uniqueMap.values());
          
          setPeriods(uniquePeriods);

          if (uniquePeriods.length > 0) {
            // Se o período atual não existir na nova lista, seleciona o primeiro (mais recente)
            const isValid = uniquePeriods.some(p => Number(p.retorno) === Number(selectedPeriod));
            if (!isValid) {
              setSelectedPeriod(Number(uniquePeriods[0].retorno));
            }
          } else {
            setSelectedPeriod('');
          }
        }
      } catch (e) {
        console.error("Erro ao carregar períodos dinâmicos:", e);
      }
    };
    fetchPeriods();
  }, [selectedVisao, activePage]);

  // Configs & Webhook DRE - Parallelized with Timeout and Unified Loading
  useEffect(() => {
    if (activePage !== 'dashboard' || !selectedVisao || !selectedPeriod) {
      return;
    }

    const cacheKey = `${selectedVisao}-${selectedPeriod}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout

    const loadDashboardData = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);

      try {
        // 1. Promise for Configs (Cards & Line Styles)
        const fetchConfigsPromise = async () => {
          const { data: visaoDetails, error: visaoError } = await supabase
            .from('dre_visao')
            .select('id, cliente_id, cnpj_raiz')
            .eq('id', selectedVisao)
            .single();

          if (visaoError || !visaoDetails) throw new Error('Visão não encontrada');

          const visaoCnpjRaiz: string | null = visaoDetails.cnpj_raiz || null;

          let templateQuery = supabase
            .from('dre_template')
            .select('id, cliente_cnpj, dre_ativo_sn, created_at')
            .eq('cliente_id', visaoDetails.cliente_id);

          if (visaoCnpjRaiz) {
            templateQuery = templateQuery.eq('cliente_cnpj', visaoCnpjRaiz);
          }

          const { data: tmps } = await templateQuery
            .order('dre_ativo_sn', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1);

          if (!tmps?.length) {
            return { cards: [], styles: new Map<number, LineStyle>() };
          }
          
          const activeTemplateId = tmps[0].id;

          const [cardsRes, linesRes] = await Promise.all([
            supabase
              .from('dre_template_card')
              .select('*')
              .eq('dre_template_id', activeTemplateId)
              .order('crd_posicao'),
            supabase
              .from('dre_template_linhas')
              .select(`dre_linha_seq, tab_estilo_linha ( est_tipg_tela, est_nivel_ident )`)
              .eq('dre_template_id', activeTemplateId),
          ]);

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

          return { cards: cardsRes.data || [], styles: map };
        };

        // 2. Promise for Webhook DRE Data
        const fetchDrePromise = async () => {
          if (dreCacheRef.current[cacheKey]) {
            return dreCacheRef.current[cacheKey];
          }

          const webhookUrl = (import.meta as any).env?.VITE_DRE_WEBHOOK_URL || 'https://webhook.synapiens.com.br/webhook/dre_busca';

          const res = await fetch(
            `${webhookUrl}?carga=${selectedPeriod}&id=${selectedVisao}`,
            { signal: controller.signal }
          );

          if (!res.ok) {
            throw new Error(`Falha na resposta do servidor (${res.status})`);
          }

          const rawText = await res.text();
          let parsed: unknown;
          try {
            parsed = safeParseJson(rawText);
          } catch (parseErr) {
            throw new Error('Resposta do webhook não é um JSON válido');
          }

          const arr = Array.isArray(parsed) ? parsed : [];
          dreCacheRef.current[cacheKey] = arr; // Save to cache
          return arr;
        };

        // Execute both promises in parallel
        const [configsResult, dreResult] = await Promise.all([
          fetchConfigsPromise(),
          fetchDrePromise()
        ]);

        if (!controller.signal.aborted) {
          setCardConfigs(configsResult.cards);
          setLineStyles(configsResult.styles);
          setRawDreData(dreResult);
          
          if (!dreResult.length) {
            setWarning('Sem Dados no Momento');
          }
        }

      } catch (e: any) {
        if (e.name === 'AbortError') {
          setError('Tempo limite excedido ao buscar dados do servidor (Timeout).');
          setWarning('Sem Dados no Momento');
          setRawDreData([]);
        } else {
          console.error('Erro ao carregar dashboard:', e);
          setRawDreData([]);
          setWarning('Sem Dados no Momento');
          setError(
            e?.message === 'Failed to fetch'
              ? 'Falha de comunicação com o servidor de DRE.'
              : `Erro ao carregar dados: ${e.message}`
          );
        }
      } finally {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [activePage, selectedVisao, selectedPeriod]);

  // Processing Table Data
  useEffect(() => {
    if (profile?.function === 'LEITOR' && activePage !== 'dashboard') {
      setActivePage('dashboard');
    }
  }, [profile?.function, activePage]);

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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordData.new !== passwordData.confirm) {
      setPasswordError("A nova senha e a confirmação não coincidem.");
      return;
    }

    if (passwordData.new.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setPasswordLoading(true);
    try {
      // Verify current password by attempting to sign in again
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.current
      });

      if (signInError) {
        throw new Error("A senha atual está incorreta.");
      }

      const { error } = await supabase.auth.updateUser({ password: passwordData.new });
      if (error) throw error;
      setPasswordSuccess("Senha alterada com sucesso!");
      setPasswordData({ current: '', new: '', confirm: '' });
      setTimeout(() => setIsPasswordModalOpen(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} activePage={activePage} setActivePage={setActivePage} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} selectedClient={selectedClient} onChangeClient={() => selectClient(null)} userRole={profile?.function || null} />
      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        <header className="flex items-center justify-between h-16 px-6 bg-gray-800 border-b border-gray-700 sticky top-0 z-20">
            <div className="flex items-center"><button className="lg:hidden mr-4" onClick={() => setIsSidebarOpen(true)}><MenuIcon /></button><h1 className="text-xl font-semibold text-white">{activePage === 'dashboard' ? 'Dashboard' : 'Gestão'}</h1></div>
            <div className="flex items-center gap-4">
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 hover:bg-gray-700 p-1.5 rounded-lg transition-colors"
                >
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-bold text-white leading-tight">{profile?.full_name || 'Usuário'}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold border border-indigo-500">
                    {getInitials(profile?.full_name)}
                  </div>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button 
                      onClick={() => { setIsPasswordModalOpen(true); setIsUserMenuOpen(false); }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      <KeyIcon />
                      <span className="ml-3">Troca de senha</span>
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button 
                      onClick={signOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                    >
                      <LogoutIcon />
                      <span className="ml-3 font-medium">Sair</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
        </header>
        <main className="p-4">
          {activePage === 'dashboard' && (
            <div>
              <div className="mb-4">
                  {(error || warning) && <div className={`p-3 mb-4 text-sm rounded-lg ${error ? 'text-red-400 bg-red-900/50 border border-red-800' : 'text-yellow-400 bg-yellow-900/50 border border-yellow-800'}`}>{error || warning}</div>}
                  <div className="px-4 py-2 mb-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-white uppercase">DRE Visão Consolidada</h2>
                    <div className="flex gap-2">
                        <select value={selectedVisao} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedVisao(e.target.value)} className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md">{visoes.map((v: Visao) => <option key={v.id} value={v.id}>{v.vis_nome}</option>)}</select>
                        <select value={selectedPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(Number(e.target.value))} className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md">{periods.map((p: Periodo) => <option key={p.retorno} value={p.retorno}>{p.display}</option>)}</select>
                        <button onClick={() => {
                            const ws = XLSX.utils.json_to_sheet(dreData.map(({ isBold, isItalic, indentationLevel, ...rest }) => rest));
                            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DRE");
                            XLSX.writeFile(wb, `DRE_${selectedPeriod}.xlsx`);
                        }} disabled={!dreData.length} className="flex items-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"><XlsxIcon /> XLSX</button>
                        <button onClick={() => {
                            const ws = XLSX.utils.json_to_sheet(dreData.map(({ isBold, isItalic, indentationLevel, ...rest }) => rest));
                            const csv = XLSX.utils.sheet_to_csv(ws);
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement("a");
                            const url = URL.createObjectURL(blob);
                            link.setAttribute("href", url);
                            link.setAttribute("download", `DRE_${selectedPeriod}.csv`);
                            link.style.visibility = 'hidden';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }} disabled={!dreData.length} className="flex items-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"><CsvIcon /> CSV</button>
                    </div>
                  </div>
                  {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
                    </div>
                  ) : cardConfigs.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {cardConfigs.map(cfg => { 
                        const d = processCard(cfg.crd_posicao); 
                        return <StatCard key={cfg.id} title={d.title} subtitle={d.subtitle} value={d.value} percentage={d.percentage} variation={d.variation} />; 
                      })}
                    </div>
                  )}
              </div>
              <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">{loading ? <TableSkeleton rows={10} cols={6} /> : dreData.length ? <DreTable data={dreData} selectedPeriod={selectedPeriod} /> : <div className="text-center p-8 min-h-[400px] flex flex-col justify-center"><h3 className="text-xl font-bold text-white mb-2">Sem Dados</h3><p className="text-gray-400">Não há registros para os filtros selecionados.</p></div>}</div>
            </div>
          )}
          {activePage === 'novo-dash' && <NovoDashboardPage />}
          {activePage === 'visao' && <VisaoPage />}
          {activePage === 'cliente' && <ClientePage />}
          {activePage === 'empresa' && <EmpresaPage />}
          {activePage === 'plano-contabil' && <PlanoContabilPage />}
          {activePage === 'carga-plano' && <CargaPlanoPage />}
          {activePage === 'carga-movimento' && <CargaMovimentoPage />}
          {activePage === 'recalculo' && <RecalculoPage />}
          {activePage === 'templates' && <TemplatePage />}
          {activePage === 'situacao' && <SituacaoPage />}
          {activePage === 'tipo-linha' && <TipoLinhaPage />}
          {activePage === 'estilo-linha' && <EstiloLinhaPage />}
          {activePage === 'tipo-visao' && <TipoVisaoPage />}
          {activePage === 'usuarios' && <UsuarioPage />}
        </main>
      </div>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyIcon /> Troca de Senha
              </h3>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 text-sm text-green-400 bg-green-900/20 border border-green-800 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {passwordSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha Atual</label>
                  <input 
                    type="password"
                    required
                    value={passwordData.current}
                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Sua senha atual"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Nova Senha</label>
                  <input 
                    type="password"
                    required
                    value={passwordData.new}
                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Confirmar Nova Senha</label>
                  <input 
                    type="password"
                    required
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={passwordLoading || !!passwordSuccess}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
