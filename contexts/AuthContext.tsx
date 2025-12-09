
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
  const [selectedClient, setSelectedClientState] = useState<ClientContext | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserClients = async (userId: string) => {
    try {
      // OTIMIZAÇÃO: Dividir em duas queries para evitar Timeout de RLS em Joins complexos
      
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
          setSelectedClientState(null);
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

      // Lógica de Auto-seleção
      if (clients.length === 1) {
        selectClient(clients[0]);
      } else if (clients.length > 1) {
        // Verificar persistência
        const stored = localStorage.getItem('dre_selected_client');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const isValid = clients.find(c => c.id === parsed.id);
            if (isValid) {
              setSelectedClientState(isValid);
            } else {
              setSelectedClientState(null);
            }
          } catch (e) {
            setSelectedClientState(null);
          }
        } else {
          setSelectedClientState(null);
        }
      } else {
        setSelectedClientState(null);
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

    const initSession = async () => {
        try {
            // Timeout de segurança aumentado para 15s
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Auth Timeout")), 15000));
            const sessionPromise = supabase.auth.getSession();
            
            const result: any = await Promise.race([sessionPromise, timeoutPromise]);
            const { data: { session }, error } = result;

            if (error) throw error;

            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                
                if (session?.user) {
                    // Fetch paralelo com timeout de 10s para dados
                    const dataFetchPromise = Promise.all([
                        fetchProfile(session.user.id),
                        fetchUserClients(session.user.id)
                    ]);
                    
                    await Promise.race([
                        dataFetchPromise,
                        new Promise((r) => setTimeout(r, 10000)) 
                    ]);
                }
            }
        } catch (err) {
            console.warn("Auth initialization warning:", err);
        } finally {
            if (mounted) {
                setLoading(false);
            }
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
            await Promise.all([
                fetchProfile(session.user.id),
                fetchUserClients(session.user.id)
            ]);
        } catch (e) {
            console.error("Auth change fetch error:", e);
        }
      } else {
        // Quando detectarmos logout, limpamos tudo
        setProfile(null);
        setAvailableClients([]);
        selectClient(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // 1. Feedback imediato para o usuário saber que o clique funcionou
    setLoading(true);
    
    try {
        // 2. Tenta logout no servidor (com timeout curto para não travar a UI se a rede falhar)
        await Promise.race([
            supabase.auth.signOut(),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);
    } catch (error) {
        console.error("Sign out error (non-blocking):", error);
    } finally {
        // 3. Limpeza local garantida
        setProfile(null);
        setUser(null);
        setSession(null);
        setAvailableClients([]);
        selectClient(null);
        
        // Limpeza forçada do LocalStorage
        localStorage.removeItem('dre_selected_client');
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        });
        
        // 4. Finaliza loading. Como session agora é null, o App.tsx vai renderizar o LoginPage automaticamente.
        // NÃO usamos window.location.reload() para evitar re-inicialização de sessão fantasma.
        setLoading(false);
    }
  };

  // Memoize o valor do contexto para evitar re-renderizações desnecessárias
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
