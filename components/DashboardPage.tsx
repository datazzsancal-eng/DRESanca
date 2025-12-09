
import React, { useState, useEffect, useMemo } from 'react';
// import { supabase } from '../../lib/supabaseClient.ts';
import { supabase } from '../lib/supabaseClient';
import { useAuth, ClientContext } from '../contexts/AuthContext';
import ClientePage from './cliente/ClientePage';
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
interface Periodo {
  retorno: number;
  display: string;
}
interface Visao {
  id: string;
  vis_nome: string;
  vis_descri: string | null;
  cliente_id?: string | null; 
}
interface DreDataRow {
    seq: number; // dre_linha_seq
    desc: string;
    jan: number;
    fev: number;
    mar: number;
    abr: number;
    mai: number;
    jun: number;
    jul: number;
    ago: number;
    set: number;
    out: number;
    nov: number;
    dez: number;
    accumulated: number;
    percentage: number;
    // Styling properties
    isBold: boolean;
    isItalic: boolean;
    indentationLevel: number;
}

interface CardConfig {
    id: number;
    crd_posicao: number;
    tit_card_ajust: string | null;
    dre_linha_seq: number | null;
    vlr_linha_01: 'ACUM' | 'PERC';
    vlr_linha_02: 'ACUM' | 'PERC';
}

interface LineStyle {
    seq: number;
    tipografia: 'NORMAL' | 'NEGRITO' | 'ITALICO' | 'NEGR/ITAL' | null;
    indentacao: number;
}


