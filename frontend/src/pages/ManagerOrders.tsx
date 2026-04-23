import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Edit2, Eye, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';

type OrderStatus = 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' | 'canceled';

type Order = {
  id: number;
  startTime: string;
  orderDate: string;
  status: OrderStatus;
  totalAmount: string | number;
  totalDurationMinutes?: number | null;
  notes?: string | null;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  client: {
    user: {
      username: string;
      email: string;
      phone?: string | null;
    };
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
  };
  box: {
    id: number;
    boxNumber: string;
    capacity: number;
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
    quantity: number;
    unitPrice: string | number;
    part: {
      name: string;
      article: string;
    };
  }>;
};

type Box = {
  id: number;
  boxNumber: string;
  capacity: number;
  isAvailable?: boolean;
};

type Mechanic = {
  id: number;
  user: {
    username: string;
  };
  isAvailable?: boolean;
};

type ClientOption = {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  client: {
    id: number;
  };
};

type VehicleOption = {
  id: number;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
};

type ServiceCatalogItem = {
  id: number;
  name: string;
  durationMinutes: number;
};

type EditForm = {
  startDate: string;
  startTime: string;
  boxId: string;
  mechanicId: string;
  notes: string;
};

type CreateOrderForm = {
  clientId: string;
  vehicleId: string;
  selectedServiceIds: number[];
  startDate: string;
  startTime: string;
  boxId: string;
  mechanicId: string;
  notes: string;
};

type CreateClientForm = {
  username: string;
  phone: string;
  email: string;
};

type CreateVehicleForm = {
  make: string;
  model: string;
  year: string;
  vin: string;
  licensePlate: string;
  kilometrage: string;
};

const emptyEditForm: EditForm = {
  startDate: '',
  startTime: '',
  boxId: '',
  mechanicId: '',
  notes: ''
};

const emptyCreateOrderForm: CreateOrderForm = {
  clientId: '',
  vehicleId: '',
  selectedServiceIds: [],
  startDate: '',
  startTime: '',
  boxId: '',
  mechanicId: '',
  notes: ''
};

const emptyCreateClientForm: CreateClientForm = {
  username: '',
  phone: '',
  email: ''
};

const emptyCreateVehicleForm: CreateVehicleForm = {
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  vin: '',
  licensePlate: '',
  kilometrage: ''
};

