import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { AppProvider, useApp } from './hooks/useApp';
import Dashboard from './pages/Dashboard';
import MyCards from './pages/MyCards';
import Offers from './pages/Offers';
import EmailSync from './pages/EmailSync';
import BestCard from './pages/BestCard';
import Settings from './pages/Settings';
import {
  LayoutDashboard, CreditCard, Tag, Mail, Zap, Settings as SettingsIcon
} from 'lucide-react';
import './styles.css';

function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} key={toast.id}>
      {toast.message}
    </div>
  );
}

function NavBar() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/cards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CreditCard size={20} />
        <span>Cards</span>
      </NavLink>
      <NavLink to="/offers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Tag size={20} />
        <span>Offers</span>
      </NavLink>
      <NavLink to="/email" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Mail size={20} />
        <span>Email</span>
      </NavLink>
      <NavLink to="/bestcard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Zap size={20} />
        <span>Best Card</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <SettingsIcon size={20} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cards" element={<MyCards />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/email" element={<EmailSync />} />
          <Route path="/bestcard" element={<BestCard />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
      <NavBar />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AppProvider>
  );
}
