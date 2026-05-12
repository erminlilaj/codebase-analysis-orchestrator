import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

export const Layout: React.FC = () => (
  <div className="min-h-screen flex flex-col">
    <header className="bg-slate-900 text-slate-100 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
        <Link to="/" className="font-semibold text-lg tracking-tight">
          <span className="text-violet-400">▸</span>{' '}
          codebase-analysis-orchestrator
        </Link>
        <nav className="flex gap-2 text-sm">
          <NavTab to="/projects">Projects</NavTab>
          <NavTab to="/questions">Questions</NavTab>
        </nav>
      </div>
    </header>
    <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
      <Outlet />
    </main>
    <footer className="border-t border-slate-200 text-xs text-slate-500 py-3 text-center">
      Local dev · single-user · /api at <code>http://127.0.0.1:3000</code>
    </footer>
  </div>
);

const NavTab: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `px-3 py-1.5 rounded-md transition ${
        isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`
    }
  >
    {children}
  </NavLink>
);
