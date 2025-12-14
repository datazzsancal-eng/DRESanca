
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
  // Initialize from localStorage to avoid "flicker" or loss of context on refresh
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
          setSelectedClientState(null); // Clear selection if no access
          localStorage.removeItem('dre_selected_client');
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
      // If we already have a selectedClient (from local storage), verify if it is still valid
      if (selectedClient) {
          const isValid = clients.find(c => c.id === selectedClient.id);
          if (!isValid) {
              // Context is no longer valid (e.g. permission revoked), clear it
              setSelectedClientState(null);
              localStorage.removeItem('dre_selected_client');
          } else {
              // Optional: Update with fresh data from DB (e.g. name change)
              if (isValid.cli_nome !== selectedClient.cli_nome) {
                  selectClient(isValid);
              }
          }
      } else {
          // No selection yet. If only 1 client, auto-select.
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

    const initializeAuth = async () => {
        try {
            // Get session without artificial timeouts
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;

            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // Fetch data concurrently
                    await Promise.all([
                        fetchProfile(session.user.id),
                        fetchUserClients(session.user.id)
                    ]);
                } else {
                    // No user, clear profile
                    setProfile(null);
                    setAvailableClients([]);
                }
            }
        } catch (err) {
            console.error("Auth initialization error:", err);
        } finally {
            if (mounted) {
                setLoading(false);
            }
        }
    };

    initializeAuth();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        
        // Update basic auth state
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
            setProfile(null);
            setAvailableClients([]);
            selectClient(null);
            setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             // Only refetch if we have a user
             if (session?.user) {
                 // We don't necessarily need to set loading=true for token refresh to avoid UI flickering
                 // But for SIGNED_IN we might want to ensure data is fresh
                 if (event === 'SIGNED_IN') setLoading(true);
                 
                 await Promise.all([
                    fetchProfile(session.user.id),
                    fetchUserClients(session.user.id)
                 ]);
                 
                 if (event === 'SIGNED_IN') setLoading(false);
             }
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
        localStorage.clear(); // Clear all app data
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
