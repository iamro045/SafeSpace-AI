import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/dashboard";
import ContentReview from "@/pages/content-review";
import Users from "@/pages/users";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import SocialDemo from "@/pages/social-demo";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// Simple auth state management
interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token'),
    isAuthenticated: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Simulate getting user from token
      const mockUser = {
        id: '1',
        username: 'admin',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'admin@projectclean.com',
        role: 'admin',
        profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=32&h=32',
      };
      setAuthState({ user: mockUser, token, isAuthenticated: true });
    }
  }, []);

  // Simple login function for demo
  const login = (email: string, password: string) => {
    if (email === 'admin@projectclean.com' && password === 'admin') {
      const mockUser = {
        id: '1',
        username: 'admin',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'admin@projectclean.com',
        role: 'admin',
        profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=32&h=32',
      };
      const token = 'mock-jwt-token';
      localStorage.setItem('auth_token', token);
      setAuthState({ user: mockUser, token, isAuthenticated: true });
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setAuthState({ user: null, token: null, isAuthenticated: false });
  };

  return (
    <div className="auth-context">
      {authState.isAuthenticated ? (
        <div className="flex h-screen bg-background">
          <Sidebar user={authState.user} />
          <div className="flex-1 flex flex-col">
            <Header user={authState.user} onLogout={logout} />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <LoginPage onLogin={login} />
      )}
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => boolean }) {
  const [email, setEmail] = useState('admin@projectclean.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLogin(email, password)) {
      setError('');
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-shield-alt text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project Clean</h1>
              <p className="text-sm text-gray-500">Content Moderation System</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Sign in to your account</h2>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              data-testid="input-email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              data-testid="input-password"
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            data-testid="button-login"
          >
            Sign in
          </button>
        </form>
        <div className="text-center text-sm text-gray-600">
          Demo credentials: admin@projectclean.com / admin
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/content-review" component={ContentReview} />
      <Route path="/users" component={Users} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/social-demo" component={SocialDemo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
