import React, { useEffect, useMemo, useState } from 'react';
import { Box, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

type Bay = {
  id: number;
  boxNumber: string;
  status: 'free' | 'busy' | 'maintenance';
  capacity: number;
};

type BayForm = {
  boxNumber: string;
  status: Bay['status'];
  capacity: string;
};

const emptyForm: BayForm = {
  boxNumber: '',
  status: 'free',
  capacity: '1'
};

export const ManagerBays: React.FC = () => {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Bay | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<BayForm>(emptyForm);

  const loadBays = async () => {
    try {
      const response = await api.get<Bay[]>('/boxes');
      setBays(response.data);
    } catch (error) {
      toast.error('Не вдалося завантажити бокси');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBays();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bays;
    return bays.filter((bay) =>
      [bay.boxNumber, bay.status].join(' ').toLowerCase().includes(q)
    );
  }, [search, bays]);

  const bayStats = useMemo(() => {
    const free = bays.filter((bay) => bay.status === 'free').length;
    const busy = bays.filter((bay) => bay.status === 'busy').length;
    const maintenance = bays.filter((bay) => bay.status === 'maintenance').length;
    const capacity = bays.reduce((sum, bay) => sum + bay.capacity, 0);

    return {
      total: bays.length,
      free,
      busy,
      maintenance,
      capacity
    };
  }, [bays]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (bay: Bay) => {
    setEditing(bay);
    setForm({
      boxNumber: bay.boxNumber,
      status: bay.status,
      capacity: String(bay.capacity)
    });
    setShowModal(true);
  };

  const saveBay = async () => {
    const payload = {
      boxNumber: form.boxNumber.trim(),
      status: form.status,
      capacity: Number(form.capacity)
    };

    try {
      if (editing) {
        await api.put(`/boxes/${editing.id}`, payload);
        toast.success('Бокс оновлено');
      } else {
        await api.post('/boxes', payload);
        toast.success('Бокс додано');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadBays();
    } catch (error) {
      toast.error('Не вдалося зберегти бокс');
    }
  };

  const removeBay = async (id: number) => {
    if (!confirm('Видалити цей бокс?')) return;

    try {
      await api.delete(`/boxes/${id}`);
      setBays((current) => current.filter((bay) => bay.id !== id));
      toast.success('Бокс видалено');
    } catch (error) {
      toast.error('Не вдалося видалити бокс');
    }
  };

  const statusClass = (status: Bay['status']) => {
    if (status === 'free') return 'bg-green-100 text-green-700';
    if (status === 'busy') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-700';
  };

  const statusLabel = (status: Bay['status']) => {
    if (status === 'free') return 'Вільний';
    if (status === 'busy') return 'Зайнятий';
    return 'На обслуговуванні';
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Завантаження боксів...</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Управління боксами</h1>
            <p className="text-sm sm:text-base text-gray-600">Контроль боксів, їх статусу та місткості</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Додати бокс</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Всього</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{bayStats.total}</p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Вільні</p>
            <p className="mt-1 text-xl font-bold text-green-700">{bayStats.free}</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Зайняті</p>
            <p className="mt-1 text-xl font-bold text-orange-700">{bayStats.busy}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Сервіс</p>
            <p className="mt-1 text-xl font-bold text-gray-700">{bayStats.maintenance}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Місткість</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{bayStats.capacity}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук боксів..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {filtered.map((bay) => (
          <div
            key={bay.id}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bay.status === 'free' ? 'bg-green-100' : bay.status === 'busy' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                  <Box className={`w-6 h-6 ${bay.status === 'free' ? 'text-green-600' : bay.status === 'busy' ? 'text-orange-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{bay.boxNumber}</h3>
                  <p className="text-sm text-gray-500">Вмістимість {bay.capacity}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(bay.status)}`}>
                {statusLabel(bay.status)}
              </span>
            </div>

            <div className="mt-5 flex gap-2 border-t pt-4">
              <button
                onClick={() => openEdit(bay)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
              >
                <Edit2 className="w-4 h-4" />
                <span>Редагувати</span>
              </button>
              <button
                onClick={() => removeBay(bay.id)}
                className="inline-flex items-center justify-center rounded-lg border border-red-600 px-4 py-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!filtered.length && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
          Боксів не знайдено
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editing ? 'Редагувати бокс' : 'Додати бокс'}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер боксу</label>
                <input
                  value={form.boxNumber}
                  onChange={(event) => setForm((state) => ({ ...state, boxNumber: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, status: event.target.value as Bay['status'] }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  >
                    <option value="free">free</option>
                    <option value="busy">busy</option>
                    <option value="maintenance">maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Вмістимість</label>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(event) => setForm((state) => ({ ...state, capacity: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <button
                  onClick={saveBay}
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
