import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Briefcase, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

type Service = {
  id: number;
  name: string;
  description?: string | null;
  standardPrice: string | number;
  durationMinutes: number;
};

type ServiceForm = {
  name: string;
  description: string;
  standardPrice: string;
  durationMinutes: string;
};

const emptyForm: ServiceForm = {
  name: '',
  description: '',
  standardPrice: '',
  durationMinutes: ''
};

function money(value: string | number) {
  return `${Number(value || 0).toLocaleString('uk-UA')} грн`;
}

export const ManagerServices: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Service | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const loadServices = async () => {
    try {
      const response = await api.get<Service[]>('/services');
      setServices(response.data);
    } catch (error) {
      toast.error('Не вдалося завантажити послуги');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) =>
      [service.name, service.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [search, services]);

  const stats = useMemo(() => {
    const totalDuration = services.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0);
    const avgPrice = services.length
      ? Math.round(services.reduce((sum, service) => sum + Number(service.standardPrice || 0), 0) / services.length)
      : 0;

    return {
      total: services.length,
      avgPrice,
      totalDuration
    };
  }, [services]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description ?? '',
      standardPrice: String(service.standardPrice),
      durationMinutes: String(service.durationMinutes)
    });
    setShowModal(true);
  };

  const saveService = async () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      standardPrice: Number(form.standardPrice),
      durationMinutes: Number(form.durationMinutes)
    };

    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, payload);
        toast.success('Послугу оновлено');
      } else {
        await api.post('/services', payload);
        toast.success('Послугу додано');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadServices();
    } catch (error) {
      toast.error('Не вдалося зберегти послугу');
    }
  };

  const removeService = async (id: number) => {
    if (!confirm('Видалити цю послугу?')) return;

    try {
      await api.delete(`/services/${id}`);
      setServices((current) => current.filter((service) => service.id !== id));
      toast.success('Послугу видалено');
    } catch (error) {
      toast.error('Не вдалося видалити послугу');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Завантаження послуг...</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Управління послугами</h1>
            <p className="text-sm sm:text-base text-gray-600">Каталог робіт, ціни та нормативний час</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Додати послугу</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Послуг</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Середня ціна</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{money(stats.avgPrice)}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Сумарна тривалість</p>
            <p className="mt-1 text-xl font-bold text-violet-700">{stats.totalDuration} хв</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук послуг..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {filtered.map((service) => (
          <div
            key={service.id}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.durationMinutes} хв</p>
                </div>
              </div>
              <div className="text-lg font-bold text-gray-900">{money(service.standardPrice)}</div>
            </div>

            <p className="mt-4 text-sm text-gray-600 min-h-12">{service.description || 'Без опису'}</p>

            <div className="mt-5 flex gap-2 border-t pt-4">
              <button
                onClick={() => openEdit(service)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
              >
                <Edit2 className="w-4 h-4" />
                <span>Редагувати</span>
              </button>
              <button
                onClick={() => removeService(service.id)}
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
          Послуг не знайдено
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editing ? 'Редагувати послугу' : 'Додати послугу'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, description: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ціна</label>
                  <input
                    type="number"
                    value={form.standardPrice}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, standardPrice: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тривалість, хв</label>
                  <input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, durationMinutes: event.target.value }))
                    }
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
                  onClick={saveService}
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
