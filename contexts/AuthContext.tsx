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
      const { data: relData, error: relError } = await supabase
        .from('rel_prof_cli_empr')
        .select('cliente_id')
        .eq('profile_id', userId)
        .eq('rel_situacao_id', 'ATV')
        .not('cliente_id', 'is', null);

      if (relError) throw relError;

      if (!relData || relData.length === 0) {
          setAvailableClients([]);
          if (selectedClient) {
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

      if (selectedClient) {
          const isValid = clients.find(c => c.id === selectedClient.id);
          if (!isValid) {
              setSelectedClientState(null);
              localStorage.removeItem('dre_selected_client');
          } else {
              if (isValid.cli_nome !== selectedClient.cli_nome) {
                  selectClient(isValid);
              }
          }
      } else {
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
            // Get session directly - removed artificial timeout/race condition
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error("Error getting session:", error);
                // Proceed without throwing to allow 'finally' to run
            }

            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // Fetch data concurrently, catch errors so one doesn't fail all
                    await Promise.all([
                        fetchProfile(session.user.id).catch(e => console.error("Profile fetch error", e)),
                        fetchUserClients(session.user.id).catch(e => console.error("Clients fetch error", e))
                    ]);
                } else {
                    setProfile(null);
                    setAvailableClients([]);
                }
            }
        } catch (err) {
            console.error("Auth init unexpected error:", err);
        } finally {
            if (mounted) {
                setLoading(false); // Ensure loading is always disabled
            }
        }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN') {
            if (session?.user) {
                 await Promise.all([
                    fetchProfile(session.user.id),
                    fetchUserClients(session.user.id)
                 ]).catch(console.error);
            }
        } else if (event === 'SIGNED_OUT') {
            setProfile(null);
            setAvailableClients([]);
            selectClient(null);
            localStorage.removeItem('dre_selected_client');
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