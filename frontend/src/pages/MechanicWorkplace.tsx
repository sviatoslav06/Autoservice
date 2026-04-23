import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Eye, Search, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

type AssignedOrder = {
  id: number;
  status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' | 'canceled';
  startTime: string;
  box?: {
    id: number;
    boxNumber: string;
    capacity: number;
  };
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  orderServices: Array<{
    serviceId: number;
    service: {
      name: string;
      durationMinutes: number;
      standardPrice: string | number;
    };
    worker: {
      id: number;
      user: {
        username: string;
      };
    };
    actualDurationMinutes?: number | null;
    actualCost?: string | number | null;
  }>;
  orderParts: Array<{
    partId: number;
    quantity: number;
    unitPrice: string | number;
    part: {
      name: string;
      article: string;
      stockQuantity?: number;
    };
  }>;
};

type ServiceCatalogItem = {
  id: number;
  name: string;
  durationMinutes: number;
  standardPrice: string | number;
};

type PartCatalogItem = {
  id: number;
  name: string;
  article: string;
  stockQuantity: number;
  basePrice: string | number;
};

type ServiceDraft = {
  serviceId: string;
  duration: string;
  cost: string;
};

type PartDraft = {
  partId: string;
  quantity: string;
};

const STATUS_TABS: Array<AssignedOrder['status'] | 'all'> = [
  'all',
  'planned',
  'in_progress',
  'ready_for_delivery',
  'completed'
];

const statusLabelMap: Record<AssignedOrder['status'], string> = {
  planned: 'Заплановано',
  in_progress: 'В роботі',
  ready_for_delivery: 'Готово до видачі',
  completed: 'Завершено',
  canceled: 'Скасовано'
};

const statusBadgeClassMap: Record<AssignedOrder['status'], string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  ready_for_delivery: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  canceled: 'bg-red-100 text-red-700 border-red-200'
};

