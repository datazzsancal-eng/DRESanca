
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import Modal from '../shared/Modal';
import Shuttle from '../shared/Shuttle';

// Type definitions
interface UserProfile {
  id: string;
  created_at: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  function: string | null;
}

interface Cliente {
  id: string;
  cli_nome: string | null;
}

const UsuarioPage: React.FC = () => {
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
  
  // Shuttle State
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  
  // Form State
  const initialFormState = {
    email: '',
    password: '',
    username: '',
    full_name: '',
    function: '',
    bio: ''
  };
  const [formData, setFormData] = useState(initialFormState);

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

  // Modal handlers
  const openModal = async (user: UserProfile | null = null) => {
    setSelectedUser(user);
    setError(null);
    setSuccessMsg(null);
    setSelectedClientIds(new Set()); // Reset selection

    if (user) {
        // Edit mode
        setFormData({
            ...initialFormState,
            username: user.username || '',
            full_name: user.full_name || '',
            function: user.function || '',
            bio: user.bio || ''
        });

        // Fetch associated clients
        try {
            const { data: relations, error: relError } = await supabase
                .from('rel_prof_cli_empr')
                .select('cliente_id')
                .eq('profile_id', user.id)
                .not('cliente_id', 'is', null);
            
            if (relError) {
                console.error("Error fetching user relations:", relError);
            } else if (relations) {
                const ids = new Set(relations.map(r => r.cliente_id).filter(Boolean) as string[]);
                setSelectedClientIds(ids);
            }
        } catch (e) {
            console.error("Error fetching relations", e);
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
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveRelations = async (userId: string) => {
      // 1. Delete existing client relations for this user
      // Note: We specify client_id is not null to strictly target client associations, 
      // though typically we'd clear based on profile_id for this context.
      const { error: deleteError } = await supabase
          .from('rel_prof_cli_empr')
          .delete()
          .eq('profile_id', userId)
          .not('cliente_id', 'is', null);
      
      if (deleteError) throw deleteError;

      // 2. Insert new relations
      if (selectedClientIds.size > 0) {
          const rowsToInsert = Array.from(selectedClientIds).map(clienteId => ({
              profile_id: userId,
              cliente_id: clienteId,
              rel_situacao_id: 'ATV'
          }));

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
    setLoading(true);

    let targetUserId = selectedUser?.id;

    try {
        if (selectedUser) {
            // --- UPDATE (Profile only) ---
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    username: formData.username,
                    function: formData.function,
                    bio: formData.bio,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedUser.id);

            if (updateError) throw updateError;
            
            // Sync Clients
            await handleSaveRelations(selectedUser.id);

            setSuccessMsg("Usuário atualizado com sucesso!");

        } else {
            // --- CREATE (Auth + Profile) ---
            
            // 1. Create a temporary client to avoid logging out the current admin
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey);
            
            // 2. Sign up the new user
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.full_name,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Usuário criado, mas ID não retornado.");
            
            targetUserId = authData.user.id;

            // 3. Insert into profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: targetUserId,
                    username: formData.username,
                    full_name: formData.full_name,
                    function: formData.function,
                    bio: formData.bio,
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                throw new Error(`Usuário de autenticação criado, mas falha no perfil: ${profileError.message}`);
            }

            // Sync Clients
            await handleSaveRelations(targetUserId);

            setSuccessMsg("Usuário criado com sucesso!");
        }

        setTimeout(() => {
            closeModal();
            fetchData();
        }, 1500);

    } catch (err: any) {
        console.error("User op error:", err);
        const errorMsg = err.message || JSON.stringify(err);
        setError(`Erro: ${errorMsg}`);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
        // First delete relations
        await supabase.from('rel_prof_cli_empr').delete().eq('profile_id', selectedUser.id);

        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', selectedUser.id);

        if (error) throw error;

        closeDeleteModal();
        fetchData();
    } catch (err: any) {
        setError(`Falha ao excluir usuário: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  // Prepare items for Shuttle
  const shuttleItems = useMemo(() => {
      return clientes.map(c => ({
          id: c.id,
          label: c.cli_nome || 'Sem Nome'
      }));
  }, [clientes]);

  // Render logic
  const renderContent = () => {
    if (loading && usuarios.length === 0) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
    }
    if (usuarios.length === 0) {
        return (
            <div className="p-6 bg-gray-800/50 text-center">
                <h2 className="text-lg font-bold text-white">Nenhum Usuário Encontrado</h2>
                <p className="mt-1 text-gray-400">
                    Clique em 'Adicionar Usuário' para criar o primeiro acesso.
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Nome Completo</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Usuário</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Função</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">Criado em</th>
              <th className="px-4 py-2 text-xs font-semibold tracking-wider text-right text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {usuarios.map(user => (
              <tr key={user.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold mr-3">
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        {user.full_name}
                    </div>
                </td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{user.username || '-'}</td>
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{user.function || '-'}</td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => openModal(user)} className="text-indigo-400 hover:text-indigo-300" aria-label="Editar">
                        <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => openDeleteModal(user)} className="text-red-500 hover:text-red-400" aria-label="Excluir">
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
  }

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-lg font-bold text-white">Usuários do Sistema</h2>
        <div className="flex flex-wrap items-center gap-2">
            <input 
                type="text"
                placeholder="Buscar por nome ou usuário..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="px-3 py-1.5 text-sm text-gray-200 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => openModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 whitespace-nowrap"
            >
              Adicionar Usuário
            </button>
        </div>
      </div>

      {error && !isModalOpen && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedUser ? 'Editar Perfil' : 'Novo Usuário'} size="3xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
            {error && <div className="p-2 text-sm text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}
            {successMsg && <div className="p-2 text-sm text-green-300 bg-green-900/40 border border-green-700 rounded-md">{successMsg}</div>}
            
            {/* Credenciais (Apenas Criação) */}
            {!selectedUser && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-900/50 rounded-md border border-gray-700">
                    <div className="md:col-span-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Credenciais de Acesso</div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">E-mail *</label>
                        <input type="email" name="email" id="email" value={formData.email} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="usuario@email.com" />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">Senha *</label>
                        <input type="password" name="password" id="password" value={formData.password} onChange={handleFormChange} required minLength={6} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="Mínimo 6 caracteres" />
                    </div>
                </div>
            )}

            {/* Dados do Perfil */}
            <div className="space-y-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Dados do Perfil</div>
                <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-300">Nome Completo *</label>
                    <input type="text" name="full_name" id="full_name" value={formData.full_name} onChange={handleFormChange} required className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-300">Nome de Usuário (Login)</label>
                        <input type="text" name="username" id="username" value={formData.username} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="function" className="block text-sm font-medium text-gray-300">Função / Cargo</label>
                        <input type="text" name="function" id="function" value={formData.function} onChange={handleFormChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>
                <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-300">Bio / Observações</label>
                    <textarea name="bio" id="bio" value={formData.bio} onChange={handleFormChange} rows={2} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                </div>
            </div>

            {/* Associacao de Clientes */}
            <div className="space-y-2 pt-2 border-t border-gray-700">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Acesso aos Clientes</div>
                <Shuttle 
                    items={shuttleItems}
                    selectedIds={selectedClientIds}
                    onChange={setSelectedClientIds}
                    availableTitle="Clientes Disponíveis"
                    selectedTitle="Clientes Associados"
                    height="200px"
                />
            </div>

            <div className="flex justify-end pt-4 space-x-2 border-t border-gray-700 mt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirmar Exclusão">
        <p className="text-gray-300">Tem certeza que deseja excluir o perfil do usuário "{selectedUser?.full_name}"?</p>
        <p className="text-sm text-yellow-500 mt-2">Nota: O acesso ao sistema será revogado, mas o registro de autenticação pode permanecer no banco até limpeza administrativa.</p>
        <div className="flex justify-end pt-6 space-x-2">
            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

export default UsuarioPage;
