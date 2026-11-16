import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { isAdminSession } from './auth';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import RoutesPage from './pages/Routes';
import Fares from './pages/Fares';
import Monitoring from './pages/Monitoring';
import Reports from './pages/Reports';
import Issues from './pages/Issues';

const SESSION_KEY = 'talabyahe_admin';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    return isAdminSession(saved) ? saved : null;
  });

  const login = (username) => {
    localStorage.setItem(SESSION_KEY, username);
    setUser(username);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <Layout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/fares" element={<Fares />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/support" element={<Issues />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
