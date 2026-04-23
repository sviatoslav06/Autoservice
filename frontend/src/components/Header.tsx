import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  Box,
  Briefcase,
  Calendar,
  Car,
  ClipboardList,
  DollarSign,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  User,
  Wrench,
  X
} from 'lucide-react';

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const handleLogout = () => {
    setShowDropdown(false);
    setShowMobileMenu(false);
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const navItems: NavItem[] = (() => {
    switch (user.role) {
      case 'Client':
        return [
          { path: '/', label: 'Головна', icon: Home },
          { path: '/my-orders', label: 'Мої замовлення', icon: ClipboardList },
          { path: '/my-vehicles', label: 'Мої авто', icon: Car },
          { path: '/booking', label: 'Записатися', icon: Calendar }
        ];
      case 'Manager':
        return [
          { path: '/', label: 'Дашборд', icon: Home },
          { path: '/manager/orders', label: 'Замовлення', icon: ClipboardList },
          { path: '/manager/parts', label: 'Деталі', icon: Package },
          { path: '/manager/services', label: 'Послуги', icon: Briefcase },
          { path: '/manager/bays', label: 'Бокси', icon: Box }
        ];
      case 'Mechanic':
        return [
          { path: '/', label: 'Головна', icon: Home },
          { path: '/mechanic/workplace', label: 'Робоче місце', icon: Wrench }
        ];
      case 'Admin':
        return [
          { path: '/', label: 'Дашборд', icon: Home },
          { path: '/admin', label: 'Адміністрування', icon: Settings },
          { path: '/analytics', label: 'Аналітика', icon: BarChart3 }
        ];
      case 'Accountant':
        return [
          { path: '/', label: 'Дашборд', icon: Home },
          { path: '/finance', label: 'Фінанси', icon: DollarSign },
          { path: '/analytics', label: 'Аналітика', icon: BarChart3 }
        ];
      default:
        return [{ path: '/', label: 'Головна', icon: Home }];
    }
  })();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-semibold">
              AS
            </div>
            <span className="font-semibold text-lg tracking-tight">Автосервіс</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <Link to="/profile" className="transition-colors hover:text-foreground">
              Профіль
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground leading-tight">{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowDropdown((prev) => !prev)}
                className="w-10 h-10 rounded-xl bg-muted text-foreground flex items-center justify-center font-semibold hover:bg-accent transition-colors"
                aria-label="Відкрити меню профілю"
              >
                {user.username?.[0]?.toUpperCase() || 'U'}
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowDropdown(false)}
                  >
                    <User className="w-4 h-4" />
                    <span>Профіль</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Вийти</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowMobileMenu((prev) => !prev)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Перемкнути мобільне меню"
          >
            {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {showMobileMenu && (
          <nav className="md:hidden py-3 border-t border-gray-200 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <Link
              to="/profile"
              onClick={() => setShowMobileMenu(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              <User className="w-4 h-4" />
              <span>Профіль</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Вийти</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
