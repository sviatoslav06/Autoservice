import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Database,
  Package,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

type UserRole = 'Client' | 'Manager' | 'Mechanic' | 'Accountant' | 'Admin';

type User = {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  worker?: {
    id: number;
    position: string;
    hourlyRate: string | number;
  } | null;
};

type UserForm = {
  username: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  hourlyRate: string;
};

type MainTab = 'users' | 'processes';
type UserScope = 'all' | UserRole;

const emptyUserForm: UserForm = {
  username: '',
  email: '',
  phone: '',
  password: '',
  role: 'Client',
  hourlyRate: ''
};

const PROCESS_LINKS = [
  { to: '/manager/orders', title: 'Замовлення', description: 'Редагування, скасування та контроль записів', icon: Wrench },
  { to: '/manager/parts', title: 'Деталі', description: 'Склад, категорії та додаткові поля', icon: Package },
  { to: '/manager/services', title: 'Послуги', description: 'Ціни, тривалість і довідник послуг', icon: Settings2 },
  { to: '/manager/bays', title: 'Бокси', description: 'Навантаження та місткість сервісних боксів', icon: Database },
  { to: '/admin/data-import', title: 'Демо-дані', description: 'Завантаження реальних зовнішніх даних', icon: ArrowRight },
];

const ROLE_UI: Record<UserRole, { label: string; badgeClass: string }> = {
  Client: { label: 'Клієнт', badgeClass: 'bg-slate-100 text-slate-700' },
  Manager: { label: 'Менеджер', badgeClass: 'bg-blue-100 text-blue-700' },
  Mechanic: { label: 'Механік', badgeClass: 'bg-emerald-100 text-emerald-700' },
  Accountant: { label: 'Бухгалтер', badgeClass: 'bg-amber-100 text-amber-700' },
  Admin: { label: 'Адміністратор', badgeClass: 'bg-violet-100 text-violet-700' }
};

function getApiErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as {
    response?: {
      data?: {
        message?: string;
      };
    };
  };

  return maybeError?.response?.data?.message || fallback;
}

