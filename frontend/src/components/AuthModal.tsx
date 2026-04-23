import React, { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { login } = useAuth();

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      toast.success('Вхід успішний!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Невірний email або пароль');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/register', { username, email, password });
      login(res.data.token, res.data.user);
      toast.success('Реєстрація успішна!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка реєстрації');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4">
        {/* Закрити */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-5 text-center font-medium text-lg ${tab === 'login' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}
          >
            Вхід
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-5 text-center font-medium text-lg ${tab === 'register' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}
          >
            Реєстрація
          </button>
        </div>

        <div className="p-8">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="text-sm font-medium block mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
                  placeholder="client@test.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
                  placeholder="123456"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors"
              >
                Увійти
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <label className="text-sm font-medium block mb-2">Ім’я користувача</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors"
              >
                Зареєструватися
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};