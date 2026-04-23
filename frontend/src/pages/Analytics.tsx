import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  Download,
  DollarSign,
  Filter,
  Package,
  Search,
  Settings2,
  TrendingUp,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

type DashboardTimelineEntry = {
  date: string;
  ordersCount: number;
  completedOrders: number;
  revenue: string | number;
};

type DashboardSummary = {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  uniqueClients?: number;
  totalRevenue: string | number;
  collectedRevenue: string | number;
  outstandingRevenue: string | number;
  partsExpense: string | number;
  laborExpense: string | number;
  averageCheck: string | number;
  completionRate: number;
  paidRate: number;
};

type DashboardResponse = {
  filters: Record<string, unknown>;
  timeline: DashboardTimelineEntry[];
  summary: DashboardSummary;
  topServices: Array<{ id: number; name: string; count: number; revenue: string | number }>;
  topParts: Array<{
    id: number;
    name: string;
    category: string;
    quantity: number;
    cost: string | number;
  }>;
  workerLoad: Array<{
    id: number;
    username: string;
    jobsCount: number;
    minutes: number;
    earned: string | number;
  }>;
};

type ForecastResponse = {
  historicalDays: number;
  forecastDays: number;
  historical: {
    completedOrders: number;
    partsExpense: string | number;
    laborExpense: string | number;
    totalExpense: string | number;
    totalRevenue: string | number;
  };
  forecast: {
    projectedOrders: string | number;
    projectedRevenue: string | number;
    projectedTotalExpense: string | number;
    projectedLaborExpense: string | number;
    projectedMaterialExpense: string | number;
    projectedOperatingMargin: string | number;
    averageDailyOrders: string | number;
    averageDailyRevenue: string | number;
    averageDailyExpense: string | number;
    trendMultiplier: number;
  };
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  boxId: string;
  workerId: string;
  serviceId: string;
};

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const initialDateTo = new Date();
const initialDateFrom = new Date();
initialDateFrom.setDate(initialDateFrom.getDate() - 29);

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(
    Math.round(toNumber(value))
  );
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const Analytics: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastDays, setForecastDays] = useState<'30' | '90' | '180' | '365'>('90');
  const [partsSort, setPartsSort] = useState<'cost' | 'quantity'>('cost');
  const [servicesSort, setServicesSort] = useState<'count' | 'revenue'>('count');
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: formatDateInput(initialDateFrom),
    dateTo: formatDateInput(initialDateTo),
    boxId: '',
    workerId: '',
    serviceId: ''
  });
  const [availableBoxes, setAvailableBoxes] = useState<Array<{ id: number; boxNumber: string }>>([]);
  const [availableWorkers, setAvailableWorkers] = useState<Array<{ id: number; user: { username: string } }>>([]);
  const [availableServices, setAvailableServices] = useState<Array<{ id: number; name: string }>>([]);
  const [serviceSearch, setServiceSearch] = useState('');

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      try {
        const [boxesResponse, workersResponse, servicesResponse] = await Promise.all([
          api.get('/boxes'),
          api.get('/workers/mechanics'),
          api.get('/services')
        ]);

        if (!active) return;
        setAvailableBoxes(boxesResponse.data);
        setAvailableWorkers(workersResponse.data);
        setAvailableServices(servicesResponse.data);
      } catch {
        if (active) {
          setAvailableBoxes([]);
          setAvailableWorkers([]);
          setAvailableServices([]);
        }
      }
    };

    loadLookups();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          boxId: filters.boxId ? Number(filters.boxId) : undefined,
          workerId: filters.workerId ? Number(filters.workerId) : undefined,
          serviceId: filters.serviceId ? Number(filters.serviceId) : undefined
        };
        const response = await api.get<DashboardResponse>('/analytics/dashboard', { params });
        if (!active) return;
        setDashboard(response.data);
      } catch {
        if (!active) return;
        setDashboard(null);
        setError('Не вдалося завантажити аналітику, показуємо порожній стан.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    let active = true;

    const loadForecast = async () => {
      setForecastLoading(true);

      try {
        const response = await api.get<ForecastResponse>('/analytics/forecast', {
          params: { forecastDays: Number(forecastDays) }
        });
        if (!active) return;
        setForecast(response.data);
      } catch {
        if (!active) return;
        setForecast(null);
      } finally {
        if (active) setForecastLoading(false);
      }
    };

    loadForecast();

    return () => {
      active = false;
    };
  }, [forecastDays]);

  const chartData = useMemo(
    () =>
      (dashboard?.timeline ?? []).map((entry) => ({
        date: entry.date,
        orders: entry.ordersCount,
        revenue: Math.round(toNumber(entry.revenue))
      })),
    [dashboard]
  );

  const topParts = useMemo(() => {
    const parts = [...(dashboard?.topParts ?? [])];
    parts.sort((left, right) =>
      partsSort === 'quantity'
        ? right.quantity - left.quantity
        : toNumber(right.cost) - toNumber(left.cost)
    );
    return parts;
  }, [dashboard, partsSort]);

  const topServices = useMemo(() => {
    const services = [...(dashboard?.topServices ?? [])];
    services.sort((left, right) =>
      servicesSort === 'revenue'
        ? toNumber(right.revenue) - toNumber(left.revenue)
        : right.count - left.count
    );
    return services;
  }, [dashboard, servicesSort]);

  const filteredAvailableServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return availableServices;

    return availableServices.filter((service) => service.name.toLowerCase().includes(q));
  }, [availableServices, serviceSearch]);

  const exportPayload = {
    filters,
    summary: dashboard?.summary ?? null,
    timeline: dashboard?.timeline ?? [],
    topServices,
    topParts,
    forecast: forecast?.forecast ?? null
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {error && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white">
            <BarChart3 className="h-4 w-4" />
            Аналітика для бухгалтера та адміна
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Аналітика автосервісу</h1>
          <p className="mt-2 text-lg text-gray-600">
            Дохід, кількість замовлень, попит на послуги та деталізація по запасах у зрозумілому вигляді.
          </p>
        </div>

        <button
          onClick={() => downloadJson(`analytics-report-${filters.dateFrom}-${filters.dateTo}.json`, exportPayload)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-700"
        >
          <Download className="h-5 w-5" />
          Експорт звіту
        </button>
      </div>

      <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Фільтри</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Дата від</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Дата до</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Бокс</span>
            <select
              value={filters.boxId}
              onChange={(event) => setFilters((current) => ({ ...current, boxId: event.target.value }))}
              className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
            >
              <option value="">Усі</option>
              {availableBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.boxNumber}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Механік</span>
            <select
              value={filters.workerId}
              onChange={(event) => setFilters((current) => ({ ...current, workerId: event.target.value }))}
              className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
            >
              <option value="">Усі</option>
              {availableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.user.username}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Послуга</span>
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Пошук послуги..."
                  className="w-full rounded-2xl border border-gray-300 px-10 py-2.5"
                />
              </div>
              <select
                value={filters.serviceId}
                onChange={(event) => setFilters((current) => ({ ...current, serviceId: event.target.value }))}
                className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
              >
                <option value="">Усі</option>
                {filteredAvailableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard
          title="Дохід"
          value={dashboard ? formatMoney(dashboard.summary.totalRevenue) : '0'}
          icon={<DollarSign className="h-6 w-6 text-blue-600" />}
          hint={loading ? 'Оновлення...' : 'З урахуванням фільтрів'}
        />
        <StatCard
          title="Замовлення"
          value={dashboard?.summary.totalOrders ?? 0}
          icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
          hint={`Виконано: ${dashboard?.summary.completedOrders ?? 0}`}
        />
        <StatCard
          title="Клієнти"
          value={dashboard?.summary.uniqueClients ?? 0}
          icon={<Users className="h-6 w-6 text-purple-600" />}
          hint="У вибраному періоді"
        />
        <StatCard
          title="Витрати"
          value={
            dashboard
              ? formatMoney(toNumber(dashboard.summary.partsExpense) + toNumber(dashboard.summary.laborExpense))
              : '0'
          }
          icon={<Package className="h-6 w-6 text-orange-600" />}
          hint="Деталі + робота"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Дохід і замовлення по днях</h2>
              <p className="text-sm text-gray-500">Графік реагує на всі фільтри вище</p>
            </div>
            <CalendarDays className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="orders"
                stroke="#2563EB"
                strokeWidth={2}
                dot={false}
                name="Замовлення"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Дохід"
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Прогноз доходів і витрат</h2>
              <p className="text-sm text-gray-500">Окремий прогноз, не залежить від загальних фільтрів</p>
            </div>
            <Settings2 className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(['30', '90', '180', '365'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setForecastDays(value)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${forecastDays === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {value === '30' ? '1 місяць' : value === '90' ? '3 місяці' : value === '180' ? '6 місяців' : '1 рік'}
              </button>
            ))}
          </div>

          {forecastLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              Завантаження прогнозу...
            </div>
          ) : forecast ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ForecastCard label="Прогноз доходу" value={formatMoney(forecast.forecast.projectedRevenue)} tone="green" unit="₴" />
                <ForecastCard label="Прогноз витрат" value={formatMoney(forecast.forecast.projectedTotalExpense)} tone="orange" unit="₴" />
                <ForecastCard label="Очікувані замовлення" value={formatMoney(forecast.forecast.projectedOrders)} tone="blue" />
                <ForecastCard label="Очікуваний баланс" value={formatMoney(forecast.forecast.projectedOperatingMargin)} tone="purple" unit="₴" />
              </div>
              <p className="text-xs text-gray-500">
                Прогноз базується на середньому денному обсязі та останньому тренді, тому він змінюється разом із реальними даними.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              Немає даних для прогнозу.
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Деталі</h2>
              <p className="text-sm text-gray-500">Сортування для швидкого пошуку по складу</p>
            </div>
            <select
              value={partsSort}
              onChange={(event) => setPartsSort(event.target.value as 'cost' | 'quantity')}
              className="rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="cost">За витратами</option>
              <option value="quantity">За кількістю</option>
            </select>
          </div>

          <div className="space-y-3">
            {topParts.slice(0, 6).map((part, index) => (
              <div key={part.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                      {index + 1}
                    </span>
                    {part.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{part.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatMoney(part.cost)} ₴</p>
                  <p className="text-xs text-gray-500">{part.quantity} шт.</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Послуги</h2>
              <p className="text-sm text-gray-500">Сортування за кількістю або доходом</p>
            </div>
            <select
              value={servicesSort}
              onChange={(event) => setServicesSort(event.target.value as 'count' | 'revenue')}
              className="rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="count">За кількістю</option>
              <option value="revenue">За доходом</option>
            </select>
          </div>

          <div className="space-y-3">
            {topServices.slice(0, 6).map((service, index) => (
              <div key={service.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                      {index + 1}
                    </span>
                    {service.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{service.count} замовлень</p>
                </div>
                <p className="font-semibold text-gray-900">{formatMoney(service.revenue)} ₴</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Фінальна зведена статистика</h2>
            <p className="text-sm text-gray-500">Показники по вибраному діапазону дат</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            {dashboard?.summary.completionRate ? Math.round(dashboard.summary.completionRate) : 0}% завершення
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Показник</th>
                <th className="px-4 py-3">Значення</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3">Середній чек</td>
                <td className="px-4 py-3 font-medium">{formatMoney(dashboard?.summary.averageCheck ?? 0)} ₴</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Зібрано коштів</td>
                <td className="px-4 py-3 font-medium">{formatMoney(dashboard?.summary.collectedRevenue ?? 0)} ₴</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Несплачені суми</td>
                <td className="px-4 py-3 font-medium">{formatMoney(dashboard?.summary.outstandingRevenue ?? 0)} ₴</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Витрати на роботу</td>
                <td className="px-4 py-3 font-medium">{formatMoney(dashboard?.summary.laborExpense ?? 0)} ₴</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

function StatCard({
  title,
  value,
  hint,
  icon
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3">{icon}</div>
      </div>
    </div>
  );
}

function ForecastCard({
  label,
  value,
  tone,
  unit
}: {
  label: string;
  value: string;
  tone: 'green' | 'orange' | 'blue' | 'purple';
  unit?: string;
}) {
  const toneClasses: Record<'green' | 'orange' | 'blue' | 'purple', string> = {
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700'
  };

  return (
    <div className={`rounded-2xl px-4 py-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{unit ? `${value} ${unit}` : value}</p>
    </div>
  );
}
