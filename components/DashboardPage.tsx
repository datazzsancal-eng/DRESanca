

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

// Type definition for period
interface Periodo {
  retorno: number;
  display: string;
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
const SettingsIcon = () => <Icon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
const AdminIcon = () => <Icon path="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />;
const ChevronDownIcon = () => <Icon path="M19 9l-7 7-7-7" className="h-4 w-4" />;
const ChevronUpIcon = () => <Icon path="M5 15l7-7 7 7" className="h-4 w-4" />;
const LogoutIcon = () => <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />;
const UserIcon = () => <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="h-8 w-8 text-gray-400"/>;
const PdfIcon = () => <Icon path="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-5 w-5 mr-1" />;
const CsvIcon = () => <Icon path="M4 6h16M4 10h16M4 14h16M4 18h16" className="h-5 w-5 mr-1" />;
const MenuIcon = () => <Icon path="M4 6h16M4 12h16M4 18h16" />;
const CloseIcon = () => <Icon path="M6 18L18 6M6 6l12 12" />;
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
  { id: 'visao', label: 'Visão', icon: VisionIcon },
  {
    id: 'estrutura',
    label: 'Estrutura',
    icon: StructureIcon,
    children: [
      { id: 'cliente', label: 'Cliente', icon: () => <></> },
      { id: 'grupo-empresarial', label: 'Grupo Empresarial', icon: () => <></> },
      { id: 'empresa', label: 'Empresa', icon: () => <></> },
      { id: 'plano-contabil', label: 'Plano Contábil', icon: () => <></> },
      { id: 'templates', label: 'Templates', icon: () => <></> },
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
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isSidebarOpen, setIsSidebarOpen, activePage, setActivePage }) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    estrutura: true,
    configuracoes: false,
    administracao: false,
  });

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getNavItemClasses = (page: string) => 
    `flex items-center w-full px-4 py-2.5 text-sm font-medium text-left rounded-lg transition-colors duration-200 ${
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
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-gray-800 text-white transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 transition-transform duration-300 ease-in-out`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <SancalLogo />
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navigationData.map((item) => {
            if (item.children) {
              const isOpen = openMenus[item.id];
              return (
                <div key={item.id}>
                  <button onClick={() => toggleMenu(item.id)} className={`${getNavItemClasses(item.id + '-parent')} w-full justify-between`}>
                    <div className="flex items-center">
                      <item.icon />
                      <span className="ml-3">{item.label}</span>
                    </div>
                    {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
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
              <button key={item.id} onClick={() => setActivePage(item.id)} className={getNavItemClasses(item.id)}>
                <item.icon />
                <span className="ml-3">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center mb-4">
            <UserIcon />
            <div className="ml-3">
              <p className="text-sm font-semibold">Admin</p>
              <p className="text-xs text-gray-400">admin@sancal.com</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-red-600 hover:text-white transition-colors duration-200">
            <LogoutIcon /> <span className="ml-2">Logout</span>
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
    data: any[];
}
const DreTable: React.FC<DreTableProps> = ({ data }) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const receitaLiquidaRow = data.find(row => row.desc === 'Receita Líquida');
    const receitaLiquidaValues = receitaLiquidaRow ? months.map(m => receitaLiquidaRow[m.toLowerCase()] || 0) : [];
    const totalReceitaLiquida = receitaLiquidaValues.reduce((a, b) => a + b, 0);


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
                        const values = months.map(m => row[m.toLowerCase()] || 0);
                        const accumulated = values.reduce((a, b) => a + b, 0);
                        const percentage = totalReceitaLiquida !== 0 ? (accumulated / totalReceitaLiquida * 100).toFixed(2) : '0.00';
                        return (
                            <tr key={index} className="hover:bg-gray-700/50">
                                <td className={`px-3 py-2 whitespace-nowrap text-gray-300 ${row.isBold ? 'font-bold text-white' : ''}`}>{row.desc}</td>
                                {values.map((val, i) => (
                                    <td key={i} className={`px-3 py-2 text-right whitespace-nowrap ${val < 0 ? 'text-red-500' : 'text-gray-200'}`}>{val.toLocaleString('pt-BR')}</td>
                                ))}
                                <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${accumulated < 0 ? 'text-red-500' : 'text-white'}`}>{accumulated.toLocaleString('pt-BR')}</td>
                                <td className={`px-3 py-2 text-right whitespace-nowrap font-medium text-gray-400`}>{percentage}%</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// Mock data for DRE Table to avoid Supabase errors on a non-existent table
const mockDreData = [
  { desc: 'Receita Líquida', jan: 1500000, fev: 1600000, mar: 1550000, abr: 1700000, mai: 1800000, jun: 1750000, jul: 1850000, ago: 1900000, set: 1950000, out: 2000000, nov: 2100000, dez: 2200000, isBold: true },
  { desc: 'Custos', jan: -700000, fev: -750000, mar: -720000, abr: -800000, mai: -850000, jun: -820000, jul: -880000, ago: -900000, set: -920000, out: -950000, nov: -1000000, dez: -1050000, isBold: false },
  { desc: 'Lucro Bruto', jan: 800000, fev: 850000, mar: 830000, abr: 900000, mai: 950000, jun: 930000, jul: 970000, ago: 1000000, set: 1030000, out: 1050000, nov: 1100000, dez: 1150000, isBold: true },
  { desc: 'Despesas Operacionais', jan: -300000, fev: -310000, mar: -305000, abr: -320000, mai: -330000, jun: -325000, jul: -340000, ago: -350000, set: -360000, out: -370000, nov: -380000, dez: -400000, isBold: false },
  { desc: 'EBITDA', jan: 500000, fev: 540000, mar: 525000, abr: 580000, mai: 620000, jun: 605000, jul: 630000, ago: 650000, set: 670000, out: 680000, nov: 720000, dez: 750000, isBold: true },
  { desc: 'Resultado Líquido', jan: 350000, fev: 380000, mar: 370000, abr: 410000, mai: 440000, jun: 430000, jul: 450000, ago: 460000, set: 480000, out: 490000, nov: 520000, dez: 550000, isBold: true },
];


// Main DashboardPage component
interface DashboardPageProps {
  onLogout: () => void;
}
const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [dreData, setDreData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  
  // State for periods dropdown
  const [periods, setPeriods] = useState<Periodo[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | ''>('');
  const [periodsLoading, setPeriodsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // DRE data (mocked)
      setLoading(true);
      setError(null);
      setWarning(null);
      setDreData(mockDreData); 
      setLoading(false);

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
          setSelectedPeriod(data[0].retorno);
        } else {
            throw new Error("Nenhum período foi encontrado na base de dados.");
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Verifique a conexão ou as permissões da view.';
        console.error("Failed to fetch periods:", err);
        // Fallback to mock data on error
        const mockPeriods: Periodo[] = [
            { retorno: 202408, display: 'AGO/24' },
            { retorno: 202407, display: 'JUL/24' },
            { retorno: 202406, display: 'JUN/24' },
            { retorno: 202405, display: 'MAI/24' },
            { retorno: 202404, display: 'ABR/24' },
        ];
        setPeriods(mockPeriods);
        if (mockPeriods.length > 0) {
            setSelectedPeriod(mockPeriods[0].retorno);
        }
        setWarning(`Atenção: Não foi possível carregar os períodos (${errorMessage}). Usando dados de exemplo.`);
      } finally {
        setPeriodsLoading(false);
      }
    };
    
    if (activePage === 'dashboard') {
      fetchData();
    }
  }, [activePage]);
  
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


  return (
    <div className="flex h-screen bg-gray-900 text-gray-300">
      <Sidebar 
        onLogout={onLogout} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />
      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        <header className="flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700 lg:justify-end">
            <button className="text-gray-300 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
                <MenuIcon />
            </button>
            <h1 className="text-lg font-semibold text-white">{pageTitles[activePage] || 'Dashboard'}</h1>
        </header>

        <main className="p-4 space-y-4">
          {activePage === 'dashboard' && (
            <>
              {warning && <div className="p-3 text-sm text-yellow-400 bg-yellow-900/50 border border-yellow-800 rounded-lg">{warning}</div>}
              {/* Stat Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Receita Líquida" subtitle="Mês Atual" value="R$ 1.5M" percentage="85% da meta" variation={5.2} />
                <StatCard title="Lucro Bruto" subtitle="Mês Atual" value="R$ 800K" percentage="53.3% da receita" variation={3.1} />
                <StatCard title="EBITDA" subtitle="Mês Atual" value="R$ 450K" percentage="30% da receita" variation={2.1} />
                <StatCard title="Lucro Líquido" subtitle="Mês Atual" value="R$ 350K" percentage="23.3% da receita" variation={-1.8} />
              </div>

              {/* Filters and Title */}
              <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md">
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
                    <select className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <option>Visão Mensal</option>
                      <option>Visão Anual</option>
                    </select>
                    <select className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <option>MANDABRASA CO</option>
                      <option>MANDABRASA CO REST</option>
                      <option>MAND ABRASA PART</option>
                      <option>CARNE E BRASA</option>
                    </select>
                    <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <PdfIcon /> PDF
                    </button>
                    <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <CsvIcon /> CSV
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Data Table */}
              <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 min-h-[200px] flex items-center justify-center">
                {loading ? (
                  <p className="text-gray-400">Carregando dados...</p>
                ) : error ? (
                  <p className="text-red-500">{error}</p>
                ) : (
                  <DreTable data={dreData} />
                )}
              </div>
            </>
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