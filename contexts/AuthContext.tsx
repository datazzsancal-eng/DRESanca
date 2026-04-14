// Versao Cursor
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
  refreshClients: () => Promise<void>;
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
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return null;
      } else {
        setProfile(data);
        return data;
      }
    } catch (error) {
      console.error('Exception fetching profile:', error);
      return null;
    }
  };

  const fetchUserClients = useCallback(async (userId: string, userFunction: string | null, skipAutoSelect: boolean = false) => {
    try {
      let clientIds: string[] = [];
      let clients: ClientContext[] = [];

      if (userFunction === 'MASTER') {
         // MASTER users have unrestricted access to all clients
         const { data: clientsData, error: clientsError } = await supabase
            .from('dre_cliente')
            .select('id, cli_nome')
            .order('cli_nome');
         
         if (clientsError) throw clientsError;
         clients = clientsData || [];
      } else {
         // Other users are restricted by rel_prof_cli_empr
         const { data: relData, error: relError } = await supabase
            .from('rel_prof_cli_empr')
            .select('cliente_id')
            .eq('profile_id', userId)
            .eq('rel_situacao_id', 'ATV')
            .not('cliente_id', 'is', null);

         if (relError) throw relError;

         if (!relData || relData.length === 0) {
             setAvailableClients([]);
             setSelectedClientState(prev => {
                 if (prev) localStorage.removeItem('dre_selected_client');
                 return null;
             });
             return;
         }

         clientIds = Array.from(new Set(relData.map((item: any) => item.cliente_id)));

         const { data: clientsData, error: clientsError } = await supabase
            .from('dre_cliente')
            .select('id, cli_nome')
            .in('id', clientIds)
            .order('cli_nome');

         if (clientsError) throw clientsError;
         clients = clientsData || [];
      }

      setAvailableClients(clients);

      setSelectedClientState(currentSelected => {
          if (currentSelected) {
              const isValid = clients.find((c: ClientContext) => c.id === currentSelected.id);
              if (!isValid) {
                  localStorage.removeItem('dre_selected_client');
                  return null;
              } else if (isValid.cli_nome !== currentSelected.cli_nome) {
                  const updatedClient = { ...isValid };
                  localStorage.setItem('dre_selected_client', JSON.stringify(updatedClient));
                  return updatedClient;
              }
              return currentSelected;
          } else if (!skipAutoSelect && clients.length === 1) {
              const singleClient = clients[0];
              localStorage.setItem('dre_selected_client', JSON.stringify(singleClient));
              return singleClient;
          }
          return currentSelected;
      });

    } catch (error) {
      console.error('Error fetching user clients:', error);
      setAvailableClients([]);
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

    const loadUserData = async (sessionUser: User) => {
      try {
        // Fetch profile first to get the user function
        const profileData = await fetchProfile(sessionUser.id);
        await fetchUserClients(sessionUser.id, profileData?.function || null, false);
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Get session error:", error);
        if (mounted) setLoading(false);
        return;
      }
      
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          loadUserData(session.user);
        } else {
          setLoading(false);
        }
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      // INITIAL_SESSION is handled by getSession above to avoid duplicate fetches
      if (event === 'INITIAL_SESSION') return;

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true);
        loadUserData(session.user);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setAvailableClients([]);
        setSelectedClientState(null);
        localStorage.removeItem('dre_selected_client');
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserClients]);

  const refreshClients = useCallback(async () => {
    if (user) {
      await fetchUserClients(user.id, profile?.function || null, true);
    }
  }, [user, profile, fetchUserClients]);

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
    refreshClients,
    signOut,
  }), [session, user, profile, loading, availableClients, selectedClient, selectClient, clearClientData, refreshClients, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
