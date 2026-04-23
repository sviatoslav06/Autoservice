import React, { useEffect, useState } from 'react';
import { Mail, Phone, Shield, User, Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

type ProfileData = {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  role: 'Client' | 'Manager' | 'Mechanic' | 'Accountant' | 'Admin';
};

export const Profile: React.FC = () => {
  const { user, login, token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get<ProfileData>('/auth/me');
        setProfile(response.data);
        setForm({
          username: response.data.username,
          phone: response.data.phone ?? ''
        });
      } catch (error) {
        toast.error('Не вдалося завантажити профіль');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    try {
      const response = await api.put<ProfileData>('/auth/me', {
        username: form.username.trim(),
        phone: form.phone.trim() || undefined
      });

      setProfile(response.data);
      if (token) {
        login(token, {
          id: response.data.id,
          username: response.data.username,
          email: response.data.email,
          phone: response.data.phone,
          role: response.data.role
        });
      }
      toast.success('Профіль оновлено успішно');
    } catch (error) {
      toast.error('Не вдалося оновити профіль');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (event: React.FormEvent) => {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Заповніть всі поля пароля');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Новий пароль має містити мінімум 6 символів');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Підтвердження пароля не співпадає');
      return;
    }

    toast.message('Зміна пароля буде доступна після додавання API-ендпоінта');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Завантаження профілю...</div>;
  }

  if (!profile && !user) {
    return null;
  }

  const current = profile ?? {
    id: user!.id,
    username: user!.username,
    email: user!.email,
    phone: user!.phone ?? '',
    role: user!.role
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Мій профіль</h1>
          <p className="text-gray-600">Керуйте вашими особистими даними</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-20 h-20 bg-blue-100 text-blue-600 rounded-full text-3xl font-bold">
              {current.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{current.username}</h2>
              <p className="text-gray-600">{current.role}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4" />
                <span>Ім'я користувача</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm((state) => ({ ...state, username: event.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </label>
              <input
                type="email"
                value={current.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4" />
                <span>Телефон</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((state) => ({ ...state, phone: event.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Shield className="w-4 h-4" />
                <span>Роль</span>
              </label>
              <input
                type="text"
                value={current.role}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Збереження...' : 'Зберегти зміни'}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Зміна пароля</h3>
          <form className="space-y-4" onSubmit={handlePasswordChange}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Поточний пароль</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((state) => ({ ...state, currentPassword: event.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Новий пароль</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((state) => ({ ...state, newPassword: event.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Підтвердження нового пароля</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((state) => ({ ...state, confirmPassword: event.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Змінити пароль
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
