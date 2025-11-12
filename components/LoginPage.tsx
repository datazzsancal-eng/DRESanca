import React from 'react';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
            <img 
              src="https://www.sancal.com.br/wp-content/uploads/elementor/thumbs/logo-white-qfydekyggou3snwsfrlsc913ym97p1hveemqwoinls.png" 
              alt="Sancal Logo" 
              className="h-10 w-auto mx-auto"
            />
          <h1 className="mt-4 text-2xl font-bold text-white">DRE View</h1>
          <p className="text-sm text-gray-400">Faça login para acessar seu dashboard.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-300 sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 text-white placeholder-gray-400 bg-gray-700 border border-gray-600 rounded-md appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="E-mail"
              defaultValue="admin@sancal.com"
            />
          </div>
          <div>
            <label htmlFor="password"className="text-sm font-medium text-gray-300 sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 text-white placeholder-gray-400 bg-gray-700 border border-gray-600 rounded-md appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Senha"
              defaultValue="password"
            />
          </div>
          <button
            type="submit"
            className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;