export const Admin: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>('users');
  const [userScope, setUserScope] = useState<UserScope>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get<User[]>('/users/admin/users');
      setUsers(response.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Не вдалося завантажити користувачів'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesScope = userScope === 'all' || user.role === userScope;
      const matchesSearch = !q
        ? true
        : [user.username, user.email, user.phone ?? '', user.role].join(' ').toLowerCase().includes(q);
      return matchesScope && matchesSearch;
    });
  }, [search, userScope, users]);

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      phone: user.phone ?? '',
      password: '',
      role: user.role,
      hourlyRate: user.worker?.hourlyRate ? String(user.worker.hourlyRate) : ''
    });
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userForm.username.trim()) {
      toast.error('Вкажи username');
      return;
    }

    if (!editingUser && !userForm.email.trim()) {
      toast.error('Для нового користувача потрібен email');
      return;
    }

    if (!editingUser && !userForm.password.trim()) {
      toast.error('Для нового користувача потрібен пароль');
      return;
    }

    if (['Manager', 'Mechanic'].includes(userForm.role)) {
      const parsedRate = Number(userForm.hourlyRate);
      if (!Number.isFinite(parsedRate) || parsedRate < 0) {
        toast.error('Для ролі працівника вкажи коректну погодинну ставку');
        return;
      }
    }

    const payload: Record<string, unknown> = {
      username: userForm.username.trim(),
      phone: userForm.phone.trim() || undefined,
      role: userForm.role
    };

    if (editingUser) {
      payload.email = editingUser.email;
    } else {
      payload.email = userForm.email.trim();
      if (userForm.password.trim()) {
        payload.password = userForm.password;
      }
    }

    if (['Manager', 'Mechanic'].includes(userForm.role)) {
      payload.hourlyRate = Number(userForm.hourlyRate);
    }

    try {
      if (editingUser) {
        await api.put(`/users/admin/users/${editingUser.id}`, payload);
        toast.success('Користувача оновлено');
      } else {
        await api.post('/users/admin/users', payload);
        toast.success('Користувача створено');
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm(emptyUserForm);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Не вдалося зберегти користувача'));
    }
  };

  const removeUser = async (id: number) => {
    if (currentUser?.id === id) {
      toast.error('Не можна видалити поточного адміністратора');
      return;
    }

    if (!confirm('Видалити цього користувача?')) return;

    try {
      await api.delete(`/users/admin/users/${id}`);
      setUsers((current) => current.filter((user) => user.id !== id));
      toast.success('Користувача видалено');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Не вдалося видалити користувача'));
    }
  };

  const summary = useMemo(() => {
    const workers = users.filter((user) => user.role === 'Manager' || user.role === 'Mechanic');
    return {
      total: users.length,
      clients: users.filter((user) => user.role === 'Client').length,
      workers: workers.length,
      admins: users.filter((user) => user.role === 'Admin').length
    };
  }, [users]);

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="flex">
        <aside className="hidden min-h-screen w-72 border-r border-gray-200 bg-white lg:block">
          <div className="p-6">
            <h2 className="mb-2 text-xl font-bold text-gray-900">Адміністрування</h2>
            <p className="mb-6 text-sm text-gray-500">Користувачі, ролі та ключові процеси системи.</p>
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full rounded-lg px-4 py-3 text-left ${activeTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Користувачі
              </button>
              <button
                onClick={() => setActiveTab('processes')}
                className={`w-full rounded-lg px-4 py-3 text-left ${activeTab === 'processes' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Процеси
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-8">
          {activeTab === 'users' && (
            <>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Користувачі</h1>
                  <p className="text-gray-600">Управління доступом та ролями</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    <span>Оновити</span>
                  </button>
                  <button
                    onClick={openCreateUser}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    <Users className="h-4 w-4" />
                    <span>Додати користувача</span>
                  </button>
                </div>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Усього" value={summary.total} hint="Користувачів у системі" />
                <SummaryCard title="Клієнти" value={summary.clients} hint="З роллю Client" />
                <SummaryCard title="Працівники" value={summary.workers} hint="Менеджери + механіки" />
                <SummaryCard title="Адміністратори" value={summary.admins} hint="Повний доступ" icon={<ShieldCheck className="h-4 w-4" />} />
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {(['all', 'Client', 'Manager', 'Mechanic', 'Accountant', 'Admin'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setUserScope(scope)}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${userScope === scope ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    {scope === 'all'
                      ? 'Усі'
                      : scope === 'Client'
                        ? 'Клієнти'
                        : scope === 'Manager'
                          ? 'Менеджери'
                          : scope === 'Mechanic'
                            ? 'Механіки'
                            : scope === 'Accountant'
                              ? 'Бухгалтери'
                              : 'Адміністратори'}
                  </button>
                ))}
              </div>

              <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Пошук користувачів..."
                    className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Користувач</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Телефон</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Роль</th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                            Завантаження адмін-панелі...
                          </td>
                        </tr>
                      )}

                      {!loading && filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                            Нічого не знайдено за поточними фільтрами.
                          </td>
                        </tr>
                      )}

                      {!loading && filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{user.username}</p>
                                {user.worker && (
                                  <p className="text-xs text-gray-500">
                                    {ROLE_UI[user.worker.position as UserRole]?.label || user.worker.position} · {Number(user.worker.hourlyRate)} грн/год
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{user.phone || '—'}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${ROLE_UI[user.role].badgeClass}`}>
                              {ROLE_UI[user.role].label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditUser(user)}
                                className="rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                              >
                                Редагувати
                              </button>
                              <button
                                onClick={() => removeUser(user.id)}
                                disabled={currentUser?.id === user.id}
                                className="rounded-lg border border-red-600 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'processes' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Процеси</h1>
                <p className="text-gray-600">Швидкий доступ до керування сервісом</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {PROCESS_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                          <item.icon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingUser ? 'Редагувати користувача' : 'Додати користувача'}
              </h2>
              <button onClick={() => setShowUserModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
                  <input
                    value={userForm.username}
                    onChange={(event) => setUserForm((state) => ({ ...state, username: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    disabled={Boolean(editingUser)}
                    value={editingUser ? editingUser.email : userForm.email}
                    onChange={(event) => setUserForm((state) => ({ ...state, email: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Телефон</label>
                  <input
                    value={userForm.phone}
                    onChange={(event) => setUserForm((state) => ({ ...state, phone: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Роль</label>
                  <select
                    value={userForm.role}
                    onChange={(event) =>
                      setUserForm((state) => ({
                        ...state,
                        role: event.target.value as UserRole,
                        hourlyRate:
                          ['Manager', 'Mechanic'].includes(event.target.value)
                            ? state.hourlyRate
                            : ''
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  >
                    <option value="Client">Клієнт</option>
                    <option value="Manager">Менеджер</option>
                    <option value="Mechanic">Механік</option>
                    <option value="Accountant">Бухгалтер</option>
                    <option value="Admin">Адміністратор</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) => setUserForm((state) => ({ ...state, password: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              )}

              {['Manager', 'Mechanic'].includes(userForm.role) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ставка за годину</label>
                  <input
                    type="number"
                    min={0}
                    value={userForm.hourlyRate}
                    onChange={(event) =>
                      setUserForm((state) => ({ ...state, hourlyRate: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <button
                  onClick={saveUser}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
                >
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SummaryCard({
  title,
  value,
  hint,
  icon
}: {
  title: string;
  value: number;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        {icon ? <div className="rounded-xl bg-gray-100 p-2 text-gray-700">{icon}</div> : null}
      </div>
    </div>
  );
}
