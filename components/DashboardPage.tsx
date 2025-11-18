import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
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
}
interface DreDataRow {
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
    isBold: boolean;
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
      { id: 'grupo-empresarial', label: 'Grupo Empresarial', icon: () => <></> },
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
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isSidebarOpen, setIsSidebarOpen, activePage, setActivePage, isCollapsed, onToggleCollapse }) => {
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
          <div className={`flex items-center p-2 rounded-lg ${isCollapsed ? 'justify-center' : ''}`}>
            <UserIcon />
            {!isCollapsed && (
              <div className="ml-3">
                <p className="text-sm font-semibold">Admin</p>
                <p className="text-xs text-gray-400">admin@sancal.com</p>
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
        <p className="text-sm font-medium text-gray-400">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="mt-2">
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        <p className="text-sm text-gray-400">{percentage}</p>
      </div>
      <div className={`text-xs font-semibold text-right mt-2 ${variationColor}`}>
        {isPositive ? '▲' : '▼'} {Math.abs(variation)}%
      </div>
    </div>
  );
};

// DreTable Component
interface DreTableProps {
    data: DreDataRow[];
}
const DreTable: React.FC<DreTableProps> = ({ data }) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const formatNumber = (value: number) => {
        if (value === 0) {
            return '-';
        }
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatPercentage = (value: number) => {
        if (value === 0) {
            return '-';
        }
        return `${value.toFixed(2)}%`;
    };

    return (
        <div className="overflow-x-auto bg-gray-800 border border-gray-700 rounded-lg shadow-md">
            <table className="min-w-full text-sm divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Descrição</th>
                        {months.map(month => (
                            <th key={month} className="px-3 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">{month}</th>
                        ))}
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Acumulado</th>
                        <th className="px-3 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">%</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map((row, index) => {
                        const values = months.map(m => row[m.toLowerCase() as keyof DreDataRow] as number || 0);
                        const accumulated = row.accumulated || 0;
                        const percentage = row.percentage || 0;
                        return (
                            <tr key={index} className="hover:bg-gray-700/50">
                                <td className={`px-3 py-2 whitespace-nowrap text-gray-300 ${row.isBold ? 'font-bold text-white' : ''}`}>{row.desc}</td>
                                {values.map((val, i) => (
                                    <td key={i} className={`px-3 py-2 text-right whitespace-nowrap ${val < 0 ? 'text-red-500' : 'text-gray-200'}`}>{formatNumber(val)}</td>
                                ))}
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
interface DashboardPageProps {
  onLogout: () => void;
}
const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [dreData, setDreData] = useState<DreDataRow[]>([]);
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
          const { data, error: visaoError } = await supabase
            .from('dre_visao')
            .select('id, vis_nome, vis_descri')
            .order('vis_nome');
          if (visaoError) throw visaoError;
          if (data && data.length > 0) {
              setVisoes(data);
              setSelectedVisao(data[0].id);
          } else {
              currentWarnings.push('Nenhuma visão foi encontrada na base de dados.');
              setVisoes([]);
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
  }, [activePage]);

  // Fetch DRE data when filters change
  useEffect(() => {
    const fetchDreData = async () => {
        if (activePage !== 'dashboard' || !selectedVisao || !selectedPeriod) {
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

            const visibleData = data.filter((row: any) => row.dre_linha_visivel === 'S');

            const boldRows = [
                'RECEITA OPERACIONAL BRUTA',
                '(-)DEDUÇÕES RECEITA OPERACIONAL BRUTA',
                'RECEITA OPERACIONAL LÍQUIDA',
                'CUSTO MERCADORIAS VENDIDOS',
                'LUCRO/PREJUÍZO OPERACIONAL BRUTO',
                'DESPESAS COM RECURSOS HUMANOS',
                'DESPESAS COMERCIAIS EM GERAL',
                'RESULTADO ANTES DO IRPJ /CSLL',
                'LUCRO LÍQUIDO MENSAL APÓS IRPJ / CSLL / SIMPLES',
                'EBIT',
                'EBITDA'
            ];
            const formattedData: DreDataRow[] = visibleData.map((row: any) => ({
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
                isBold: boldRows.includes(row.dre_linha_descri?.toUpperCase())
            }));
            
            setDreData(formattedData);
            if (formattedData.length === 0) {
                setWarning("Nenhum dado encontrado para os filtros selecionados.")
            } else {
                setWarning(null);
            }

        } catch (err: any) {
            console.error("Failed to fetch DRE data from webhook:", err);
            setError(`Falha ao carregar dados do DRE: ${err.message}. Verifique o endpoint da API.`);
            setDreData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchDreData();
  }, [activePage, selectedVisao, selectedPeriod]);

  
  const pageTitles: { [key: string]: string } = {
    dashboard: 'Dashboard',
    visao: 'Gestão de Visões',
    cliente: 'Gestão de Clientes',
    'grupo-empresarial': 'Gestão de Grupos Empresariais',
    empresa: 'Gestão de Empresas',
    'plano-contabil': 'Gestão de Plano Contábil',
    templates: 'Gestão de Templates',
    situacao: 'Configurações - Situação',
    'tipo-linha': 'Configurações - Tipo Linha DRE',
    'estilo-linha': 'Configurações - Estilo Linha DRE',
    'tipo-visao': 'Configurações - Tipo Visão DRE',
    usuarios: 'Administração - Usuários',
    permissoes: 'Administração - Permissões',
  };

  // --- Helper to generate standardized filenames ---
  const getExportFileName = (extension: string) => {
    const visao = visoes.find(v => v.id === selectedVisao);
    // Removes spaces from vision name as per example (20BARRA9 POA -> 20BARRA9POA)
    const visaoNome = visao ? visao.vis_nome.replace(/\s+/g, '') : 'DRE';
    return `${visaoNome}_${selectedPeriod}.${extension}`;
  }

  // --- Export Handlers ---
  const handleExportCsv = () => {
    if (dreData.length === 0) return;

    const fileName = getExportFileName('csv');
    // Use semicolon for Excel compatibility in regions using comma as decimal separator (like Brazil)
    const separator = ';';
    const headers = ["Descrição", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Acumulado", "%"];
    
    // Helper to format values for CSV
    const formatValue = (val: any) => {
        if (typeof val === 'number') {
            // Force decimal comma and thousand separator dot, encapsulated in quotes
            return `"${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`;
        }
        if (typeof val === 'string') {
            // Escape double quotes by doubling them
            return `"${val.replace(/"/g, '""')}"`;
        }
        return '""';
    };

    // Construct rows
    const csvRows = [headers.map(h => `"${h}"`).join(separator)];
    
    dreData.forEach(row => {
        const values = [
            formatValue(row.desc),
            formatValue(row.jan),
            formatValue(row.fev),
            formatValue(row.mar),
            formatValue(row.abr),
            formatValue(row.mai),
            formatValue(row.jun),
            formatValue(row.jul),
            formatValue(row.ago),
            formatValue(row.set),
            formatValue(row.out),
            formatValue(row.nov),
            formatValue(row.dez),
            formatValue(row.accumulated),
            formatValue(row.percentage)
        ];
        csvRows.push(values.join(separator));
    });

    const csvString = "\uFEFF" + csvRows.join("\n"); // UTF-8 BOM to support accents in Excel
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    // Create temp link to download
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportXlsx = () => {
     if (dreData.length === 0) return;

     const fileName = getExportFileName('xlsx');
     
     const headers = ["Descrição", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Acumulado", "%"];
     
     // Format number helper for XLSX cells
     const formatNumber = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

     // Map data for SheetJS with formatted strings to match CSV look
     const dataForSheet = dreData.map(row => [
        row.desc,
        formatNumber(row.jan), 
        formatNumber(row.fev), 
        formatNumber(row.mar), 
        formatNumber(row.abr), 
        formatNumber(row.mai), 
        formatNumber(row.jun), 
        formatNumber(row.jul), 
        formatNumber(row.ago), 
        formatNumber(row.set), 
        formatNumber(row.out), 
        formatNumber(row.nov), 
        formatNumber(row.dez), 
        formatNumber(row.accumulated), 
        formatNumber(row.percentage)
     ]);
     
     // Add header row
     dataForSheet.unshift(headers as any);

     const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "DRE");
     
     XLSX.writeFile(wb, fileName);
  };


  return (
    <div className="flex h-screen bg-gray-900 text-gray-300">
      <Sidebar 
        onLogout={onLogout} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
      />
      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        <header className="flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700 lg:justify-end sticky top-0 z-20">
            <button className="text-gray-300 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
                <MenuIcon />
            </button>
            <h1 className="text-lg font-semibold text-white">{pageTitles[activePage] || 'Dashboard'}</h1>
        </header>

        <main className="p-4">
          {activePage === 'dashboard' && (
            <div>
              {/* Sticky container for cards and filters */}
              <div className="sticky top-16 z-10 bg-gray-900 -mx-4 px-4 py-4 mb-4">
                  {(error || warning) && (
                    <div className={`p-3 mb-4 text-sm rounded-lg ${error ? 'text-red-400 bg-red-900/50 border border-red-800' : 'text-yellow-400 bg-yellow-900/50 border border-yellow-800'}`}>
                        {error || warning}
                    </div>
                  )}
                  {/* Stat Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Receita Líquida" subtitle="Mês Atual" value="R$ 1.5M" percentage="85% da meta" variation={5.2} />
                    <StatCard title="Lucro Bruto" subtitle="Mês Atual" value="R$ 800K" percentage="53.3% da receita" variation={3.1} />
                    <StatCard title="EBITDA" subtitle="Mês Atual" value="R$ 450K" percentage="30% da receita" variation={-1.8} />
                    <StatCard title="Lucro Líquido" subtitle="Mês Atual" value="R$ 350K" percentage="23.3% da receita" variation={-1.8} />
                  </div>

                  {/* Filters and Title */}
                  <div className="p-4 mt-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md">
                    <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                      <h2 className="text-lg font-bold text-white">DRE VISÃO CONSOLIDADA</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <select 
                          value={selectedPeriod}
                          onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                          disabled={periodsLoading || periods.length === 0}
                          className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          {periodsLoading ? (
                            <option>Carregando...</option>
                          ) : periods.length > 0 ? (
                            periods.map(p => <option key={p.retorno} value={p.retorno}>{p.display}</option>)
                          ) : (
                            <option>Sem períodos</option>
                          )}
                        </select>
                        <select
                          value={selectedVisao}
                          onChange={(e) => setSelectedVisao(e.target.value)}
                          disabled={visoesLoading || visoes.length === 0}
                          className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          {visoesLoading ? (
                            <option>Carregando...</option>
                          ) : visoes.length > 0 ? (
                            visoes.map(v => (
                              <option key={v.id} value={v.id} title={v.vis_descri || v.vis_nome}>
                                {v.vis_nome}
                              </option>
                            ))
                          ) : (
                            <option>Nenhuma visão</option>
                          )}
                        </select>
                        <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                          <PdfIcon /> PDF
                        </button>
                        <button 
                            onClick={handleExportCsv}
                            disabled={dreData.length === 0}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CsvIcon /> CSV
                        </button>
                        <button 
                            onClick={handleExportXlsx}
                            disabled={dreData.length === 0}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XlsxIcon /> XLSX
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
              
              {/* Data Table */}
              <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 min-h-[200px] flex items-center justify-center">
                {loading ? (
                    <div className="flex items-center justify-center"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando dados...</span></div>
                ) : dreData.length > 0 ? (
                    <DreTable data={dreData} />
                ) : (
                    <div className="text-center text-gray-400">
                        {(!selectedPeriod || !selectedVisao) ? "Selecione os filtros para visualizar os dados." : "Nenhum dado para exibir."}
                    </div>
                )}
              </div>
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
          {(activePage === 'usuarios' || activePage === 'permissoes') && (
             <div className="flex items-center justify-center h-full p-8 text-center bg-gray-800 border border-gray-700 rounded-lg">
                <div>
                    <h2 className="text-xl font-bold text-white">Em Desenvolvimento</h2>
                    <p className="mt-2 text-gray-400">Esta funcionalidade estará disponível em breve.</p>
                </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;