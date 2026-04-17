

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import Modal from '../shared/Modal';
import Shuttle from '../shared/Shuttle';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Type definitions
interface UserProfile {
  id: string;
  created_at: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  function: string | null;
}

interface Cliente {
  id: string;
  cli_nome: string | null;
}

interface Empresa {
  id: string;
  emp_nome: string;
  emp_nome_reduz: string | null;
  emp_cnpj_raiz: string | null;
  emp_cnpj: string | null;
}

interface CnpjRaiz {
  cnpj_raiz: string;
  reduz_emp: string | null;
}

// Estrutura para armazenar detalhes cacheados de cada cliente
interface ClientCache {
  empresas: Empresa[];
  cnpjs: CnpjRaiz[];
}

const UsuarioPage: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();
  // State management
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // --- GRANULAR ACCESS CONTROL STATE ---
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [clientCache, setClientCache] = useState<Record<string, ClientCache>>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  // Configuração em memória para o usuário sendo editado
  // Mapa: ClienteID -> Set de IDs (CNPJs ou Empresas)
  const [userConfig, setUserConfig] = useState<{
      selectedRoots: Record<string, Set<string>>;
      selectedCompanies: Record<string, Set<string>>;
  }>({ selectedRoots: {}, selectedCompanies: {} });

  // Loading state específico para detalhes do cliente
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form State
  const initialFormState = {
    email: '',
    password: '',
    confirmPassword: '',
    currentPassword: '',
    username: '',
    full_name: '',
    function: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Filter state
  const [filtroNome, setFiltroNome] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch Profiles
      let query = supabase.from('profiles').select('*');
      if (filtroNome) {
        query = query.or(`full_name.ilike.%${filtroNome}%,username.ilike.%${filtroNome}%`);
      }
      query = query.order('full_name', { ascending: true });

      // Fetch Clientes for Shuttle
      const clientesQuery = supabase.from('dre_cliente').select('id, cli_nome').order('cli_nome');

      const [profilesRes, clientesRes] = await Promise.all([query, clientesQuery]);

      if (profilesRes.error) throw profilesRes.error;
      if (clientesRes.error) throw clientesRes.error;

      setUsuarios(profilesRes.data || []);
      setClientes(clientesRes.data || []);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filtroNome]);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchData();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchData]);

  // --- Helper to fetch client details (Companies & Roots) ---
  const fetchClientDetails = async (clienteId: string) => {
      if (clientCache[clienteId]) return clientCache[clienteId];

      const [empRes, cnpjRes] = await Promise.all([
          supabase.from('dre_empresa').select('id, emp_nome, emp_nome_reduz, emp_cnpj_raiz, emp_cnpj').eq('cliente_id', clienteId),
          supabase.from('viw_cnpj_raiz').select('cnpj_raiz, reduz_emp').eq('cliente_id', clienteId)
      ]);

      if (empRes.error) throw empRes.error;
      if (cnpjRes.error) throw cnpjRes.error;

      const details = {
          empresas: empRes.data || [],
          cnpjs: cnpjRes.data || []
      };

      setClientCache(prev => ({ ...prev, [clienteId]: details }));
      return details;
  };

  // Modal handlers
  const openModal = async (user: UserProfile | null = null) => {
    setSelectedUser(user);
    setError(null);
    setSuccessMsg(null);
    setSelectedClientIds(new Set());
    setUserConfig({ selectedRoots: {}, selectedCompanies: {} });
    setActiveTab(null);

    if (user) {
        // Edit mode
        setFormData({
            ...initialFormState,
            email: user.username || '',
            username: user.username || '',
            full_name: user.full_name || '',
            function: user.function || ''
        });

        setLoadingDetails(true);
        try {
            // Buscar relacionamentos existentes
            const { data: relations, error: relError } = await supabase
                .from('rel_prof_cli_empr')
                .select('cliente_id, empresa_id')
                .eq('profile_id', user.id)
                .not('cliente_id', 'is', null);
            
            if (relError) throw relError;

            if (relations && relations.length > 0) {
                const clientIds = new Set<string>();
                const newSelectedCompanies: Record<string, Set<string>> = {};
                const newSelectedRoots: Record<string, Set<string>> = {};

                // 1. Identificar Clientes
                relations.forEach((r: any) => {
                    if (r.cliente_id) clientIds.add(r.cliente_id);
                });

                setSelectedClientIds(clientIds);
                // Define a primeira aba
                if (clientIds.size > 0) setActiveTab(Array.from(clientIds)[0]);

                // 2. Carregar detalhes e popular configs
                await Promise.all(Array.from(clientIds).map(async (cliId) => {
                    const details = await fetchClientDetails(cliId);
                    
                    // Popular Empresas Selecionadas
                    const userEmpresas: Set<string> = new Set(
                        (relations as any[])
                            .filter((r: any) => r.cliente_id === cliId && r.empresa_id)
                            .map((r: any) => r.empresa_id as string)
                    );
                    newSelectedCompanies[cliId] = userEmpresas;

                    // Popular Raízes Selecionadas
                    const activeRoots: Set<string> = new Set();
                    
                    details.cnpjs.forEach(root => {
                        // Verifica se alguma empresa desta raiz está selecionada
                        const hasEmpresa = details.empresas.some(e => 
                            e.emp_cnpj_raiz === root.cnpj_raiz && userEmpresas.has(e.id)
                        );
                        if (hasEmpresa) activeRoots.add(root.cnpj_raiz);
                    });
                    
                    // Caso de borda: Se não tem empresas específicas (acesso total legado), marcar tudo
                    const specificEmpresasCount = (relations as any[]).filter((r: any) => r.cliente_id === cliId && r.empresa_id).length;
                    if (specificEmpresasCount === 0 && (relations as any[]).some((r: any) => r.cliente_id === cliId)) {
                         // Legado: seleciona tudo
                         details.cnpjs.forEach(r => activeRoots.add(r.cnpj_raiz));
                         details.empresas.forEach(e => userEmpresas.add(e.id));
                    }

                    newSelectedRoots[cliId] = activeRoots;
                }));

                setUserConfig({
                    selectedCompanies: newSelectedCompanies,
                    selectedRoots: newSelectedRoots
                });
            }
        } catch (e: any) {
            console.error("Error fetching relations", e);
            setError("Erro ao carregar permissões do usuário.");
        } finally {
            setLoadingDetails(false);
        }

    } else {
        // Create mode
        setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setFormData(initialFormState);
    setSelectedClientIds(new Set());
    setUserConfig({ selectedRoots: {}, selectedCompanies: {} });
  };
  
  const openDeleteModal = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedUser(null);
  };

  // CRUD operations
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Handlers for Granular Access ---

  // 1. Change Clients (Top Shuttle)
  const handleClientSelectionChange = async (newClientIds: Set<string>) => {
      setSelectedClientIds(newClientIds);
      
      // Determine added clients to init them
      const addedClients = Array.from(newClientIds).filter(id => !userConfig.selectedRoots[id]);
      
      if (addedClients.length > 0) {
          setLoadingDetails(true);
          const addedRoots: Record<string, Set<string>> = {};
          const addedCompanies: Record<string, Set<string>> = {};

          await Promise.all(addedClients.map(async (cliId) => {
              const details = await fetchClientDetails(cliId);
              
              // Default: Select ALL roots and ALL companies
              addedRoots[cliId] = new Set<string>(details.cnpjs.map((r: any) => r.cnpj_raiz));
              addedCompanies[cliId] = new Set<string>(details.empresas.map((e: any) => e.id));
          }));

          setUserConfig(prev => ({ 
              selectedRoots: { ...prev.selectedRoots, ...addedRoots }, 
              selectedCompanies: { ...prev.selectedCompanies, ...addedCompanies } 
          }));
          setLoadingDetails(false);
      }

      // If active tab was removed, switch to first available
      if (activeTab && !newClientIds.has(activeTab)) {
          const first = Array.from(newClientIds)[0];
          setActiveTab(first || null);
      } else if (!activeTab && newClientIds.size > 0) {
          setActiveTab(Array.from(newClientIds)[0]);
      }
  };

  // 2. Toggle CNPJ Root
  const handleRootToggle = (clienteId: string, cnpjRaiz: string) => {
      setUserConfig(prev => {
          const currentRoots = new Set(prev.selectedRoots[clienteId] || []);
          const currentCompanies = new Set(prev.selectedCompanies[clienteId] || []);
          
          const details = clientCache[clienteId];
          if (!details) return prev;

          const companiesOfRoot = details.empresas.filter(e => e.emp_cnpj_raiz === cnpjRaiz);

          if (currentRoots.has(cnpjRaiz)) {
              // Deselect Root -> Remove associated companies
              currentRoots.delete(cnpjRaiz);
              companiesOfRoot.forEach(c => currentCompanies.delete(c.id));
          } else {
              // Select Root -> Add associated companies (Default behavior: include all)
              currentRoots.add(cnpjRaiz);
              companiesOfRoot.forEach(c => currentCompanies.add(c.id));
          }

          return {
              selectedRoots: { ...prev.selectedRoots, [clienteId]: currentRoots },
              selectedCompanies: { ...prev.selectedCompanies, [clienteId]: currentCompanies }
          };
      });
  };

  // 3. Handle Company Shuttle Change
  const handleCompanySelectionChange = (clienteId: string, newCompanyIds: Set<string>) => {
      setUserConfig(prev => ({
          ...prev,
          selectedCompanies: { ...prev.selectedCompanies, [clienteId]: newCompanyIds }
      }));
  };


  const handleSaveRelations = async (userId: string, userFunction: string) => {
      // 1. Delete existing relations
      // Note: We use the MAIN supabase client here because we are editing relations as admin
      const { error: deleteError } = await supabase
          .from('rel_prof_cli_empr')
          .delete()
          .eq('profile_id', userId);
      
      if (deleteError) throw deleteError;

      // If user is MASTER, they don't need granular relations
      if (userFunction === 'MASTER') {
          return;
      }

      // 2. Build Insert Payload
      const rowsToInsert: any[] = [];

      selectedClientIds.forEach(clienteId => {
          const selectedCompanies = userConfig.selectedCompanies[clienteId];
          const clientDetails = clientCache[clienteId];

          if (userFunction === 'GESTOR CLIENTE' || userFunction === 'ADMIN' || userFunction === 'GESTOR CONTA') {
              // GESTOR CLIENTE, ADMIN and GESTOR CONTA always get full access to selected clients
              rowsToInsert.push({
                  profile_id: userId,
                  cliente_id: clienteId,
                  empresa_id: null,
                  rel_situacao_id: 'ATV'
              });
          } else if (!clientDetails || clientDetails.empresas.length === 0) {
              // Client has no companies yet, or details not loaded. Grant full access so they can see the client.
              rowsToInsert.push({
                  profile_id: userId,
                  cliente_id: clienteId,
                  empresa_id: null,
                  rel_situacao_id: 'ATV'
              });
          } else if (selectedCompanies && selectedCompanies.size === clientDetails.empresas.length) {
              // All companies selected -> Grant full access (null)
              rowsToInsert.push({
                  profile_id: userId,
                  cliente_id: clienteId,
                  empresa_id: null,
                  rel_situacao_id: 'ATV'
              });
          } else if (selectedCompanies && selectedCompanies.size > 0) {
              // Granular access
              selectedCompanies.forEach(empresaId => {
                  rowsToInsert.push({
                      profile_id: userId,
                      cliente_id: clienteId,
                      empresa_id: empresaId,
                      rel_situacao_id: 'ATV'
                  });
              });
          }
          // If selectedCompanies.size === 0 but clientDetails.empresas.length > 0, 
          // we don't insert anything. The user explicitly unchecked all companies, 
          // so they lose access to this client.
      });

      if (rowsToInsert.length > 0) {
          const { error: insertError } = await supabase
              .from('rel_prof_cli_empr')
              .insert(rowsToInsert);
          
          if (insertError) throw insertError;
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Password Validation
    if (formData.password || !selectedUser) {
        if (formData.password !== formData.confirmPassword) {
            setError("As senhas não conferem!");
            return;
        }
        if (!selectedUser && !formData.password) {
            setError("A senha é obrigatória para novos usuários!");
            return;
        }
    }

    setLoading(true);

    let targetUserId = selectedUser?.id;

    try {
        if (selectedUser) {
            // If password is being changed
            if (formData.password) {
                if (!formData.currentPassword) {
                    throw new Error("A senha atual é obrigatória para alteração de senha.");
                }

                // Validate current password
                // Note: This only works if the user is changing their OWN password
                // or if we have a way to verify it. 
                // We'll try to sign in with the current email and provided current password.
                const { error: authCheckError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.currentPassword
                });

                if (authCheckError) {
                    throw new Error("Senha atual incorreta. Não foi possível validar a alteração.");
                }

                // Update Auth Password
                const { error: passUpdateError } = await supabase.auth.updateUser({
                    password: formData.password
                });

                if (passUpdateError) throw passUpdateError;
            }

            // UPDATE Profile (Existing User)
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    username: formData.email, // Keep username synced with email
                    function: formData.function,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedUser.id);

            if (updateError) throw updateError;
            
            await handleSaveRelations(selectedUser.id, formData.function);
            setSuccessMsg("Usuário atualizado com sucesso!");

        } else {
            // CREATE Profile (New User)
            
            // 1. Configure temp client to NOT persist session
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // 2. Sign Up User
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: { data: { full_name: formData.full_name } }
            });

            if (authError) {
                if (authError.message.includes("security purposes") || authError.status === 429) {
                    throw new Error("Muitas tentativas de criação. Por favor, aguarde alguns segundos antes de tentar novamente.");
                }
                throw authError;
            }
            
            if (!authData.user) throw new Error("ID não retornado pelo Supabase.");
            targetUserId = authData.user.id;

            // 3. Insert Profile
            const profilePayload = {
                id: targetUserId,
                username: formData.email, // Use email as username
                full_name: formData.full_name,
                function: formData.function,
                updated_at: new Date().toISOString()
            };

            let profileError;

            if (authData.session) {
                // Sessão existe (Auto-Confirm ON): Inserir usando o cliente temporário (como o próprio usuário)
                // Isso satisfaz a regra RLS 'auth.uid() = id'
                const { error } = await tempSupabase.from('profiles').upsert(profilePayload);
                profileError = error;
            } else {
                // Sessão NULA (Email Confirm ON): Tentar inserir usando o cliente Principal (Admin)
                console.warn("Sessão não iniciada (Email Confirm ON). Tentando inserir perfil como Admin.");
                const { error } = await supabase.from('profiles').upsert(profilePayload);
                profileError = error;
            }

            if (profileError) {
                if (profileError.code === '42501' && !authData.session) {
                     // Erro de permissão ao tentar como Admin para outro usuário
                     throw new Error("Não foi possível criar o perfil: E-mail pendente de confirmação e o Admin não tem permissão para inserir em 'profiles'. Desative 'Confirm Email' no Supabase ou ajuste as Policies (RLS).");
                }
                throw new Error(`Falha no perfil: ${profileError.message}`);
            }

            // 4. Save Relations (using Admin client)
            await handleSaveRelations(targetUserId, formData.function);
            setSuccessMsg("Usuário criado com sucesso!");
        }

        setTimeout(() => {
            closeModal();
            fetchData();
        }, 1500);

    } catch (err: any) {
        console.error("User op error:", err);
        setError(`${err.message || JSON.stringify(err)}`);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
        await supabase.from('rel_prof_cli_empr').delete().eq('profile_id', selectedUser.id);
        const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
        if (error) throw error;
        closeDeleteModal();
        fetchData();
    } catch (err: any) {
        setError(`Falha ao excluir usuário: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  // Data Preps
  const shuttleClients = useMemo(() => clientes.map(c => ({ id: c.id, label: c.cli_nome || 'Sem Nome' })), [clientes]);

  // Filter companies for the active tab (Client) based on selected roots
  const activeTabDetails = activeTab ? clientCache[activeTab] : null;
  const activeTabConfigRoots = activeTab ? userConfig.selectedRoots[activeTab] : new Set();
  
  const shuttleCompanies = useMemo(() => {
      if (!activeTabDetails) return [];
      // Only show companies whose Root is selected
      return activeTabDetails.empresas
          .filter(e => e.emp_cnpj_raiz && activeTabConfigRoots?.has(e.emp_cnpj_raiz))
          .map(e => ({
              id: e.id,
              label: `${e.emp_cnpj_raiz} - ${e.emp_nome_reduz || e.emp_nome}`
          }));
  }, [activeTabDetails, activeTabConfigRoots]);

  const renderContent = () => {
    if (loading && usuarios.length === 0) return <div className="p-8 text-center text-gray-300">Carregando...</div>;
    return (
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-gray-400">Nome Completo</th>
              <th className="px-4 py-2 text-left text-gray-400">Usuário</th>
              <th className="px-4 py-2 text-left text-gray-400">Função</th>
              <th className="px-4 py-2 text-right text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {usuarios.map(user => (
              <tr key={user.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white">{user.full_name}</td>
                <td className="px-4 py-2 text-gray-300">{user.username || '-'}</td>
                <td className="px-4 py-2 text-gray-300">{user.function || '-'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end space-x-4">
                    <button onClick={() => openModal(user)} className="text-indigo-400 hover:text-indigo-300"><i className="fas fa-pencil-alt"></i></button>
                    <button onClick={() => openDeleteModal(user)} className="text-red-500 hover:text-red-400"><i className="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Usuários do Sistema</h2>
        <div className="flex flex-wrap items-center gap-2">
            <input type="text" placeholder="Buscar..." value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <button onClick={() => openModal()} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Adicionar Usuário</button>
        </div>
      </div>

      {error && !isModalOpen && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}
      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedUser ? 'Editar Perfil e Acessos' : 'Novo Usuário'} size="5xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto pr-2">
            {error && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2 text-sm text-red-300 bg-red-900/40 border border-red-700 rounded-md"
                >
                    {error}
                </motion.div>
            )}
            {successMsg && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2 text-sm text-green-300 bg-green-900/40 border border-green-700 rounded-md"
                >
                    {successMsg}
                </motion.div>
            )}
            
            {/* 1. Dados Básicos */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-300">E-mail *</label>
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleFormChange} 
                            required 
                            disabled={!!selectedUser}
                            className={`w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md ${selectedUser ? 'opacity-60 cursor-not-allowed' : ''}`} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300">Função *</label>
                        <select name="function" value={formData.function} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                            <option value="">Selecione...</option>
                            {currentUserProfile?.function === 'MASTER' && <option value="MASTER">MASTER</option>}
                            {(currentUserProfile?.function === 'MASTER' || currentUserProfile?.function === 'GESTOR CLIENTE') && <option value="GESTOR CLIENTE">GESTOR CLIENTE</option>}
                            <option value="ADMIN">ADMIN</option>
                            <option value="GESTOR CONTA">GESTOR CONTA</option>
                            <option value="COLABORADOR">COLABORADOR</option>
                            <option value="LEITOR">LEITOR</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-300">Nome Completo *</label>
                    <input type="text" name="full_name" value={formData.full_name} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="block text-sm text-gray-300">{selectedUser ? 'Nova Senha' : 'Senha *'}</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                name="password" 
                                value={formData.password} 
                                onChange={handleFormChange} 
                                required={!selectedUser}
                                className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md pr-10" 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white mt-0.5"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <label className="block text-sm text-gray-300">{selectedUser ? 'Confirmar Nova Senha' : 'Confirmar Senha *'}</label>
                        <div className="relative">
                            <input 
                                type={showConfirmPassword ? "text" : "password"} 
                                name="confirmPassword" 
                                value={formData.confirmPassword} 
                                onChange={handleFormChange} 
                                required={!!formData.password || !selectedUser}
                                className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md pr-10" 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white mt-0.5"
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                {selectedUser && formData.password && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="relative"
                    >
                        <label className="block text-sm text-gray-300 font-bold text-yellow-500">Senha Atual (para validar alteração) *</label>
                        <div className="relative">
                            <input 
                                type={showCurrentPassword ? "text" : "password"} 
                                name="currentPassword" 
                                value={formData.currentPassword} 
                                onChange={handleFormChange} 
                                required
                                className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-yellow-600 rounded-md pr-10" 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white mt-0.5"
                            >
                                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            <hr className="border-gray-700 my-4"/>

            {formData.function === 'MASTER' ? (
                <div className="p-4 bg-indigo-900/30 border border-indigo-700 rounded-md">
                    <h3 className="text-sm font-bold text-indigo-300 mb-1">Acesso Irrestrito</h3>
                    <p className="text-sm text-indigo-200/70">Usuários com a função MASTER têm acesso automático e irrestrito a todos os clientes e empresas do sistema. Não é necessário configurar acessos granulares.</p>
                </div>
            ) : (
                <>
                    {/* 2. Seleção de Clientes (Shuttle Topo) */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase">1. Seleção de Clientes</h3>
                        {(formData.function === 'GESTOR CLIENTE' || formData.function === 'ADMIN' || formData.function === 'GESTOR CONTA') && (
                            <div className="p-3 mb-4 bg-blue-900/20 border border-blue-800 rounded-md">
                                <p className="text-xs text-blue-300">
                                    Usuários com a função <strong>{formData.function}</strong> têm acesso automático a todas as empresas dos clientes selecionados.
                                </p>
                            </div>
                        )}
                        <Shuttle 
                            items={shuttleClients}
                            selectedIds={selectedClientIds}
                            onChange={handleClientSelectionChange}
                            availableTitle="Clientes Disponíveis"
                            selectedTitle="Clientes Selecionados"
                            height="180px"
                        />
                    </div>

                    {/* 3. Configuração Granular (Tabs) */}
                    {formData.function !== 'GESTOR CLIENTE' && formData.function !== 'ADMIN' && formData.function !== 'GESTOR CONTA' && selectedClientIds.size > 0 && (
                        <div className="mt-4 bg-gray-900/30 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase">2. Configuração de Acesso por Cliente</h3>
                            
                            {/* Tabs Header */}
                            <div className="flex space-x-2 border-b border-gray-600 pb-1 mb-4 overflow-x-auto">
                                {Array.from(selectedClientIds).map(cliId => {
                                    const cliName = clientes.find(c => c.id === cliId)?.cli_nome || 'Cliente';
                                    const isActive = activeTab === cliId;
                                    return (
                                        <button
                                            key={cliId}
                                            type="button"
                                            onClick={() => setActiveTab(cliId)}
                                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${isActive ? 'bg-gray-700 text-white border-t border-x border-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                        >
                                            {cliName}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tab Content */}
                            {activeTab && activeTabDetails ? (
                                <div className="space-y-4 animate-fadeIn">
                                    {/* A. CNPJ Roots */}
                                    <div className="bg-gray-800 p-3 rounded-md border border-gray-700">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">CNPJs do Grupo</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {activeTabDetails.cnpjs.map(root => (
                                        <label key={root.cnpj_raiz} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-700 transition">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-500 rounded focus:ring-indigo-500"
                                                checked={userConfig.selectedRoots[activeTab!]?.has(root.cnpj_raiz) || false}
                                                onChange={() => handleRootToggle(activeTab!, root.cnpj_raiz)}
                                            />
                                            <span className="text-sm text-gray-200">{root.reduz_emp} ({root.cnpj_raiz})</span>
                                        </label>
                                    ))}
                                    {activeTabDetails.cnpjs.length === 0 && <span className="text-sm text-gray-500 italic">Sem CNPJs Raiz cadastrados.</span>}
                                </div>
                            </div>

                            {/* B. Companies Shuttle */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Empresas da Visão</h4>
                                <Shuttle 
                                    items={shuttleCompanies}
                                    selectedIds={userConfig.selectedCompanies[activeTab!] || new Set()}
                                    onChange={(newIds) => handleCompanySelectionChange(activeTab!, newIds)}
                                    availableTitle="Empresas Disponíveis"
                                    selectedTitle="Empresas Selecionadas"
                                    height="250px"
                                />
                                <p className="text-xs text-gray-500 mt-1">* A lista de empresas disponíveis é filtrada pelos CNPJs marcados acima.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            {loadingDetails ? <div className="flex justify-center"><div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin"></div></div> : "Selecione um cliente acima para configurar."}
                        </div>
                    )}
                </div>
            )}
            {formData.function === 'GESTOR CLIENTE' && selectedClientIds.size > 0 && (
                <div className="mt-4 p-4 bg-indigo-900/30 border border-indigo-700 rounded-md">
                    <h3 className="text-sm font-bold text-indigo-300 mb-1">Acesso Total aos Clientes Selecionados</h3>
                    <p className="text-sm text-indigo-200/70">Usuários com a função GESTOR CLIENTE têm acesso automático a todas as empresas dos clientes selecionados.</p>
                </div>
            )}
            </>
            )}

            <div className="flex justify-end pt-4 space-x-2 border-t border-gray-700">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o perfil do usuário "{selectedUser?.full_name}"?</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default UsuarioPage;