function toLocalDateTimeParts(value: string) {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, '0');

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function money(value: string | number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export const ManagerOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [availableMechanics, setAvailableMechanics] = useState<Mechanic[]>([]);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [editLoading, setEditLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientVehicles, setClientVehicles] = useState<VehicleOption[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [createForm, setCreateForm] = useState<CreateOrderForm>(emptyCreateOrderForm);
  const [createAvailableBoxes, setCreateAvailableBoxes] = useState<Box[]>([]);
  const [createAvailableMechanics, setCreateAvailableMechanics] = useState<Mechanic[]>([]);
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [showCreateVehicleForm, setShowCreateVehicleForm] = useState(false);
  const [createClientForm, setCreateClientForm] = useState<CreateClientForm>(emptyCreateClientForm);
  const [createVehicleForm, setCreateVehicleForm] = useState<CreateVehicleForm>(emptyCreateVehicleForm);
  const [createClientLoading, setCreateClientLoading] = useState(false);
  const [createVehicleLoading, setCreateVehicleLoading] = useState(false);

  const loadOrders = async () => {
    try {
      const [ordersResponse, boxesResponse, mechanicsResponse] = await Promise.all([
        api.get<Order[]>('/orders'),
        api.get<Box[]>('/boxes'),
        api.get<Mechanic[]>('/workers/mechanics')
      ]);

      setOrders(ordersResponse.data);
      setBoxes(boxesResponse.data);
      setMechanics(mechanicsResponse.data);
    } catch {
      toast.error('Не вдалося завантажити замовлення');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const loadAvailability = async (order: Order, nextDate: string, nextTime: string) => {
    const startTime = `${nextDate}T${nextTime}:00`;
    const calculatedDuration =
      order.totalDurationMinutes ??
      order.orderServices.reduce((sum, service) => sum + (service.service.durationMinutes || 0), 0) ??
      60;
    const durationMinutes = Math.max(1, calculatedDuration);

    try {
      const [boxesResponse, mechanicsResponse] = await Promise.all([
        api.get<Box[]>('/boxes/available', {
          params: {
            startTime,
            durationMinutes,
            excludeOrderId: order.id
          }
        }),
        api.get<Mechanic[]>('/workers/mechanics/available', {
          params: {
            startTime,
            durationMinutes,
            excludeOrderId: order.id
          }
        })
      ]);

      setAvailableBoxes(boxesResponse.data);
      setAvailableMechanics(mechanicsResponse.data);
      setEditForm((current) => {
        const currentBoxId = String(order.box?.id ?? '');
        const currentMechanicId = String(order.orderServices[0]?.worker.id ?? '');

        return {
          ...current,
          boxId:
            boxesResponse.data.some((box) => String(box.id) === currentBoxId)
              ? currentBoxId
              : String(boxesResponse.data[0]?.id ?? ''),
          mechanicId:
            mechanicsResponse.data.some((mechanic) => String(mechanic.id) === currentMechanicId)
              ? currentMechanicId
              : String(mechanicsResponse.data[0]?.id ?? '')
        };
      });
    } catch {
      setAvailableBoxes([]);
      setAvailableMechanics([]);
    }
  };

  useEffect(() => {
    if (!showEditModal || !editingOrder || !editForm.startDate || !editForm.startTime) {
      return;
    }

    loadAvailability(editingOrder, editForm.startDate, editForm.startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditModal, editingOrder?.id, editForm.startDate, editForm.startTime]);

  useEffect(() => {
    if (!showCreateModal) {
      return;
    }

    loadClientVehicles(createForm.clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, createForm.clientId]);

  useEffect(() => {
    if (!showCreateModal) {
      return;
    }

    const durationMinutes = Math.max(
      1,
      createForm.selectedServiceIds.reduce((sum, serviceId) => {
        const service = serviceCatalog.find((item) => item.id === serviceId);
        return sum + Number(service?.durationMinutes || 0);
      }, 0)
    );

    loadCreateAvailability(createForm.startDate, createForm.startTime, durationMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, createForm.startDate, createForm.startTime, createForm.selectedServiceIds, serviceCatalog]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    const next = orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch = !q
        ? true
        : [
            `#${order.id}`,
            order.client.user.username,
            order.vehicle.make,
            order.vehicle.model,
            order.vehicle.licensePlate,
            order.box?.boxNumber ?? '',
            order.notes ?? ''
          ]
            .join(' ')
            .toLowerCase()
            .includes(q);
      return matchesStatus && matchesSearch;
    });

    return next.sort((left, right) => {
      const diff = new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
      return sortBy === 'newest' ? -diff : diff;
    });
  }, [orders, search, sortBy, statusFilter]);

  const stats = useMemo(() => {
    const active = orders.filter(
      (order) => order.status === 'planned' || order.status === 'in_progress' || order.status === 'ready_for_delivery'
    ).length;
    const completed = orders.filter((order) => order.status === 'completed').length;
    const canceled = orders.filter((order) => order.status === 'canceled').length;
    const revenue = orders
      .filter((order) => order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    return {
      total: orders.length,
      active,
      completed,
      canceled,
      revenue
    };
  }, [orders]);

  const createDurationMinutes = useMemo(() => {
    if (!createForm.selectedServiceIds.length) {
      return 1;
    }

    const duration = createForm.selectedServiceIds.reduce((sum, serviceId) => {
      const service = serviceCatalog.find((item) => item.id === serviceId);
      return sum + Number(service?.durationMinutes || 0);
    }, 0);

    return Math.max(1, duration);
  }, [createForm.selectedServiceIds, serviceCatalog]);

  const filteredServiceCatalog = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();

    if (!q) {
      return serviceCatalog;
    }

    return serviceCatalog.filter((service) => {
      return [service.name, String(service.durationMinutes ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [serviceCatalog, serviceSearch]);

  const loadCreateResources = async () => {
    try {
      const [clientsResponse, servicesResponse] = await Promise.all([
        api.get<ClientOption[]>('/users/clients'),
        api.get<ServiceCatalogItem[]>('/services')
      ]);

      setClients(clientsResponse.data);
      setServiceCatalog(servicesResponse.data);
    } catch {
      toast.error('Не вдалося завантажити дані для створення замовлення');
    }
  };

  const loadClientVehicles = async (clientId: string) => {
    if (!clientId) {
      setClientVehicles([]);
      setCreateForm((current) => ({
        ...current,
        vehicleId: ''
      }));
      return;
    }

    try {
      const response = await api.get<VehicleOption[]>(`/vehicles/client/${clientId}`);
      setClientVehicles(response.data);
      setCreateForm((current) => ({
        ...current,
        vehicleId: response.data.some((vehicle) => String(vehicle.id) === current.vehicleId)
          ? current.vehicleId
          : String(response.data[0]?.id ?? '')
      }));
    } catch {
      setClientVehicles([]);
      setCreateForm((current) => ({
        ...current,
        vehicleId: ''
      }));
      toast.error('Не вдалося завантажити авто клієнта');
    }
  };

  const loadCreateAvailability = async (startDate: string, startTime: string, durationMinutes: number) => {
    if (!startDate || !startTime) {
      setCreateAvailableBoxes([]);
      setCreateAvailableMechanics([]);
      setCreateForm((current) => ({ ...current, boxId: '', mechanicId: '' }));
      return;
    }

    const start = `${startDate}T${startTime}:00`;

    try {
      const [boxesResponse, mechanicsResponse] = await Promise.all([
        api.get<Box[]>('/boxes/available', {
          params: {
            startTime: start,
            durationMinutes
          }
        }),
        api.get<Mechanic[]>('/workers/mechanics/available', {
          params: {
            startTime: start,
            durationMinutes
          }
        })
      ]);

      const availableBox = boxesResponse.data.find((box) => box.isAvailable);
      setCreateAvailableBoxes(boxesResponse.data);
      setCreateAvailableMechanics(mechanicsResponse.data);
      setCreateForm((current) => ({
        ...current,
        boxId: boxesResponse.data.some((box) => String(box.id) === current.boxId)
          ? current.boxId
          : String(availableBox?.id ?? ''),
        mechanicId: mechanicsResponse.data.some((mechanic) => String(mechanic.id) === current.mechanicId)
          ? current.mechanicId
          : String(mechanicsResponse.data[0]?.id ?? '')
      }));
    } catch {
      setCreateAvailableBoxes([]);
      setCreateAvailableMechanics([]);
      setCreateForm((current) => ({ ...current, boxId: '', mechanicId: '' }));
      toast.error('Не вдалося завантажити доступність на вибраний час');
    }
  };

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setCreateForm(emptyCreateOrderForm);
    setServiceSearch('');
    setShowCreateClientForm(false);
    setShowCreateVehicleForm(false);
    setCreateClientForm(emptyCreateClientForm);
    setCreateVehicleForm(emptyCreateVehicleForm);
    setClientVehicles([]);
    setCreateAvailableBoxes([]);
    setCreateAvailableMechanics([]);
    await loadCreateResources();
  };

  const createClientByManager = async () => {
    if (!createClientForm.username.trim() || !createClientForm.phone.trim()) {
      toast.error('Вкажіть імʼя та телефон клієнта');
      return;
    }

    setCreateClientLoading(true);

    try {
      const response = await api.post('/users/clients', {
        username: createClientForm.username.trim(),
        phone: createClientForm.phone.trim(),
        email: createClientForm.email.trim() || undefined
      });

      toast.success('Клієнта створено');
      setShowCreateClientForm(false);
      setCreateClientForm(emptyCreateClientForm);
      await loadCreateResources();
      setCreateForm((current) => ({
        ...current,
        clientId: String(response.data.clientId)
      }));
      await loadClientVehicles(String(response.data.clientId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося створити клієнта');
    } finally {
      setCreateClientLoading(false);
    }
  };

  const createVehicleForClient = async () => {
    if (!createForm.clientId) {
      toast.error('Спочатку оберіть клієнта');
      return;
    }

    if (
      !createVehicleForm.make.trim() ||
      !createVehicleForm.model.trim() ||
      !createVehicleForm.vin.trim() ||
      !createVehicleForm.licensePlate.trim()
    ) {
      toast.error('Заповніть обовʼязкові поля авто');
      return;
    }

    setCreateVehicleLoading(true);

    try {
      const response = await api.post<VehicleOption>('/vehicles', {
        clientId: Number(createForm.clientId),
        make: createVehicleForm.make.trim(),
        model: createVehicleForm.model.trim(),
        year: Number(createVehicleForm.year),
        vin: createVehicleForm.vin.trim(),
        licensePlate: createVehicleForm.licensePlate.trim(),
        kilometrage: createVehicleForm.kilometrage ? Number(createVehicleForm.kilometrage) : undefined
      });

      toast.success('Авто додано');
      setShowCreateVehicleForm(false);
      setCreateVehicleForm(emptyCreateVehicleForm);
      await loadClientVehicles(createForm.clientId);
      setCreateForm((current) => ({
        ...current,
        vehicleId: String(response.data.id)
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося додати авто');
    } finally {
      setCreateVehicleLoading(false);
    }
  };

  const submitCreateOrder = async () => {
    if (!createForm.clientId || !createForm.vehicleId) {
      toast.error('Оберіть клієнта та авто');
      return;
    }

    if (!createForm.selectedServiceIds.length) {
      toast.error('Оберіть хоча б одну послугу');
      return;
    }

    if (!createForm.startDate || !createForm.startTime) {
      toast.error('Оберіть дату та час');
      return;
    }

    if (!createForm.mechanicId) {
      toast.error('Оберіть механіка');
      return;
    }

    setCreateLoading(true);

    try {
      await api.post('/orders', {
        clientId: Number(createForm.clientId),
        vehicleId: Number(createForm.vehicleId),
        boxId: createForm.boxId ? Number(createForm.boxId) : undefined,
        startTime: `${createForm.startDate}T${createForm.startTime}:00`,
        notes: createForm.notes.trim() || undefined,
        services: createForm.selectedServiceIds.map((serviceId) => ({
          serviceId,
          workerId: Number(createForm.mechanicId)
        }))
      });

      toast.success('Замовлення створено');
      setShowCreateModal(false);
      setCreateForm(emptyCreateOrderForm);
      setClientVehicles([]);
      setCreateAvailableBoxes([]);
      setCreateAvailableMechanics([]);
      await loadOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося створити замовлення');
    } finally {
      setCreateLoading(false);
    }
  };

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
  };

  const openEdit = (order: Order) => {
    const parts = toLocalDateTimeParts(order.startTime);
    setEditingOrder(order);
    setEditForm({
      startDate: parts.date,
      startTime: parts.time,
      boxId: String(order.box?.id ?? ''),
      mechanicId: String(order.orderServices[0]?.worker.id ?? ''),
      notes: order.notes ?? ''
    });
    setShowEditModal(true);
  };

  const refreshOrderInState = (updatedOrder: Order) => {
    setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    setSelectedOrder((current) => (current?.id === updatedOrder.id ? updatedOrder : current));
    setEditingOrder((current) => (current?.id === updatedOrder.id ? updatedOrder : current));
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    if (!editForm.startDate || !editForm.startTime || !editForm.boxId || !editForm.mechanicId) {
      toast.error('Заповніть бокс, механіка, дату та час');
      return;
    }

    setEditLoading(true);

    try {
      const startTime = `${editForm.startDate}T${editForm.startTime}:00`;
      const nextBoxId = Number(editForm.boxId);
      const nextMechanicId = Number(editForm.mechanicId);

      const updated = await api.put<Order>(`/orders/${editingOrder.id}`, {
        boxId: nextBoxId,
        startTime,
        notes: editForm.notes.trim() || undefined
      });

      const currentMechanicId = editingOrder.orderServices[0]?.worker.id;
      if (currentMechanicId && currentMechanicId !== nextMechanicId) {
        for (const service of editingOrder.orderServices) {
          await api.patch(`/orders/${editingOrder.id}/services/${service.serviceId}`, {
            workerId: nextMechanicId
          });
        }
      }

      toast.success('Замовлення оновлено');
      refreshOrderInState(updated.data);
      setShowEditModal(false);
      setEditingOrder(null);
      setEditForm(emptyEditForm);
      loadOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося оновити замовлення');
    } finally {
      setEditLoading(false);
    }
  };

  const cancelOrder = async (orderId: number) => {
    try {
      const response = await api.post(`/orders/${orderId}/cancel`);
      refreshOrderInState(response.data);
      toast.success('Замовлення скасовано');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося скасувати замовлення');
    }
  };

  const deleteOrder = async (orderId: number) => {
    if (!confirm('Видалити це замовлення?')) return;

    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((current) => current.filter((order) => order.id !== orderId));
      setSelectedOrder((current) => (current?.id === orderId ? null : current));
      toast.success('Замовлення видалено');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Не вдалося видалити замовлення');
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    if (status === 'planned') return <Badge variant="secondary">Заплановано</Badge>;
    if (status === 'in_progress') return <Badge className="bg-orange-500">В роботі</Badge>;
    if (status === 'ready_for_delivery') return <Badge className="bg-blue-500">Готово до видачі</Badge>;
    if (status === 'completed') return <Badge className="bg-green-500">Виконано</Badge>;
    return <Badge variant="destructive">Скасовано</Badge>;
  };

  const paymentStatusLabel = (status: Order['paymentStatus']) => {
    if (status === 'paid') return 'Оплачено';
    if (status === 'partially_paid') return 'Частково';
    return 'Не оплачено';
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Завантаження замовлень...</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-screen-2xl">
      <div className="mb-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Всі замовлення</h1>
            <p className="text-sm sm:text-base text-gray-600">Керування записами, графіком і розподілом ресурсів</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Створити замовлення
            </button>
            <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-gray-600">Боксів: {boxes.length}</div>
            <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-gray-600">Механіків: {mechanics.length}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Всього</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Активні</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Виконані</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.completed}</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Скасовані</p>
            <p className="mt-1 text-xl font-bold text-red-700">{stats.canceled}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Оплачено</p>
            <p className="mt-1 text-lg font-bold text-violet-700">{money(stats.revenue)} ₴</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук по клієнту, авто, боксу або номеру..."
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatus)}
              className="rounded-2xl border border-gray-300 px-4 py-3"
            >
              <option value="all">Усі статуси</option>
              <option value="planned">Заплановані</option>
              <option value="in_progress">В роботі</option>
              <option value="ready_for_delivery">Готові</option>
              <option value="completed">Виконані</option>
              <option value="canceled">Скасовані</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'newest' | 'oldest')}
              className="rounded-2xl border border-gray-300 px-4 py-3"
            >
              <option value="newest">Найновіші спочатку</option>
              <option value="oldest">Найстаріші спочатку</option>
            </select>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarDays className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-xl text-gray-500">Замовлень не знайдено</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-gray-900">
                        #{order.id} • {order.vehicle.make} {order.vehicle.model}
                      </h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Клієнт: {order.client.user.username} • {order.vehicle.licensePlate}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {formatDateTime(order.startTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{money(order.totalAmount)} ₴</p>
                    <p className="text-sm text-gray-500">Оплата: {paymentStatusLabel(order.paymentStatus)}</p>
                    <p className="text-sm text-gray-500">Бокс {order.box.boxNumber}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Послуги</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {order.orderServices.map((line) => (
                          <span key={line.serviceId} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                            {line.service.name} · {line.worker.user.username}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-500">Деталі</p>
                      <div className="mt-2 space-y-2">
                        {order.orderParts.length ? (
                          order.orderParts.map((part, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 text-sm"
                            >
                              <span>
                                {part.part.name} × {part.quantity}
                              </span>
                              <span>{money(Number(part.unitPrice) * part.quantity)} ₴</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">Деталі ще не додані</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl bg-gray-50 p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Клієнт</p>
                      <p className="font-medium">{order.client.user.username}</p>
                      <p className="text-gray-600">{order.client.user.email}</p>
                      <p className="text-gray-600">{order.client.user.phone || 'Телефон не вказано'}</p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Примітки</p>
                      <p className="text-gray-700">{order.notes || 'Без приміток'}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openDetails(order)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Переглянути
                      </Button>
                      {order.status !== 'completed' && (
                        <Button variant="outline" onClick={() => openEdit(order)} className="border-blue-600 text-blue-600">
                          <Edit2 className="mr-2 h-4 w-4" />
                          Редагувати
                        </Button>
                      )}
                      {order.status !== 'completed' && order.status !== 'canceled' && (
                        <Button variant="outline" onClick={() => cancelOrder(order.id)} className="border-orange-600 text-orange-600">
                          Скасувати
                        </Button>
                      )}
                      {order.status !== 'completed' && (
                        <Button variant="outline" onClick={() => deleteOrder(order.id)} className="border-red-600 text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Видалити
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Нове замовлення від менеджера</h2>
                <p className="text-sm text-gray-500">Для клієнтів, які записуються офлайн або без реєстрації на сайті</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">1. Клієнт</h3>
                  <button
                    onClick={() => setShowCreateClientForm((current) => !current)}
                    className="rounded-xl border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
                  >
                    {showCreateClientForm ? 'Сховати форму клієнта' : 'Додати нового клієнта'}
                  </button>
                </div>

                <select
                  value={createForm.clientId}
                  onChange={(event) =>
                    setCreateForm((state) => ({
                      ...state,
                      clientId: event.target.value,
                      vehicleId: ''
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                >
                  <option value="">Оберіть клієнта</option>
                  {clients.map((client) => (
                    <option key={client.client.id} value={client.client.id}>
                      {client.username} {client.phone ? `• ${client.phone}` : ''}
                    </option>
                  ))}
                </select>

                {showCreateClientForm && (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <input
                      value={createClientForm.username}
                      onChange={(event) =>
                        setCreateClientForm((state) => ({ ...state, username: event.target.value }))
                      }
                      placeholder="Ім'я клієнта"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      value={createClientForm.phone}
                      onChange={(event) =>
                        setCreateClientForm((state) => ({ ...state, phone: event.target.value }))
                      }
                      placeholder="Телефон"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      value={createClientForm.email}
                      onChange={(event) =>
                        setCreateClientForm((state) => ({ ...state, email: event.target.value }))
                      }
                      placeholder="Email (необов'язково)"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <div className="md:col-span-3 flex justify-end">
                      <Button onClick={createClientByManager} disabled={createClientLoading}>
                        {createClientLoading ? 'Створення...' : 'Створити клієнта'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">2. Автомобіль</h3>
                  <button
                    onClick={() => setShowCreateVehicleForm((current) => !current)}
                    className="rounded-xl border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
                  >
                    {showCreateVehicleForm ? 'Сховати форму авто' : 'Додати нове авто'}
                  </button>
                </div>

                <select
                  value={createForm.vehicleId}
                  onChange={(event) =>
                    setCreateForm((state) => ({
                      ...state,
                      vehicleId: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                  disabled={!createForm.clientId}
                >
                  <option value="">Оберіть авто</option>
                  {clientVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} ({vehicle.year}) • {vehicle.licensePlate}
                    </option>
                  ))}
                </select>

                {showCreateVehicleForm && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      value={createVehicleForm.make}
                      onChange={(event) =>
                        setCreateVehicleForm((state) => ({ ...state, make: event.target.value }))
                      }
                      placeholder="Марка"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      value={createVehicleForm.model}
                      onChange={(event) =>
                        setCreateVehicleForm((state) => ({ ...state, model: event.target.value }))
                      }
                      placeholder="Модель"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      type="number"
                      value={createVehicleForm.year}
                      onChange={(event) =>
                        setCreateVehicleForm((state) => ({ ...state, year: event.target.value }))
                      }
                      placeholder="Рік"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      value={createVehicleForm.licensePlate}
                      onChange={(event) =>
                        setCreateVehicleForm((state) => ({ ...state, licensePlate: event.target.value }))
                      }
                      placeholder="Номерний знак"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      value={createVehicleForm.vin}
                      onChange={(event) =>
                        setCreateVehicleForm((state) => ({ ...state, vin: event.target.value }))
                      }
                      placeholder="VIN"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <input
                      type="number"
                      value={createVehicleForm.kilometrage}
                      onChange={(event) =>
                        setCreateVehicleForm((state) => ({ ...state, kilometrage: event.target.value }))
                      }
                      placeholder="Пробіг (необов'язково)"
                      className="rounded-2xl border border-gray-300 px-4 py-2.5"
                    />
                    <div className="md:col-span-2 flex justify-end">
                      <Button onClick={createVehicleForClient} disabled={createVehicleLoading || !createForm.clientId}>
                        {createVehicleLoading ? 'Додавання...' : 'Додати авто'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">3. Послуги, графік і призначення</h3>

                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-600">Послуги</p>
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          value={serviceSearch}
                          onChange={(event) => setServiceSearch(event.target.value)}
                          placeholder="Пошук послуг..."
                          className="w-full rounded-2xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 p-3">
                      {filteredServiceCatalog.map((service) => {
                        const selected = createForm.selectedServiceIds.includes(service.id);
                        return (
                          <label key={service.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-gray-50">
                            <span className="text-sm text-gray-800">{service.name}</span>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{service.durationMinutes} хв</span>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) =>
                                  setCreateForm((state) => ({
                                    ...state,
                                    selectedServiceIds: event.target.checked
                                      ? [...state.selectedServiceIds, service.id]
                                      : state.selectedServiceIds.filter((id) => id !== service.id)
                                  }))
                                }
                              />
                            </div>
                          </label>
                        );
                      })}
                      {!filteredServiceCatalog.length ? (
                        <div className="px-2 py-6 text-center text-sm text-gray-500">
                          Послуг не знайдено
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="date"
                        value={createForm.startDate}
                        onChange={(event) =>
                          setCreateForm((state) => ({ ...state, startDate: event.target.value }))
                        }
                        className="rounded-2xl border border-gray-300 px-4 py-2.5"
                      />
                      <input
                        type="time"
                        value={createForm.startTime}
                        onChange={(event) =>
                          setCreateForm((state) => ({ ...state, startTime: event.target.value }))
                        }
                        className="rounded-2xl border border-gray-300 px-4 py-2.5"
                      />
                    </div>

                    <select
                      value={createForm.boxId}
                      onChange={(event) =>
                        setCreateForm((state) => ({ ...state, boxId: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                    >
                      <option value="">Автовибір боксу</option>
                      {createAvailableBoxes.map((box) => (
                        <option key={box.id} value={box.id}>
                          {box.boxNumber} • місткість {box.capacity}
                        </option>
                      ))}
                    </select>

                    <select
                      value={createForm.mechanicId}
                      onChange={(event) =>
                        setCreateForm((state) => ({ ...state, mechanicId: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                    >
                      <option value="">Оберіть механіка</option>
                      {createAvailableMechanics.map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.id}>
                          {mechanic.user.username}
                        </option>
                      ))}
                    </select>

                    <p className="text-xs text-gray-500">
                      Тривалість за обраними послугами: {createDurationMinutes} хв
                    </p>
                  </div>
                </div>

                <textarea
                  value={createForm.notes}
                  onChange={(event) =>
                    setCreateForm((state) => ({ ...state, notes: event.target.value }))
                  }
                  placeholder="Коментар до замовлення"
                  className="mt-4 min-h-24 w-full rounded-2xl border border-gray-300 px-4 py-3"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-2xl border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <Button onClick={submitCreateOrder} disabled={createLoading}>
                  {createLoading ? 'Створення...' : 'Створити замовлення'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Замовлення #{selectedOrder.id}</h2>
                <p className="text-sm text-gray-500">
                  {selectedOrder.vehicle.make} {selectedOrder.vehicle.model} • {selectedOrder.vehicle.licensePlate}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Дата та час</p>
                  <p className="font-medium">{formatDateTime(selectedOrder.startTime)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Бокс</p>
                  <p className="font-medium">
                    {selectedOrder.box.boxNumber} • місткість {selectedOrder.box.capacity}
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Клієнт</p>
                  <p className="font-medium">{selectedOrder.client.user.username}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.client.user.email}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Статус</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                {selectedOrder.notes && (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Примітки</p>
                    <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Послуги</h3>
                  <div className="mt-2 space-y-2">
                    {selectedOrder.orderServices.map((line) => (
                      <div key={line.serviceId} className="rounded-2xl bg-gray-50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span>{line.service.name}</span>
                          <span>{line.worker.user.username}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {line.actualCost != null ? `Вартість: ${money(line.actualCost)} ₴` : 'Вартість ще не визначена'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Використані деталі</h3>
                  <div className="mt-2 space-y-2">
                    {selectedOrder.orderParts.length ? (
                      selectedOrder.orderParts.map((part, index) => (
                        <div key={index} className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 text-sm">
                          <span>
                            {part.part.name} × {part.quantity}
                          </span>
                          <span>{money(Number(part.unitPrice) * part.quantity)} ₴</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Деталі ще не додані</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Дії</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedOrder.status !== 'completed' && (
                      <Button variant="outline" onClick={() => openEdit(selectedOrder)} className="border-blue-600 text-blue-600">
                        <Edit2 className="mr-2 h-4 w-4" />
                        Редагувати
                      </Button>
                    )}
                    {selectedOrder.status !== 'completed' && selectedOrder.status !== 'canceled' && (
                      <Button variant="outline" onClick={() => cancelOrder(selectedOrder.id)} className="border-orange-600 text-orange-600">
                        Скасувати
                      </Button>
                    )}
                    {selectedOrder.status !== 'completed' && (
                      <Button variant="outline" onClick={() => deleteOrder(selectedOrder.id)} className="border-red-600 text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Видалити
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Редагувати замовлення #{editingOrder.id}</h2>
                <p className="text-sm text-gray-500">Можна змінити час, бокс, механіка та примітки</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-600">Дата</span>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(event) =>
                      setEditForm((state) => ({ ...state, startDate: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-600">Час</span>
                  <input
                    type="time"
                    value={editForm.startTime}
                    onChange={(event) =>
                      setEditForm((state) => ({ ...state, startTime: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-600">Бокс</span>
                  <select
                    value={editForm.boxId}
                    onChange={(event) => setEditForm((state) => ({ ...state, boxId: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                  >
                    <option value="">Оберіть бокс</option>
                    {availableBoxes.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.boxNumber} · місткість {box.capacity}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-600">Механік</span>
                  <select
                    value={editForm.mechanicId}
                    onChange={(event) =>
                      setEditForm((state) => ({ ...state, mechanicId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5"
                  >
                    <option value="">Оберіть механіка</option>
                    {availableMechanics.map((mechanic) => (
                      <option key={mechanic.id} value={mechanic.id}>
                        {mechanic.user.username}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-600">Примітки</span>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm((state) => ({ ...state, notes: event.target.value }))}
                  className="min-h-28 w-full rounded-2xl border border-gray-300 px-4 py-3"
                />
              </label>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-900">Поточні призначення</p>
                <p className="mt-1">
                  {editingOrder.orderServices.map((line) => line.worker.user.username).join(', ') || 'Механік не призначений'}
                </p>
                <p className="mt-1">
                  Доступних боксів: {availableBoxes.length} • доступних механіків: {availableMechanics.length}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-2xl border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <Button onClick={saveEdit} disabled={editLoading}>
                  {editLoading ? 'Збереження...' : 'Зберегти зміни'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
