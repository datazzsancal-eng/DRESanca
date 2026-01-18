
import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  clearClientData: () => void;
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

  // Refs para evitar loops e race conditions
  const isInitializingRef = useRef(false);
  const isFetchingClientsRef = useRef(false);
  const selectedClientRef = useRef<ClientContext | null>(selectedClient);

  // Atualizar ref quando selectedClient mudar
  useEffect(() => {
    selectedClientRef.current = selectedClient;
  }, [selectedClient]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Exception fetching profile:', error);
    }
  };

  const fetchUserClients = useCallback(async (userId: string, skipAutoSelect: boolean = false) => {
    // Prevenir múltiplas chamadas simultâneas
    if (isFetchingClientsRef.current) {
      console.log('fetchUserClients já está em execução, ignorando chamada duplicada');
      return;
    }

    isFetchingClientsRef.current = true;

    try {
      const { data: relData, error: relError } = await supabase
        .from('rel_prof_cli_empr')
        .select('cliente_id')
        .eq('profile_id', userId)
        .eq('rel_situacao_id', 'ATV')
        .not('cliente_id', 'is', null);

      if (relError) throw relError;

      if (!relData || relData.length === 0) {
          setAvailableClients([]);
          const currentSelected = selectedClientRef.current;
          if (currentSelected) {
              setSelectedClientState(null);
              localStorage.removeItem('dre_selected_client');
          }
          return;
      }

      const clientIds = Array.from(new Set(relData.map((item: any) => item.cliente_id)));

      const { data: clientsData, error: clientsError } = await supabase
        .from('dre_cliente')
        .select('id, cli_nome')
        .in('id', clientIds)
        .order('cli_nome');

      if (clientsError) throw clientsError;
      
      const clients = clientsData || [];
      setAvailableClients(clients);

      // Usar ref para obter o valor atualizado sem causar re-renders
      const currentSelected = selectedClientRef.current;

      // Validar cliente selecionado contra a nova lista
      if (currentSelected) {
          const isValid = clients.find((c: ClientContext) => c.id === currentSelected.id);
          if (!isValid) {
              // Cliente não é mais válido, remover
              setSelectedClientState(null);
              localStorage.removeItem('dre_selected_client');
          } else if (isValid.cli_nome !== currentSelected.cli_nome) {
              // Nome mudou, atualizar silenciosamente sem causar loop
              const updatedClient = { ...isValid };
              setSelectedClientState(updatedClient);
              localStorage.setItem('dre_selected_client', JSON.stringify(updatedClient));
          }
      } else if (!skipAutoSelect && clients.length === 1) {
          // Auto-selecionar se houver apenas um cliente
          const singleClient = clients[0];
          setSelectedClientState(singleClient);
          localStorage.setItem('dre_selected_client', JSON.stringify(singleClient));
      }

    } catch (error) {
      console.error('Error fetching user clients:', error);
      setAvailableClients([]);
    } finally {
      isFetchingClientsRef.current = false;
    }
  }, []);

  const selectClient = useCallback((client: ClientContext | null) => {
    setSelectedClientState(client);
    if (client) {
      localStorage.setItem('dre_selected_client', JSON.stringify(client));
    } else {
      localStorage.removeItem('dre_selected_client');
    }
  }, []);

  const clearClientData = useCallback(() => {
    setSelectedClientState(null);
    localStorage.removeItem('dre_selected_client');
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
        if (isInitializingRef.current) {
          console.log('initAuth já está em execução, ignorando chamada duplicada');
          return;
        }

        isInitializingRef.current = true;

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
              console.error("Get session error:", error);
              if (mounted) setLoading(false);
              return;
            }

            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await Promise.all([
                        fetchProfile(session.user.id),
                        fetchUserClients(session.user.id, false)
                    ]);
                }
            }
        } catch (err) {
            console.error("Auth init exception:", err);
        } finally {
            if (mounted) {
              setLoading(false);
              isInitializingRef.current = false;
            }
        }
    };

    initAuth();

    // Configurar listener de mudanças de autenticação
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
        if (!mounted) return;

        // Ignorar eventos durante a inicialização para evitar duplicação
        if (isInitializingRef.current && event === 'SIGNED_IN') {
          console.log('Ignorando SIGNED_IN durante inicialização');
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
             // Buscar dados do usuário
             try {
               await Promise.all([
                  fetchProfile(session.user.id),
                  fetchUserClients(session.user.id, false)
               ]);
             } catch (err) {
               console.error('Error fetching user data on SIGNED_IN:', err);
             }
        } else if (event === 'SIGNED_OUT') {
            setProfile(null);
            setAvailableClients([]);
            setSelectedClientState(null);
            localStorage.removeItem('dre_selected_client');
            setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
            // Token foi atualizado, garantir que loading está false
            setLoading(false);
        }
    });

    subscription = authSubscription;

    return () => {
      mounted = false;
      isInitializingRef.current = false;
      isFetchingClientsRef.current = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchUserClients]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Sign out error:", error);
    } finally {
        // State updates handled by onAuthStateChange('SIGNED_OUT') but we do explicit cleanup to be sure UI updates fast
        setProfile(null);
        setUser(null);
        setSession(null);
        setAvailableClients([]);
        selectClient(null);
        localStorage.clear();
        setLoading(false);
    }
  }, [selectClient]);

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    availableClients,
    selectedClient,
    selectClient,
    clearClientData,
    signOut,
  }), [session, user, profile, loading, availableClients, selectedClient, selectClient, clearClientData, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