// Icons defined as stateless functional components
const Icon = ({ path, className = "h-6 w-6" }: { path: string, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);
const DashboardIcon = () => <Icon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />;
const VisionIcon = () => <Icon path="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />;
const StructureIcon = () => <Icon path="M8 9l4-4 4 4m0 6l-4 4-4-4" />;
const SettingsIcon = () => <Icon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
const AdminIcon = () => <Icon path="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />;
const ChevronDownIcon = () => <Icon path="M19 9l-7 7-7-7" className="h-4 w-4" />;
const ChevronUpIcon = () => <Icon path="M5 15l7-7 7 7" className="h-4 w-4" />;
const LogoutIcon = () => <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />;
const UserIcon = () => <Icon path="M16 7a4 4 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="h-8 w-8 text-gray-400"/>;
const PdfIcon = () => <Icon path="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-5 w-5 mr-1" />;
const CsvIcon = () => <Icon path="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-5 w-5 mr-1" />;
const XlsxIcon = () => <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="h-5 w-5 mr-1 text-green-500" />;
const SwitchIcon = () => <Icon path="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" className="h-4 w-4" />;

const MenuIcon = () => <Icon path="M4 6h16M4 12h16M4 18h16" />;
const CloseIcon = () => <Icon path="M6 18L18 6M6 6l12 12" />;
const ChevronDoubleLeftIcon = () => <Icon path="M11 17l-5-5 5-5M18 17l-5-5 5-5" className="h-5 w-5"/>;
const ChevronDoubleRightIcon = () => <Icon path="M13 17l5-5-5-5M6 17l5-5-5-5" className="h-5 w-5"/>;

const SancalLogo = () => (
  <img 
    src="https://www.sancal.com.br/wp-content/uploads/elementor/thumbs/logo-white-qfydekyggou3snwsfrlsc913ym97p1hveemqwoinls.png" 
    alt="Sancal Logo" 
    className="h-8 w-auto"
  />
);

// Sidebar data structure
interface NavItem {
  id: string;
  label: string;
  icon: React.FC;
  children?: NavItem[];
  isHeader?: boolean;
}

const navigationData: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  {
    id: 'analise-modelos',
    label: 'Análise & Modelos',
    icon: VisionIcon,
    children: [
      { id: 'visao', label: 'Visões', icon: () => <></> },
      { id: 'templates', label: 'Templates', icon: () => <></> },
    ],
  },
  {
    id: 'estrutura',
    label: 'Estrutura',
    icon: StructureIcon,
    children: [
      { id: 'cliente', label: 'Cliente', icon: () => <></> },
      { id: 'empresa', label: 'Empresa', icon: () => <></> },
      { id: 'plano-contabil', label: 'Plano Contábil', icon: () => <></> },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: SettingsIcon,
    children: [
      { id: 'tabelas-header', label: 'Tabelas', icon: () => <></>, isHeader: true },
      { id: 'situacao', label: 'Situação', icon: () => <></> },
      { id: 'tipo-linha', label: 'Tipo Linha DRE', icon: () => <></> },
      { id: 'estilo-linha', label: 'Estilo Linha DRE', icon: () => <></> },
      { id: 'tipo-visao', label: 'Tipo Visão DRE', icon: () => <></> },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração',
    icon: AdminIcon,
    children: [
      { id: 'usuarios', label: 'Usuários', icon: () => <></> },
      { id: 'permissoes', label: 'Permissões', icon: () => <></> },
    ],
  },
];


// Sidebar component
interface SidebarProps {
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  activePage: string;
  setActivePage: (page: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userEmail?: string;
  userName?: string | null;
  selectedClient: ClientContext | null;
  onChangeClient: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isSidebarOpen, setIsSidebarOpen, activePage, setActivePage, isCollapsed, onToggleCollapse, userEmail, userName, selectedClient, onChangeClient }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    'analise-modelos': true,
    estrutura: true,
    configuracoes: false,
    administracao: false,
  });
  
  useEffect(() => {
    if (isCollapsed) {
      setOpenMenus({});
    }
  }, [isCollapsed]);


  const toggleMenu = (id: string) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getNavItemClasses = (page: string) => 
    `flex items-center w-full py-2.5 text-sm font-medium text-left rounded-lg transition-colors duration-200 ${isCollapsed ? 'px-2 justify-center' : 'px-4'} ${
      activePage === page 
      ? 'bg-gray-900 text-white' 
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;
  
  const getSubNavItemClasses = (page: string) => 
  `flex items-center w-full py-2 pl-11 pr-4 text-sm font-medium text-left text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-colors duration-200 ${
    activePage === page ? 'bg-gray-700 !text-white' : ''
  }`;

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
           onClick={() => setIsSidebarOpen(false)}>
      </div>
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gray-800 text-white transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`flex items-center h-16 px-4 border-b border-gray-700 shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed ? <SancalLogo /> : <DashboardIcon />}
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navigationData.map((item) => {
            if (item.children) {
              const isOpen = openMenus[item.id] && !isCollapsed;
              return (
                <div key={item.id}>
                  <button 
                    onClick={() => !isCollapsed && toggleMenu(item.id)} 
                    className={`${getNavItemClasses(item.id + '-parent')} w-full ${!isCollapsed ? 'justify-between' : 'justify-center'}`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <div className="flex items-center">
                      <item.icon />
                      {!isCollapsed && <span className="ml-3">{item.label}</span>}
                    </div>
                    {!isCollapsed && (isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />)}
                  </button>
                  {isOpen && (
                    <div className="py-1 pl-2 space-y-1">
                      {item.children.map(child => {
                         if (child.isHeader) {
                            return (
                                <div key={child.id} className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase">{child.label}</div>
                            );
                         }
                         return (
                            <button key={child.id} onClick={() => setActivePage(child.id)} className={getSubNavItemClasses(child.id)}>
                                {child.label}
                            </button>
                         );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button key={item.id} onClick={() => setActivePage(item.id)} className={getNavItemClasses(item.id)} title={isCollapsed ? item.label : ''}>
                <item.icon />
                {!isCollapsed && <span className="ml-3">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-700 shrink-0">
          {/* Selected Client Display */}
          {!isCollapsed && selectedClient && (
            <div className="flex items-center justify-between p-2 mb-2 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="truncate flex-1">
                    <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Cliente Atual</p>
                    <p className="text-sm font-semibold text-white truncate" title={selectedClient.cli_nome || ''}>{selectedClient.cli_nome}</p>
                </div>
                <button onClick={onChangeClient} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors ml-2" title="Trocar Cliente">
                    <SwitchIcon />
                </button>
            </div>
          )}
          {isCollapsed && (
             <button onClick={onChangeClient} className="flex justify-center w-full p-2 mb-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors" title={`Cliente: ${selectedClient?.cli_nome || 'Nenhum'}`}>
                <SwitchIcon />
            </button>
          )}

          <div className={`flex items-center p-2 rounded-lg ${isCollapsed ? 'justify-center' : ''}`}>
            <UserIcon />
            {!isCollapsed && (
              <div className="ml-3 truncate">
                <p className="text-sm font-semibold">{userName || 'Usuário'}</p>
                <p className="text-xs text-gray-400 truncate w-32" title={userEmail}>{userEmail || '...'}</p>
              </div>
            )}
          </div>
          <button onClick={onLogout} className={`flex items-center w-full p-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-red-600 hover:text-white transition-colors duration-200 ${isCollapsed ? 'justify-center' : ''}`} title={isCollapsed ? 'Logout' : ''}>
            <LogoutIcon /> 
            {!isCollapsed && <span className="ml-2">Logout</span>}
          </button>
           <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex items-center w-full p-2 mt-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-600 transition-colors duration-200 ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isCollapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}
            {!isCollapsed && <span className="ml-2">Recolher</span>}
          </button>
          {!isCollapsed && (
            <div className="flex justify-center pt-4 pb-2">
                <img 
                src="https://raw.githubusercontent.com/synapiens/uteis/refs/heads/main/logomarca/Synapiens_logo_hor.png" 
                alt="Synapiens" 
                className="h-8 w-auto"
                />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

// StatCard component
interface StatCardProps {
  title: string;
  subtitle: string;
  value: string;
  percentage: string;
  variation: number;
}
const StatCard: React.FC<StatCardProps> = ({ title, subtitle, value, percentage, variation }) => {
  const isPositive = variation >= 0;
  const variationColor = isPositive ? 'text-green-500' : 'text-red-500';

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400 truncate" title={title}>{title}</p>
      </div>
      <div className="mt-2">
        <h3 className="text-2xl font-bold text-white truncate">{value}</h3>
        <p className="text-sm text-gray-400 truncate">{percentage}</p>
      </div>
      <div className={`text-xs font-semibold text-right mt-2 ${variationColor}`}>
        {isPositive ? '▲' : '▼'} {Math.abs(variation).toFixed(2)}%
        <span className="text-gray-500 ml-1 font-normal">{subtitle}</span>
      </div>
    </div>
  );
};

// DreTable Component
interface DreTableProps {
    data: DreDataRow[];
    selectedPeriod: number | '';
}
const DreTable: React.FC<DreTableProps> = ({ data, selectedPeriod }) => {
    const allMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Determine valid months based on selectedPeriod (YYYYMM)
    const currentMonthIndex = selectedPeriod ? (Number(selectedPeriod) % 100) : 12;
    const visibleMonths = allMonths.slice(0, currentMonthIndex);

    const formatNumber = (value: number) => {
        if (value === 0) return '-';
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatPercentage = (value: number) => {
        if (value === 0) return '-';
        return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    };

    return (
        <div className="overflow-x-auto bg-gray-800 border border-gray-700 rounded-lg shadow-md">
            <table className="min-w-full text-sm divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Descrição</th>
                        {visibleMonths.map(month => (
                            <th key={month} className="px-3 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">{month}</th>
                        ))}
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Acumulado</th>
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">%</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map((row, index) => {
                        const accumulated = row.accumulated || 0;
                        const percentage = row.percentage || 0;
                        
                        // Dynamic Styles
                        const fontWeight = row.isBold ? 'bold' : 'normal';
                        const fontStyle = row.isItalic ? 'italic' : 'normal';
                        // Adjust padding: 
                        // Using 'ch' unit which is approximately the width of the '0' character.
                        // We add the base padding (0.75rem ~ px-3) to the indentation level.
                        const paddingLeft = `calc(0.75rem + ${(row.indentationLevel || 0)}ch)`;

                        return (
                            <tr key={index} className="hover:bg-gray-700/50">
                                <td 
                                    className="px-3 py-2 whitespace-nowrap text-gray-300"
                                    style={{ 
                                        fontWeight, 
                                        fontStyle, 
                                        paddingLeft 
                                    }}
                                >
                                    {row.desc}
                                </td>
                                {visibleMonths.map((month) => {
                                    const val = row[month.toLowerCase() as keyof DreDataRow] as number || 0;
                                    return (
                                        <td key={month} className={`px-3 py-2 text-right whitespace-nowrap ${val < 0 ? 'text-red-500' : 'text-gray-200'}`}>
                                            {formatNumber(val)}
                                        </td>
                                    );
                                })}
                                <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${accumulated < 0 ? 'text-red-500' : 'text-white'}`}>{formatNumber(accumulated)}</td>
                                <td className={`px-3 py-2 text-right whitespace-nowrap font-medium text-gray-400`}>{formatPercentage(percentage)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


// Main DashboardPage component
// Removed onLogout from props as we use useAuth now
const DashboardPage: React.FC = () => {
  const { signOut, user, profile, selectedClient, selectClient } = useAuth();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  
  const [rawDreData, setRawDreData] = useState<any[]>([]); // Data from Webhook
  const [dreData, setDreData] = useState<DreDataRow[]>([]); // Formatted data for table
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  
  // State for periods dropdown
  const [periods, setPeriods] = useState<Periodo[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | ''>('');
  const [periodsLoading, setPeriodsLoading] = useState(true);

  // State for visoes dropdown
  const [visoes, setVisoes] = useState<Visao[]>([]);
  const [selectedVisao, setSelectedVisao] = useState<string>('');
  const [visoesLoading, setVisoesLoading] = useState(true);

  // State for dynamic cards and styles
  const [cardConfigs, setCardConfigs] = useState<CardConfig[]>([]);
  const [lineStyles, setLineStyles] = useState<Map<number, LineStyle>>(new Map());

  // Fetch dropdown data on mount
  useEffect(() => {
    const fetchDropdownData = async () => {
      let currentWarnings: string[] = [];

      // Fetch periods from Supabase view
      setPeriodsLoading(true);
      try {
        const { data, error: periodError } = await supabase
          .from('viw_periodo_calc')
          .select('retorno, display')
          .order('retorno', { ascending: false });
        if (periodError) throw periodError;
        if (data && data.length > 0) {
          setPeriods(data);
          setSelectedPeriod(Number(data[0].retorno));
        } else {
            currentWarnings.push('Nenhum período foi encontrado.');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Verifique a conexão ou as permissões da view.';
        console.error("Failed to fetch periods:", err);
        currentWarnings.push(`Atenção: Não foi possível carregar os períodos (${errorMessage}).`);
      } finally {
        setPeriodsLoading(false);
      }
      
      // Fetch visoes from Supabase table
      setVisoesLoading(true);
      try {
          // If we have a selectedClient, filter visions by it
          let query = supabase
            .from('dre_visao')
            .select('id, vis_nome, vis_descri, cliente_id')
            .order('vis_nome');
          
          if (selectedClient) {
              query = query.eq('cliente_id', selectedClient.id);
          }

          const { data, error: visaoError } = await query;

          if (visaoError) throw visaoError;
          if (data && data.length > 0) {
              setVisoes(data);
              setSelectedVisao(data[0].id);
          } else {
              if (selectedClient) {
                  currentWarnings.push(`Nenhuma visão encontrada para o cliente ${selectedClient.cli_nome}.`);
              } else {
                  currentWarnings.push('Nenhuma visão foi encontrada na base de dados.');
              }
              setVisoes([]);
              setSelectedVisao('');
          }
      } catch (err: any) {
          const errorMessage = err.message || 'Verifique a conexão ou as permissões da tabela.';
          console.error("Failed to fetch visoes:", err);
          currentWarnings.push(`Atenção: Não foi possível carregar as visões (${errorMessage}).`);
          setVisoes([]);
      } finally {
          setVisoesLoading(false);
      }

      if (currentWarnings.length > 0) {
          setWarning(currentWarnings.join(' '));
      }
    };

    if (activePage === 'dashboard') {
        fetchDropdownData();
    }
  }, [activePage, selectedClient]); // Re-fetch if selectedClient changes
  
  // Fetch Template Configurations (Cards and Line Styles) when selectedVisao changes
  useEffect(() => {
    const fetchTemplateConfig = async () => {
        if (!selectedVisao) {
            setCardConfigs([]);
            setLineStyles(new Map());
            return;
        }
        
        try {
            // 1. Find the Client ID associated with the selected View
            const visao = visoes.find(v => v.id === selectedVisao);
            if (!visao || !visao.cliente_id) {
                 setCardConfigs([]);
                 setLineStyles(new Map());
                 return;
            }

            // 2. Find the ACTIVE template for this client
            const { data: template, error: templateError } = await supabase
                .from('dre_template')
                .select('id')
                .eq('cliente_id', visao.cliente_id)
                .eq('dre_ativo_sn', 'S')
                .limit(1)
                .single();
            
            if (templateError || !template) {
                console.warn("Nenhum template ativo encontrado para o cliente desta visão.");
                setCardConfigs([]);
                setLineStyles(new Map());
                return;
            }

            // 3. Fetch the card configurations
            const { data: cards, error: cardsError } = await supabase
                .from('dre_template_card')
                .select('*')
                .eq('dre_template_id', template.id);
            
            if (cardsError) {
                console.error("Erro ao buscar configurações dos cards:", cardsError);
                setCardConfigs([]);
            } else {
                setCardConfigs(cards || []);
            }

            // 4. Fetch Line Styles (joined with tab_estilo_linha)
            const { data: lines, error: linesError } = await supabase
                .from('dre_template_linhas')
                .select(`
                    dre_linha_seq,
                    tab_estilo_linha (
                        est_tipg_tela,
                        est_nivel_ident
                    )
                `)
                .eq('dre_template_id', template.id);

            if (linesError) {
                console.error("Erro ao buscar estilos das linhas:", linesError);
                setLineStyles(new Map());
            } else if (lines) {
                const styleMap = new Map<number, LineStyle>();
                lines.forEach((line: any) => {
                     const estilo = line.tab_estilo_linha;
                     if (estilo) {
                         styleMap.set(line.dre_linha_seq, {
                             seq: line.dre_linha_seq,
                             tipografia: estilo.est_tipg_tela,
                             indentacao: estilo.est_nivel_ident || 0
                         });
                     }
                });
                setLineStyles(styleMap);
            }

        } catch (err) {
            console.error("Erro no fluxo de busca de configuração do template:", err);
            setCardConfigs([]);
            setLineStyles(new Map());
        }
    };

    fetchTemplateConfig();
  }, [selectedVisao, visoes]);


  // Fetch Raw DRE data when filters change
  useEffect(() => {
    const fetchRawData = async () => {
        if (activePage !== 'dashboard' || !selectedVisao || !selectedPeriod) {
            setRawDreData([]);
            setDreData([]);
            return;
        }

        setLoading(true);
        setError(null);
        setWarning(null);

        try {
            const url = `https://webhook.moondog-ia.tech/webhook/dre?carga=${selectedPeriod}&id=${selectedVisao}`;
            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro na API: ${response.status} - ${errorText || response.statusText}`);
            }

            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error("A resposta da API não é um formato válido (array).");
            }
            setRawDreData(data);
            
            if (data.length === 0) {
                setWarning("Nenhum dado encontrado para os filtros selecionados.")
            }

        } catch (err: any) {
            console.error("Failed to fetch DRE data from webhook:", err);
            setError(`Falha ao carregar dados do DRE: ${err.message}. Verifique o endpoint da API.`);
            setRawDreData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchRawData();
  }, [activePage, selectedVisao, selectedPeriod]);

  // Process Raw Data into Display Data (Formatted) when Raw Data or Styles change
  useEffect(() => {
    const processDisplayData = async () => {
        if (rawDreData.length === 0) {
            setDreData([]);
            return;
        }
        
        // Fetch visibility restrictions (can be cached or fetched once, but doing here for simplicity/safety)
        const { data: restrictedLines, error: restError } = await supabase
            .from('dre_template_linhas')
            .select('id, visao_id')
            .not('visao_id', 'is', null);

        const restrictionMap = new Map<number | string, string>();
        if (restrictedLines) {
            restrictedLines.forEach((r: any) => restrictionMap.set(r.id, r.visao_id));
        }

        const visibleData = rawDreData.filter((row: any) => {
            const isVisible = row.dre_linha_visivel === 'S';
            const requiredVisaoId = row.visao_id || restrictionMap.get(row.id);
            const matchesVisao = !requiredVisaoId || String(requiredVisaoId) === String(selectedVisao);
            return isVisible && matchesVisao;
        });

        const formattedData: DreDataRow[] = visibleData.map((row: any) => {
            const seq = row.dre_linha_seq;
            // Get database styles as a fallback
            const dbStyle = lineStyles.get(seq);
            
            // Prioritize API data for styling if available
            const apiIndent = row.est_nivel_ident !== undefined && row.est_nivel_ident !== null ? Number(row.est_nivel_ident) : null;
            const apiTypography = row.est_tipg_tela;

            let isBold = false;
            let isItalic = false;
            let indentationLevel = 0;

            if (apiTypography) {
                 isBold = apiTypography === 'NEGRITO' || apiTypography === 'NEGR/ITAL';
                 isItalic = apiTypography === 'ITALICO' || apiTypography === 'NEGR/ITAL';
            } else {
                 isBold = dbStyle?.tipografia === 'NEGRITO' || dbStyle?.tipografia === 'NEGR/ITAL';
                 isItalic = dbStyle?.tipografia === 'ITALICO' || dbStyle?.tipografia === 'NEGR/ITAL';
            }

            if (apiIndent !== null) {
                indentationLevel = apiIndent;
            } else {
                indentationLevel = dbStyle?.indentacao || 0;
            }

            return {
                seq: seq, 
                desc: row.dre_linha_descri,
                jan: row.conta_janeiro,
                fev: row.conta_fevereiro,
                mar: row.conta_marco,
                abr: row.conta_abril,
                mai: row.conta_maio,
                jun: row.conta_junho,
                jul: row.conta_julho,
                ago: row.conta_agosto,
                set: row.conta_setembro,
                out: row.conta_outubro,
                nov: row.conta_novembro,
                dez: row.conta_dezembro,
                accumulated: row.conta_acumulado,
                percentage: row.conta_perc,
                isBold,
                isItalic,
                indentationLevel
            };
        