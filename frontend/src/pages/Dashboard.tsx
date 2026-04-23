import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Car,
  ClipboardList,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  Users,
  Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

type AnalyticsSummary = {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  uniqueClients?: number;
  totalRevenue: string | number;
  partsExpense: string | number;
  laborExpense: string | number;
  averageCheck: string | number;
};

type Vehicle = {
  id: number;
  make: string;
  model: string;
  licensePlate?: string;
};

type ClientOrder = {
  id: number;
  startTime: string;
  status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' | 'canceled';
  totalAmount: string | number;
  vehicle?: {
    make: string;
    model: string;
    licensePlate?: string;
  };
};

type AssignedOrder = {
  id: number;
  startTime: string;
  status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' | 'canceled';
  vehicle?: {
    make: string;
    model: string;
    licensePlate?: string;
  };
  orderServices?: Array<{ service?: { name: string } }>;
};

type BackofficeOrder = {
  id: number;
  startTime: string;
  status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' | 'canceled';
  totalAmount: string | number;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  client?: {
    user?: {
      username?: string;
    };
  };
  vehicle?: {
    make: string;
    model: string;
  };
};

const statusMap: Record<ClientOrder['status'], string> = {
  planned: 'Заплановано',
  in_progress: 'В роботі',
  ready_for_delivery: 'Готово',
  completed: 'Завершено',
  canceled: 'Скасовано'
};

const paymentStatusMap: Record<'paid' | 'partially_paid' | 'unpaid', string> = {
  paid: 'Оплачено',
  partially_paid: 'Частково',
  unpaid: 'Не оплачено'
};

