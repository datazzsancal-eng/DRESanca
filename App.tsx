
import React from 'react';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import ClientSelectionPage from './components/ClientSelectionPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const { session, loading, selectedClient, availableClients } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-300">
        <div className="flex flex-col items-center">
            <div className="w-12 h-12 mb-4 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
            <p>Carregando sistema...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-gray-900 min-h-screen text-gray-300">
        <LoginPage />
      </div>
    );
  }

  // Logged in, but no client selected yet (and multiple are available)
  if (!selectedClient) {
     // If user has no clients at all, ClientSelectionPage handles the empty state message
     return (
        <div className="bg-gray-900 min-h-screen text-gray-300">
           <ClientSelectionPage />
        </div>
     );
  }

  // Logged in and Client selected
  return (
    <div className="bg-gray-900 min-h-screen text-gray-300">
      <DashboardPage />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
