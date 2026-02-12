import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../shared/Modal';
import { useAuth } from '../../contexts/AuthContext';

// Type definitions
interface Cliente {
  id: string;
  cli_nome: string | null;
}
interface Visao {
  id: string;
  vis_nome: string | null;
  vis_descri: string | null;
  vis_ativo_sn: string;
  cliente_id: string | null;
  dre_cliente: { cli_nome: string | null } | null;
  tab_tipo_visao: { tpvis_nome: string | null } | null;
  rel_visao_empresa: { empresa_id: string }[];
}

interface VisaoListPageProps {
  onEditVisao: (id: string) => void;
  onAddNew: () => void;
}

// Icons
const ListIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
);
const CardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
);
const CompanyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
);


const VisaoListPage: React.FC<VisaoListPageProps> = ({ onEditVisao, onAddNew }) => {
  const { user, selectedClient } = useAuth();
  
  const [visoes, setVisoes] = useState<Visao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [visaoForAction, setVisaoForAction] = useState<Visao | null>(null);

  const [filtroNome, setFiltroNome] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');

  const fetchData = useCallback(async () => {
    if (!user || !selectedClient) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch User Permissions specifically for the Selected Client
      const { data: relData, error: relError } = await supabase
        .from('rel_prof_cli_empr')
        .select('empresa_id')
        .eq('profile_id', user.id)
        .eq('cliente_id', selectedClient.id) // Filter permissions by selected client
        .eq('rel_situacao_id', 'ATV');

      if (relError) throw relError;

      let hasFullAccess = false;
      const allowedCompanyIds = new Set<string>();

      if (relData) {
          relData.forEach((r: any) => {
              if (r.empresa_id === null) {
                  hasFullAccess = true;
              } else {
                  allowedCompanyIds.add(r.empresa_id);
              }
          });
      }

      // If no access found for this specific client (should imply an app logic error if selectedClient is valid), assume no access
      if (!hasFullAccess && allowedCompanyIds.size === 0) {
          setVisoes([]);
          setLoading(false);
          return;
      }

      // 2. Fetch Visions for the Selected Client ONLY
      let query = supabase
        .from('dre_visao')
        .select(`
          id, 
          vis_nome,
          vis_descri,
          vis_ativo_sn,
          cliente_id,
          dre_cliente ( cli_nome ),
          tab_tipo_visao ( tpvis_nome ),
          rel_visao_empresa ( empresa_id )
        `)
        .eq('cliente_id', selectedClient.id); // Strict filtering by client context
      
      if (filtroNome) {
        query = query.ilike('vis_nome', `%${filtroNome}%`);
      }
      query = query.order('vis_nome', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // 3. Apply Strict Subset Logic for Visibility
      const rawVisoes = (data as unknown as Visao[]) || [];
      
      const filteredVisoes = rawVisoes.filter(visao => {
          // Double check: should match selected client (query already does this, but being safe)
          if (visao.cliente_id !== selectedClient.id) return false;

          // Rule 1: Full Access to Client -> Show Everything for this client
          if (hasFullAccess) {
              return true;
          }

          // Rule 2: Partial Access -> Show only visions where user has access to ALL companies in the vision
          const visionCompanies = visao.rel_visao_empresa || [];
          
          if (visionCompanies.length === 0) {
              // Empty vision: Visible (contains nothing forbidden)
              return true;
          }

          // Check if any company in the vision is NOT in the user's allowed list
          const hasForbiddenCompany = visionCompanies.some(r => !allowedCompanyIds.has(r.empresa_id));
          
          // Show only if NO forbidden companies are found
          return !hasForbiddenCompany;
      });

      setVisoes(filteredVisoes);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filtroNome, user, selectedClient]);

  useEffect(() => {
    const handler = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(handler);
  }, [fetchData]);

  const openDeleteModal = (visao: Visao) => {
    setVisaoForAction(visao);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setVisaoForAction(null);
  };

  const handleDelete = async () => {
    if (!visaoForAction) return;
    setLoading(true);
    try {
      await supabase.from('rel_visao_empresa').delete().eq('visao_id', visaoForAction.id);
      await supabase.from('dre_visao_grupo_cnpj').delete().eq('visao_id', visaoForAction.id);
      const { error: visaoError } = await supabase.from('dre_visao').delete().eq('id', visaoForAction.id);
      if (visaoError) throw visaoError;
      
      closeDeleteModal();
      fetchData();
    } catch (err: any) {
      setError(`Falha ao excluir visão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const VisaoCard: React.FC<{ visao: Visao }> = ({ visao }) => {
    const companyCount = visao.rel_visao_empresa?.length || 0;
    
    return (
        <div className="flex flex-col justify-between p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-lg hover:border-indigo-500 transition-all duration-200 h-full">
            <div className="flex-grow">
                <div className="flex items-start justify-between">
                    <h3 className="mb-1 text-lg font-bold text-white pr-2">{visao.vis_nome}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${visao.vis_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                        {visao.vis_ativo_sn === 'S' ? 'Ativa' : 'Inativa'}
                    </span>
                </div>
                <p className="mb-3 text-sm text-gray-400 truncate" title={visao.vis_descri || ''}>
                    {visao.vis_descri || 'Sem descrição.'}
                </p>
                <div className="space-y-1 text-sm">
                    <p className="text-gray-400">
                        <span className="font-semibold text-gray-300">Cliente:</span> {visao.dre_cliente?.cli_nome || 'N/A'}
                    </p>
                    <p className="text-gray-400">
                        <span className="font-semibold text-gray-300">Tipo:</span> {visao.tab_tipo_visao?.tpvis_nome || 'N/A'}
                    </p>
                </div>
            </div>
            <div className="flex items-center justify-between pt-3 mt-3 space-x-4 border-t border-gray-700">
                <div className="flex items-center text-sm text-gray-400">
                    <CompanyIcon />
                    <span>{companyCount} {companyCount === 1 ? 'empresa' : 'empresas'}</span>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={() => onEditVisao(visao.id)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                        <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(visao)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
                        <i className="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    );
  };


  const renderContent = () => {
    if (loading && visoes.length === 0) {
      return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (visoes.length === 0) {
      return (
        <div className="p-6 text-center bg-gray-800/50">
          <h2 className="text-lg font-bold text-white">Nenhuma Visão Encontrada</h2>
          <p className="mt-1 text-gray-400">
            {filtroNome ? "Tente ajustar seus filtros." : "Clique em 'Adicionar Visão' para começar."}
          </p>
        </div>
      );
    }

    if (viewMode === 'card') {
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visoes.map(visao => <VisaoCard key={visao.id} visao={visao} />)}
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome da Visão</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Tipo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Cliente</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">Ativa</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {visoes.map(visao => (
              <tr key={visao.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{visao.vis_nome}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{visao.tab_tipo_visao?.tpvis_nome || 'N/A'}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{visao.dre_cliente?.cli_nome || 'N/A'}</td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${visao.vis_ativo_sn === 'S' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                    {visao.vis_ativo_sn === 'S' ? 'Sim' : 'Não'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => onEditVisao(visao.id)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(visao)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Visões Cadastradas ({selectedClient?.cli_nome})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={filtroNome}
            onChange={e => setFiltroNome(e.target.value.toUpperCase())}
            className="w-full md:w-auto px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm"
          />
          <button onClick={onAddNew} className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            Adicionar Visão
          </button>
        </div>
      </div>

       <div className="flex items-center justify-end">
            <div className="inline-flex p-1 bg-gray-700 rounded-md">
                <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                >
                    <ListIcon />
                </button>
                <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${viewMode === 'card' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                >
                    <CardIcon />
                </button>
            </div>
        </div>
      
      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}

      {renderContent()}

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir a visão "{visaoForAction?.vis_nome}"? Todas as suas associações com empresas também serão removidas.</p>
        <div className="flex justify-end pt-6 space-x-2">
          <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default VisaoListPage;