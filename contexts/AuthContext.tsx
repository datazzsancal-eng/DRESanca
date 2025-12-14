import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  function: string | null;
}

export interface ClientContext {
  id: string;
  cli_nome: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  availableClients: ClientContext[];
  selectedClient: ClientContext | null;
  selectClient: (client: ClientContext | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Client Selection State
  const [availableClients, setAvailableClients] = useState<ClientContext[]>([]);
  const [selectedClient, setSelectedClientState] = useState<ClientContext | null>(() => {
      try {
          const stored = localStorage.getItem('dre_selected_client');
          return stored ? JSON.parse(stored) : null;
      } catch (e) {
          return null;
      }
  });

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        // Ignora erro se for apenas "Row not found" para não sujar o console em novos usuários
        if (error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Exception fetching profile:', error);
    }
  };

  const fetchUserClients = async (userId: string) => {
    try {
      // 1. Buscar IDs dos relacionamentos ativos
      const { data: relData, error: relError } = await supabase
        .from('rel_prof_cli_empr')
        .select('cliente_id')
        .eq('profile_id', userId)
        .eq('rel_situacao_id', 'ATV')
        .not('cliente_id', 'is', null);

      if (relError) throw relError;

      if (!relData || relData.length === 0) {
          setAvailableClients([]);
          // Se não tem clientes permitidos, remove seleção atual
          if (selectedClient) {
              setSelectedClientState(null);
              localStorage.removeItem('dre_selected_client');
          }
          return;
      }

      // Extrair IDs únicos
      const clientIds = Array.from(new Set(relData.map((item: any) => item.cliente_id)));

      // 2. Buscar detalhes dos clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('dre_cliente')
        .select('id, cli_nome')
        .in('id', clientIds)
        .order('cli_nome');

      if (clientsError) throw clientsError;
      
      const clients = clientsData || [];
      setAvailableClients(clients);

      // Validate or Auto-select
      if (selectedClient) {
          const isValid = clients.find(c => c.id === selectedClient.id);
          if (!isValid) {
              setSelectedClientState(null);
              localStorage.removeItem('dre_selected_client');
          } else {
              // Atualiza dados se necessário (ex: nome mudou)
              if (isValid.cli_nome !== selectedClient.cli_nome) {
                  selectClient(isValid);
              }
          }
      } else {
          // Auto-select se único
          if (clients.length === 1) {
              selectClient(clients[0]);
          }
      }

    } catch (error) {
      console.error('Error fetching user clients:', error);
      setAvailableClients([]);
    }
  };

  const selectClient = (client: ClientContext | null) => {
    setSelectedClientState(client);
    if (client) {
      localStorage.setItem('dre_selected_client', JSON.stringify(client));
    } else {
      localStorage.removeItem('dre_selected_client');
    }
  };

  useEffect(() => {
    let mounted = true;

    // Função de Inicialização Única
    const initializeAuth = async () => {
        try {
            // 1. Obter Sessão Inicial
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                throw error;
            }

            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // 2. Carregar Dados do Usuário
                    await Promise.all([
                        fetchProfile(session.user.id),
                        fetchUserClients(session.user.id)
                    ]);
                } else {
                    // Limpar dados se não houver usuário
                    setProfile(null);
                    setAvailableClients([]);
                }
            }
        } catch (err) {
            console.error("Auth initialization error:", err);
            // Em caso de erro crítico na inicialização, forçamos logout local para evitar estado inconsistente
            if (mounted) {
                setSession(null);
                setUser(null);
            }
        } finally {
            if (mounted) {
                setLoading(false); // Garante que o loading termina
            }
        }
    };

    initializeAuth();

    // Listener de Eventos de Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        
        console.log(`Auth Event: ${event}`);
        
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN') {
            // Ao logar, buscamos os dados, mas NÃO ativamos o loading global
            // para evitar conflitos de UI ou loops.
            if (session?.user) {
                 await Promise.all([
                    fetchProfile(session.user.id),
                    fetchUserClients(session.user.id)
                 ]);
            }
        } else if (event === 'SIGNED_OUT') {
            setProfile(null);
            setAvailableClients([]);
            selectClient(null);
            localStorage.clear();
        }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Sign out error:", error);
    } finally {
        setProfile(null);
        setUser(null);
        setSession(null);
        setAvailableClients([]);
        selectClient(null);
        localStorage.clear();
        setLoading(false);
    }
  };

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    availableClients,
    selectedClient,
    selectClient,
    signOut,
  }), [session, user, profile, loading, availableClients, selectedClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};