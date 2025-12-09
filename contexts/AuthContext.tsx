
import React, { createContext, useContext, useEffect, useState } from 'react';
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
      // Fetch clients linked to this user via rel_prof_cli_empr
      const { data, error } = await supabase
        .from('rel_prof_cli_empr')
        .select('cliente_id, dre_cliente(id, cli_nome)')
        .eq('profile_id', userId)
        .eq('rel_situacao_id', 'ATV')
        .not('cliente_id', 'is', null);

      if (error) throw error;

      // Extract unique clients
      const clientsMap = new Map<string, ClientContext>();
      data?.forEach((item: any) => {
        if (item.dre_cliente) {
          clientsMap.set(item.dre_cliente.id, item.dre_cliente);
        }
      });
      
      const clients = Array.from(clientsMap.values());
      setAvailableClients(clients);

      // Auto-selection Logic
      if (clients.length === 1) {
        // If only one client, force select it
        selectClient(clients[0]);
      } else if (clients.length > 1) {
        // If multiple, check localStorage for persistence
        const stored = localStorage.getItem('dre_selected_client');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Verify if the stored client is still valid for this user
            const isValid = clients.find(c => c.id === parsed.id);
            if (isValid) {
              setSelectedClientState(isValid);
            } else {
              setSelectedClientState(null); // Invalid storage, reset
            }
          } catch (e) {
            setSelectedClientState(null);
          }
        } else {
          setSelectedClientState(null); // No storage, force selection
        }
      } else {
        setSelectedClientState(null); // No clients
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
    // Check active session
    const initSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await Promise.all([
            fetchProfile(session.user.id),
            fetchUserClients(session.user.id)
          ]);
        }
        setLoading(false);
    };
    initSession();

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // If switching users or logging in, re-fetch everything
        setLoading(true);
        await Promise.all([
            fetchProfile(session.user.id),
            fetchUserClients(session.user.id)
        ]);
        setLoading(false);
      } else {
        setProfile(null);
        setAvailableClients([]);
        selectClient(null); // Clear selection on logout
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    setAvailableClients([]);
    selectClient(null);
  };

  const value = {
    session,
    user,
    profile,
    loading,
    availableClients,
    selectedClient,
    selectClient,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