export const MechanicWorkplace: React.FC = () => {
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [parts, setParts] = useState<PartCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AssignedOrder['status'] | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<AssignedOrder | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>({
    serviceId: '',
    duration: '',
    cost: ''
  });
  const [partDraft, setPartDraft] = useState<PartDraft>({
    partId: '',
    quantity: '1'
  });
  const [serviceSearch, setServiceSearch] = useState('');
  const [partSearch, setPartSearch] = useState('');

  const fetchAssignedOrders = async () => {
    try {
      const [ordersResponse, servicesResponse, partsResponse] = await Promise.all([
        api.get('/orders/assigned'),
        api.get<ServiceCatalogItem[]>('/services'),
        api.get<PartCatalogItem[]>('/parts', { params: { inStockOnly: true } })
      ]);
      const nextOrders = [...ordersResponse.data].sort((left: AssignedOrder, right: AssignedOrder) => {
        const rank = (status: AssignedOrder['status']) => {
          if (status === 'in_progress') return 0;
          if (status === 'planned') return 1;
          if (status === 'ready_for_delivery') return 2;
          if (status === 'completed') return 3;
          return 4;
        };

        const diff = rank(left.status) - rank(right.status);
        if (diff !== 0) return diff;
        return left.startTime.localeCompare(right.startTime);
      });
      setOrders(nextOrders);
      setServices(servicesResponse.data);
      setParts(partsResponse.data);
      setSelectedOrder((current) => {
        if (!current) return current;
        return nextOrders.find((order) => order.id === current.id) ?? null;
      });
    } catch {
      toast.error('Не вдалося завантажити завдання');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return activeTab === 'all' ? orders : orders.filter((order) => order.status === activeTab);
  }, [activeTab, orders]);

  const filteredServiceCatalog = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;

    return services.filter((service) =>
      [service.name, String(service.durationMinutes ?? ''), String(service.standardPrice ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [serviceSearch, services]);

  const filteredPartCatalog = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    if (!q) return parts;

    return parts.filter((part) =>
      [part.name, part.article, String(part.stockQuantity ?? ''), String(part.basePrice ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [partSearch, parts]);

  const stats = useMemo(() => {
    const planned = orders.filter((order) => order.status === 'planned').length;
    const inProgress = orders.filter((order) => order.status === 'in_progress').length;
    const ready = orders.filter((order) => order.status === 'ready_for_delivery').length;
    const completed = orders.filter((order) => order.status === 'completed').length;

    return {
      total: orders.length,
      planned,
      inProgress,
      ready,
      completed
    };
  }, [orders]);

  const tabCount = (tab: AssignedOrder['status'] | 'all') => {
    if (tab === 'all') return orders.length;
    return orders.filter((order) => order.status === tab).length;
  };

  const toggleServiceCompletion = async (
    orderId: number,
    serviceId: number,
    completed: boolean
  ) => {
    try {
      const currentOrder = orders.find((order) => order.id === orderId);
      const service = currentOrder?.orderServices.find((line) => line.serviceId === serviceId);
      await api.patch(`/orders/${orderId}/services/${serviceId}`, {
        actualDurationMinutes: service?.actualDurationMinutes ?? service?.service.durationMinutes ?? 60,
        actualCost: completed ? Number(service?.service.standardPrice ?? 0) : null
      });
      toast.success(completed ? 'Послугу виконано' : 'Статус послуги скасовано');
      fetchAssignedOrders();
    } catch {
      toast.error('Помилка оновлення статусу послуги');
    }
  };

  const addServiceToOrder = async (orderId: number) => {
    if (!serviceDraft.serviceId) {
      toast.error('Оберіть послугу');
      return;
    }

    try {
      await api.post(`/orders/${orderId}/services`, {
        serviceId: Number(serviceDraft.serviceId)
      });
      toast.success('Послугу додано');
      setServiceDraft({ serviceId: '', duration: '', cost: '' });
      fetchAssignedOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося додати послугу');
    }
  };

  const saveServiceChanges = async (
    orderId: number,
    serviceId: number,
    payload: { actualDurationMinutes: string; actualCost: string },
    fallbackDurationMinutes: number
  ) => {
    try {
      await api.patch(`/orders/${orderId}/services/${serviceId}`, {
        actualDurationMinutes: payload.actualDurationMinutes.trim()
          ? Number(payload.actualDurationMinutes)
          : fallbackDurationMinutes,
        actualCost: payload.actualCost.trim() ? Number(payload.actualCost) : null
      });
      toast.success('Послугу оновлено');
      fetchAssignedOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося оновити послугу');
    }
  };

  const deleteServiceFromOrder = async (orderId: number, serviceId: number) => {
    if (!confirm('Видалити цю послугу із замовлення?')) return;

    try {
      await api.delete(`/orders/${orderId}/services/${serviceId}`);
      toast.success('Послугу видалено');
      fetchAssignedOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося видалити послугу');
    }
  };

  const addPartToOrder = async (orderId: number) => {
    if (!partDraft.partId) {
      toast.error('Оберіть деталь');
      return;
    }

    try {
      await api.post(`/orders/${orderId}/parts`, {
        partId: Number(partDraft.partId),
        quantity: Number(partDraft.quantity)
      });
      toast.success('Деталь додано');
      setPartDraft({ partId: '', quantity: '1' });
      fetchAssignedOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося додати деталь');
    }
  };

  const savePartQuantity = async (orderId: number, partId: number, quantity: number) => {
    try {
      await api.patch(`/orders/${orderId}/parts/${partId}`, {
        quantity
      });
      toast.success('Деталь оновлено');
      fetchAssignedOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося оновити деталь');
    }
  };

  const deletePartFromOrder = async (orderId: number, partId: number) => {
    if (!confirm('Видалити цю деталь із замовлення?')) return;

    try {
      await api.delete(`/orders/${orderId}/parts/${partId}`);
      toast.success('Деталь видалено');
      fetchAssignedOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося видалити деталь');
    }
  };

  const updateOrderStatus = async (orderId: number, status: AssignedOrder['status']) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success('Статус оновлено');
      fetchAssignedOrders();
    } catch {
      toast.error('Не вдалося змінити статус');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">Завантаження завдань...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 sm:p-7">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Робоче місце механіка</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">Ваші призначені завдання, послуги та деталі в одному екрані</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Всього</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Заплановано</p>
            <p className="mt-1 text-xl font-bold text-slate-700">{stats.planned}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">В роботі</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{stats.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Готово</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{stats.ready}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Завершено</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.completed}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
              activeTab === status
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
            }`}
          >
            {status === 'all'
              ? 'Усі'
              : status === 'planned'
                ? 'Заплановані'
                : status === 'in_progress'
                  ? 'В роботі'
                  : status === 'ready_for_delivery'
                    ? 'Готові'
                    : 'Виконані'}{' '}
            ({tabCount(status)})
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wrench className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-xl text-gray-500">Наразі немає призначених робіт</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="rounded-3xl border border-gray-200 hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {order.vehicle.make} {order.vehicle.model} • {order.vehicle.licensePlate}
                    </h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {new Date(order.startTime).toLocaleString('uk-UA', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Бокс: {order.box?.boxNumber ?? 'Не призначено'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClassMap[order.status]}`}>
                      {statusLabelMap[order.status]}
                    </span>
                    <Badge variant="outline">Замовлення #{order.id}</Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-6">
                  {order.orderServices.map((service) => (
                    <div
                      key={service.serviceId}
                      className="flex items-center justify-between border-b pb-4 last:border-b-0"
                    >
                      <div className="flex items-center gap-4">
                        <Wrench className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="font-medium">{service.service.name}</p>
                          <p className="text-xs text-gray-500">
                            {service.actualCost == null
                              ? 'Не виконано'
                              : `Виконано за ${service.actualDurationMinutes} хв`}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() =>
                          toggleServiceCompletion(
                            order.id,
                            service.serviceId,
                            service.actualCost == null
                          )
                        }
                        variant="outline"
                        className={
                          service.actualCost == null
                            ? 'text-green-600 border-green-600'
                            : 'text-orange-600 border-orange-600'
                        }
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {service.actualCost == null ? 'Виконано' : 'Повернути в роботу'}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap justify-between gap-3">
                  <Button variant="outline" onClick={() => setSelectedOrder(order)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Переглянути
                  </Button>

                  <div className="flex flex-wrap gap-2">
                    {order.status === 'planned' && (
                      <Button
                        onClick={() => updateOrderStatus(order.id, 'in_progress')}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        Почати роботу
                      </Button>
                    )}
                    {order.status === 'in_progress' && (
                      <Button
                        onClick={() => updateOrderStatus(order.id, 'ready_for_delivery')}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Готово до видачі
                      </Button>
                    )}
                    {order.status !== 'completed' && (
                      <Button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Завершити замовлення
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Деталі замовлення #{selectedOrder.id}</h2>
                <p className="text-sm text-gray-500">
                  {selectedOrder.vehicle.make} {selectedOrder.vehicle.model} • {selectedOrder.vehicle.licensePlate}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Поточний статус</p>
                  <p className="text-lg font-semibold">{statusLabelMap[selectedOrder.status]}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Бокс виконання</p>
                  <p className="text-lg font-semibold">{selectedOrder.box?.boxNumber ?? 'Не призначено'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedOrder.box?.capacity ? `Місткість: ${selectedOrder.box.capacity}` : ''}
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Послуги</h3>
                  {selectedOrder.orderServices.map((service) => (
                    <div key={service.serviceId} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{service.service.name}</p>
                          <p className="text-xs text-gray-500">
                            {service.actualCost == null
                              ? 'Очікує виконання'
                              : `Виконано за ${service.actualDurationMinutes} хв`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">Час виконання, хв</label>
                          <input
                            defaultValue={service.actualDurationMinutes ?? ''}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            id={`duration-${service.serviceId}`}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">Вартість</label>
                          <input
                            defaultValue={service.actualCost ?? ''}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            id={`cost-${service.serviceId}`}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              saveServiceChanges(
                                selectedOrder.id,
                                service.serviceId,
                                {
                                  actualDurationMinutes: (document.getElementById(`duration-${service.serviceId}`) as HTMLInputElement | null)?.value ?? '',
                                  actualCost: (document.getElementById(`cost-${service.serviceId}`) as HTMLInputElement | null)?.value ?? ''
                                },
                                service.actualDurationMinutes ?? service.service.durationMinutes
                              )
                            }
                            className="w-full"
                          >
                            Зберегти
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            toggleServiceCompletion(
                              selectedOrder.id,
                              service.serviceId,
                              service.actualCost == null
                            )
                          }
                          variant="outline"
                          className={
                            service.actualCost == null
                              ? 'text-green-600 border-green-600'
                              : 'text-orange-600 border-orange-600'
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {service.actualCost == null ? 'Позначити виконаною' : 'Повернути невиконаною'}
                        </Button>
                        <Button
                          onClick={() => deleteServiceFromOrder(selectedOrder.id, service.serviceId)}
                          variant="outline"
                          className="border-red-600 text-red-600"
                        >
                          Видалити
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="font-semibold">Додати послугу</h3>
                  <div className="mt-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={serviceSearch}
                        onChange={(event) => setServiceSearch(event.target.value)}
                        placeholder="Пошук послуг..."
                        className="w-full rounded-lg border border-gray-300 px-10 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <select
                      value={serviceDraft.serviceId}
                      onChange={(event) =>
                        setServiceDraft((current) => ({ ...current, serviceId: event.target.value }))
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Оберіть послугу</option>
                      {filteredServiceCatalog
                        .filter((service) => !selectedOrder.orderServices.some((line) => line.serviceId === service.id))
                        .map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const service = services.find((item) => String(item.id) === serviceDraft.serviceId);
                        setServiceDraft((current) => ({
                          ...current,
                          duration: String(service?.durationMinutes ?? ''),
                          cost: String(service?.standardPrice ?? '')
                        }));
                        addServiceToOrder(selectedOrder.id);
                      }}
                    >
                      Додати
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Керування статусом</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === 'planned' && (
                    <Button onClick={() => updateOrderStatus(selectedOrder.id, 'in_progress')} className="bg-orange-600 hover:bg-orange-700">
                      Почати роботу
                    </Button>
                  )}
                  {selectedOrder.status === 'in_progress' && (
                    <Button onClick={() => updateOrderStatus(selectedOrder.id, 'ready_for_delivery')} className="bg-blue-600 hover:bg-blue-700">
                      Готово до видачі
                    </Button>
                  )}
                  {selectedOrder.status !== 'completed' && (
                    <Button onClick={() => updateOrderStatus(selectedOrder.id, 'completed')} className="bg-green-600 hover:bg-green-700">
                      Завершити
                    </Button>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="font-semibold">Використані деталі</h3>
                  <div className="mt-3 space-y-3">
                    {selectedOrder.orderParts.map((part) => (
                      <div key={part.partId} className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{part.part.name}</p>
                            <p className="text-xs text-gray-500">{part.part.article}</p>
                          </div>
                          <button
                            onClick={() => deletePartFromOrder(selectedOrder.id, part.partId)}
                            className="rounded-lg border border-red-600 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Видалити
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500">Кількість</label>
                            <input
                              id={`part-${part.partId}`}
                              defaultValue={part.quantity}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="outline"
                              onClick={() =>
                                savePartQuantity(
                                  selectedOrder.id,
                                  part.partId,
                                  Number(
                                    (document.getElementById(`part-${part.partId}`) as HTMLInputElement | null)
                                      ?.value ?? part.quantity
                                  )
                                )
                              }
                            >
                              Зберегти
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          value={partSearch}
                          onChange={(event) => setPartSearch(event.target.value)}
                          placeholder="Пошук деталей..."
                          className="w-full rounded-lg border border-gray-300 px-10 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <select
                      value={partDraft.partId}
                      onChange={(event) =>
                        setPartDraft((current) => ({ ...current, partId: event.target.value }))
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Оберіть деталь</option>
                      {filteredPartCatalog.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.name} · залишок {part.stockQuantity}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={partDraft.quantity}
                      onChange={(event) =>
                        setPartDraft((current) => ({ ...current, quantity: event.target.value }))
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <Button variant="outline" onClick={() => addPartToOrder(selectedOrder.id)}>
                      Додати
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-4">
                  <p className="text-sm text-gray-500 mb-2">Примітка</p>
                  <p className="text-sm text-gray-700">
                    Після зміни статусу або позначення послуги як виконано, це вікно не закривається, щоб можна було завершити всі потрібні дії за один раз.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