function formatMoney(value: string | number) {
  return `${Number(value || 0).toLocaleString('uk-UA')} ₴`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadge(status: ClientOrder['status']) {
  if (status === 'completed') return <Badge className="bg-green-500">Завершено</Badge>;
  if (status === 'in_progress') return <Badge className="bg-orange-500">В роботі</Badge>;
  if (status === 'ready_for_delivery') return <Badge className="bg-blue-500">Готово</Badge>;
  if (status === 'canceled') return <Badge variant="destructive">Скасовано</Badge>;
  return <Badge variant="secondary">Заплановано</Badge>;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accentClass
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <Card className="border-gray-200">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${accentClass}`}>{value}</p>
            {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${accentClass.replace('text-', 'bg-')}/10`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? null;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<AssignedOrder[]>([]);
  const [backofficeOrders, setBackofficeOrders] = useState<BackofficeOrder[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (!user) return;

        if (['Manager', 'Admin', 'Accountant'].includes(user.role)) {
          const [summaryResponse, ordersResponse] = await Promise.all([
            api.get('/analytics/dashboard'),
            api.get<BackofficeOrder[]>('/orders')
          ]);
          if (!active) return;
          setSummary(summaryResponse.data.summary);
          setBackofficeOrders(ordersResponse.data.slice(0, 5));
        } else if (user.role === 'Client') {
          const [vehiclesResponse, ordersResponse] = await Promise.all([
            api.get<Vehicle[]>('/vehicles/my'),
            api.get<ClientOrder[]>('/orders/my')
          ]);
          if (!active) return;
          setVehicles(vehiclesResponse.data);
          setOrders(ordersResponse.data);
        } else if (user.role === 'Mechanic') {
          const response = await api.get<AssignedOrder[]>('/orders/assigned');
          if (!active) return;
          setAssignedOrders(response.data);
        }
      } catch {
        toast.error('Не вдалося завантажити дашборд');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [user]);

  const nextBooking = orders
    .filter((order) => order.status === 'planned' || order.status === 'in_progress')
    .sort((left, right) => left.startTime.localeCompare(right.startTime))[0];

  const activeClientOrders = useMemo(
    () => orders.filter((order) => !['completed', 'canceled'].includes(order.status)),
    [orders]
  );

  const statCards = useMemo(() => {
    if (role === 'Client') {
      return [
        {
          title: 'Мої автомобілі',
          value: vehicles.length,
          subtitle: 'Зареєстровано в системі',
          icon: <Car className="w-5 h-5 text-blue-600" />,
          accentClass: 'text-blue-600'
        },
        {
          title: 'Активні замовлення',
          value: activeClientOrders.length,
          subtitle: 'В роботі та заплановані',
          icon: <ClipboardList className="w-5 h-5 text-green-600" />,
          accentClass: 'text-green-600'
        },
        {
          title: 'Наступний візит',
          value: nextBooking ? formatDateTime(nextBooking.startTime) : 'Немає',
          subtitle: nextBooking?.vehicle ? `${nextBooking.vehicle.make} ${nextBooking.vehicle.model}` : 'Немає активних записів',
          icon: <Clock className="w-5 h-5 text-amber-600" />,
          accentClass: 'text-amber-600'
        }
      ];
    }

    if (role === 'Mechanic') {
      return [
        {
          title: 'Мої роботи',
          value: assignedOrders.length,
          subtitle: 'Призначені завдання',
          icon: <Wrench className="w-5 h-5 text-blue-600" />,
          accentClass: 'text-blue-600'
        },
        {
          title: 'Виконано',
          value: assignedOrders.filter((order) => order.status === 'completed').length,
          subtitle: 'Усі завершені задачі',
          icon: <TrendingUp className="w-5 h-5 text-green-600" />,
          accentClass: 'text-green-600'
        }
      ];
    }

    return [
      {
        title: 'Замовлень',
        value: summary?.totalOrders ?? 0,
        subtitle: 'Усього в системі',
        icon: <ClipboardList className="w-5 h-5 text-blue-600" />,
        accentClass: 'text-blue-600'
      },
      {
        title: 'Активних',
        value: summary?.activeOrders ?? 0,
        subtitle: 'В роботі зараз',
        icon: <Clock className="w-5 h-5 text-amber-600" />,
        accentClass: 'text-amber-600'
      },
      {
        title: 'Дохід',
        value: formatMoney(summary?.totalRevenue ?? 0),
        subtitle: 'Поточний період',
        icon: <DollarSign className="w-5 h-5 text-green-600" />,
        accentClass: 'text-green-600'
      },
      {
        title: 'Клієнтів',
        value: summary?.uniqueClients ?? 0,
        subtitle: 'Унікальних клієнтів',
        icon: <Users className="w-5 h-5 text-purple-600" />,
        accentClass: 'text-purple-600'
      }
    ];
  }, [role, vehicles.length, activeClientOrders.length, nextBooking, assignedOrders, summary]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-7 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Привіт, {user.username}!</h1>
        <p className="text-gray-600 text-sm sm:text-base lg:text-lg mt-1">
          {user.role === 'Client' && 'Радий вас бачити знову'}
          {user.role === 'Manager' && 'Ось що відбувається в сервісі'}
          {user.role === 'Mechanic' && 'Ваші сьогоднішні завдання'}
          {user.role === 'Accountant' && 'Фінансовий огляд'}
          {user.role === 'Admin' && 'Системний огляд'}
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
          Завантаження дашборду...
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            accentClass={card.accentClass}
          />
        ))}
      </div>

      {user.role === 'Client' ? (
        <div className="mt-6 sm:mt-8">
          <button
            onClick={() => navigate('/booking')}
            className="w-full sm:w-auto rounded-xl bg-blue-600 text-white px-5 py-3 hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Calendar className="w-5 h-5" />
            <span>Швидкий запис</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {user.role === 'Mechanic' ? (
        <div className="mt-6 sm:mt-8 rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Оперативний режим</p>
              <p className="text-sm text-gray-600">Швидкий перехід до задач, послуг та деталей по призначених замовленнях</p>
            </div>
            <button
              onClick={() => navigate('/mechanic/workplace')}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-white hover:bg-amber-700 inline-flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              Відкрити робоче місце
            </button>
          </div>
        </div>
      ) : null}

      <Card className="mt-8 border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">
              {user.role === 'Client' && 'Мої останні замовлення'}
              {user.role === 'Mechanic' && 'Призначені роботи'}
              {['Manager', 'Admin', 'Accountant'].includes(user.role) && 'Останні замовлення сервісу'}
            </CardTitle>
            <button
              onClick={() => {
                if (user.role === 'Client') navigate('/my-orders');
                if (user.role === 'Mechanic') navigate('/mechanic/workplace');
                if (user.role === 'Manager') navigate('/manager/orders');
                if (user.role === 'Admin') navigate('/analytics');
                if (user.role === 'Accountant') navigate('/finance');
              }}
              className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1"
            >
              <span>Переглянути</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {user.role === 'Client' && (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.id}</p>
                      <p className="text-sm text-gray-600">
                        {order.vehicle ? `${order.vehicle.make} ${order.vehicle.model}` : 'Авто не вказано'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                      <span className="text-xs text-gray-500">{formatDateTime(order.startTime)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-sm text-gray-500">Замовлення ще відсутні.</p>}
            </div>
          )}

          {user.role === 'Mechanic' && (
            <div className="space-y-3">
              {assignedOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.id}</p>
                      <p className="text-sm text-gray-600">
                        {order.vehicle ? `${order.vehicle.make} ${order.vehicle.model}` : 'Авто не вказано'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                      <span className="text-xs text-gray-500">{formatDateTime(order.startTime)}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Послуг: {order.orderServices?.length ?? 0}
                  </p>
                </div>
              ))}
              {assignedOrders.length === 0 && <p className="text-sm text-gray-500">Немає призначених робіт.</p>}
            </div>
          )}

          {['Manager', 'Admin', 'Accountant'].includes(user.role) && (
            <div className="space-y-3">
              {backofficeOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.id}</p>
                      <p className="text-sm text-gray-600">
                        {order.client?.user?.username ?? 'Клієнт'}
                        {order.vehicle ? ` • ${order.vehicle.make} ${order.vehicle.model}` : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-gray-900">{formatMoney(order.totalAmount)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(order.startTime)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {getStatusBadge(order.status)}
                    {order.paymentStatus ? (
                      <Badge variant="outline">{paymentStatusMap[order.paymentStatus]}</Badge>
                    ) : null}
                    <span className="text-xs text-gray-500">{statusMap[order.status]}</span>
                  </div>
                </div>
              ))}
              {backofficeOrders.length === 0 && <p className="text-sm text-gray-500">Замовлення ще відсутні.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">Швидкі дії</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {user.role === 'Client' && (
            <>
              <QuickActionButton icon={<Wrench className="w-8 h-8 text-amber-600" />} label="Мої автомобілі" onClick={() => navigate('/my-vehicles')} />
              <QuickActionButton icon={<Calendar className="w-8 h-8 text-blue-600" />} label="Мої замовлення" onClick={() => navigate('/my-orders')} />
              <QuickActionButton icon={<Users className="w-8 h-8 text-purple-600" />} label="Профіль" onClick={() => navigate('/profile')} />
            </>
          )}

          {user.role === 'Manager' && (
            <>
              <QuickActionButton icon={<Wrench className="w-8 h-8 text-amber-600" />} label="Замовлення" onClick={() => navigate('/manager/orders')} />
              <QuickActionButton icon={<Package className="w-8 h-8 text-blue-600" />} label="Деталі" onClick={() => navigate('/manager/parts')} />
              <QuickActionButton icon={<Users className="w-8 h-8 text-purple-600" />} label="Профіль" onClick={() => navigate('/profile')} />
            </>
          )}

          {user.role === 'Mechanic' && (
            <>
              <QuickActionButton icon={<Wrench className="w-8 h-8 text-blue-600" />} label="Робоче місце" onClick={() => navigate('/mechanic/workplace')} />
              <QuickActionButton icon={<Users className="w-8 h-8 text-purple-600" />} label="Профіль" onClick={() => navigate('/profile')} />
            </>
          )}

          {user.role === 'Accountant' && (
            <>
              <QuickActionButton icon={<DollarSign className="w-8 h-8 text-green-600" />} label="Фінанси" onClick={() => navigate('/finance')} />
              <QuickActionButton icon={<Users className="w-8 h-8 text-purple-600" />} label="Профіль" onClick={() => navigate('/profile')} />
            </>
          )}

          {user.role === 'Admin' && (
            <>
              <QuickActionButton icon={<Wrench className="w-8 h-8 text-amber-600" />} label="Адміністрування" onClick={() => navigate('/admin')} />
              <QuickActionButton icon={<Package className="w-8 h-8 text-blue-600" />} label="Демо-дані" onClick={() => navigate('/admin/data-import')} />
              <QuickActionButton icon={<Users className="w-8 h-8 text-purple-600" />} label="Профіль" onClick={() => navigate('/profile')} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function QuickActionButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white hover:bg-blue-50 border border-gray-200 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-3 sm:gap-4 transition-colors"
    >
      {icon}
      <span className="font-medium text-sm sm:text-base text-center">{label}</span>
    </button>
  );
}
