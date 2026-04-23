import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Car, Clock, CreditCard, Eye, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';

type Order = {
  id: number;
  startTime: string;
  status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' | 'canceled';
  totalAmount: string | number;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  box: {
    boxNumber: string;
  };
  notes?: string | null;
  payments: Array<{
    id: number;
    amount: string | number;
    paymentDate: string;
    paymentMethod: 'cash' | 'card' | 'transfer';
    status: 'pending' | 'completed';
  }>;
  orderServices: Array<{
    service: {
      name: string;
      durationMinutes?: number;
    };
    actualCost?: string | number | null;
  }>;
  orderParts: Array<{
    quantity: number;
    unitPrice: string | number;
    part: {
      name: string;
    };
  }>;
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

export const MyOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | Order['status']>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'card' | 'transfer'
  });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await api.get('/orders/my');
        setOrders(response.data);
      } catch {
        toast.error('Не вдалося завантажити замовлення');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'planned':
        return <Badge variant="secondary">Заплановано</Badge>;
      case 'in_progress':
        return <Badge className="bg-orange-500">В роботі</Badge>;
      case 'ready_for_delivery':
        return <Badge className="bg-blue-500">Готово до видачі</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Виконано</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Скасовано</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: Order['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700 border border-green-200">Оплачено</Badge>;
      case 'partially_paid':
        return <Badge className="bg-amber-100 text-amber-700 border border-amber-200">Частково</Badge>;
      case 'unpaid':
        return <Badge className="bg-red-100 text-red-700 border border-red-200">Не оплачено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((left, right) => right.startTime.localeCompare(left.startTime));
    return statusFilter === 'all' ? sorted : sorted.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const stats = useMemo(() => {
    let active = 0;
    let completed = 0;
    let canceled = 0;
    let unpaidTotal = 0;

    for (const order of orders) {
      if (order.status === 'completed') completed += 1;
      if (order.status === 'canceled') canceled += 1;
      if (order.status === 'planned' || order.status === 'in_progress' || order.status === 'ready_for_delivery') {
        active += 1;
      }

      if (order.paymentStatus !== 'paid') {
        const paid = order.payments
          .filter((payment) => payment.status === 'completed')
          .reduce((sum, payment) => sum + Number(payment.amount), 0);
        unpaidTotal += Math.max(0, Number(order.totalAmount) - paid);
      }
    }

    return {
      total: orders.length,
      active,
      completed,
      canceled,
      unpaidTotal
    };
  }, [orders]);

  const cancelOrder = async (orderId: number) => {
    try {
      await api.post(`/orders/${orderId}/cancel`);
      toast.success('Замовлення скасовано');
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status: 'canceled' } : order))
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((current) => (current ? { ...current, status: 'canceled' } : current));
      }
    } catch {
      toast.error('Не вдалося скасувати замовлення');
    }
  };

  const openPaymentModal = (order: Order) => {
    const paid = order.payments
      .filter((payment) => payment.status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    setSelectedOrder(order);
    setPaymentForm({
      amount: String(Math.max(0, Number(order.totalAmount) - paid)),
      paymentMethod: 'cash'
    });
    setShowPaymentModal(true);
  };

  const payForOrder = async () => {
    if (!selectedOrder) return;

    try {
      await api.post(`/payments/orders/${selectedOrder.id}/pay`, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod
      });
      toast.success('Платіж успішно зареєстровано');
      setShowPaymentModal(false);
      const payment = {
        id: Date.now(),
        amount: paymentForm.amount,
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentForm.paymentMethod,
        status: 'completed' as const
      };
      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                payments: [...order.payments, payment],
                paymentStatus: 'paid'
              }
            : order
        )
      );
      setSelectedOrder(null);
    } catch {
      toast.error('Не вдалося зареєструвати платіж');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-lg">Завантаження замовлень...</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 sm:p-7">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Мої замовлення</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Відстежуйте етапи ремонту, оплату і історію ваших візитів</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Усього</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Активні</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Завершені</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.completed}</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">До сплати</p>
            <p className="mt-1 text-xl font-bold text-red-700">{formatMoney(stats.unpaidTotal)}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(['all', 'planned', 'in_progress', 'ready_for_delivery', 'completed', 'canceled'] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
            className="shrink-0 rounded-full"
          >
            {status === 'all'
              ? 'Усі'
              : status === 'planned'
              ? 'Заплановані'
              : status === 'in_progress'
              ? 'В роботі'
              : status === 'ready_for_delivery'
              ? 'Готові'
              : status === 'completed'
              ? 'Виконані'
              : 'Скасовані'}
          </Button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-xl text-gray-500">У вас ще немає замовлень</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Car className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="text-base sm:text-lg font-semibold">
                        {order.vehicle.make} {order.vehicle.model}
                      </p>
                      <p className="font-mono text-xs sm:text-sm text-gray-500">{order.vehicle.licensePlate}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {getStatusBadge(order.status)}
                    {getPaymentBadge(order.paymentStatus)}
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDateTime(order.startTime)}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Послуги</p>
                    <div className="flex flex-wrap gap-2">
                      {order.orderServices.map((line, index) => (
                        <span key={index} className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                          {line.service.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Сума замовлення</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(order.totalAmount)}</p>
                    <p className="text-xs text-gray-500 mt-1">Бокс: {order.box?.boxNumber ?? 'Не призначено'}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">
                  <Button variant="outline" onClick={() => setSelectedOrder(order)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Деталі
                  </Button>
                  {order.status !== 'canceled' && order.status !== 'completed' && (
                    <Button
                      variant="outline"
                      onClick={() => cancelOrder(order.id)}
                      className="border-orange-600 text-orange-600"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Скасувати
                    </Button>
                  )}
                  {order.paymentStatus !== 'paid' && (
                    <Button onClick={() => openPaymentModal(order)} className="bg-blue-600 hover:bg-blue-700">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Оплатити
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedOrder && !showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b p-5 sm:p-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Замовлення #{selectedOrder.id}</h2>
                <p className="text-sm text-gray-500">
                  {selectedOrder.vehicle.make} {selectedOrder.vehicle.model} • {selectedOrder.vehicle.licensePlate}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Дата та час</p>
                  <p className="font-medium">{formatDateTime(selectedOrder.startTime)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Бокс</p>
                  <p className="font-medium">{selectedOrder.box?.boxNumber ?? 'Не призначено'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Статус</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getStatusBadge(selectedOrder.status)}
                    {getPaymentBadge(selectedOrder.paymentStatus)}
                  </div>
                </div>
                {selectedOrder.notes ? (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Примітки</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedOrder.notes}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Послуги</h3>
                  <div className="mt-2 space-y-2">
                    {selectedOrder.orderServices.map((line, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span>{line.service.name}</span>
                        <span>{line.actualCost ? formatMoney(line.actualCost) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Деталі</h3>
                  <div className="mt-2 space-y-2">
                    {selectedOrder.orderParts.length ? (
                      selectedOrder.orderParts.map((part, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 text-sm"
                        >
                          <span>
                            {part.part.name} × {part.quantity}
                          </span>
                          <span>{formatMoney(Number(part.unitPrice) * part.quantity)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Деталі ще не додані</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Платежі</h3>
                  <div className="mt-2 space-y-2">
                    {selectedOrder.payments.length ? (
                      selectedOrder.payments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl bg-gray-50 px-3 py-2 text-sm">
                          {payment.paymentMethod} • {formatMoney(payment.amount)}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Платежів ще немає</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-2xl font-bold text-gray-900">Оплата замовлення</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedOrder(null);
                }}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Сума</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm((state) => ({ ...state, amount: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Метод</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((state) => ({
                      ...state,
                      paymentMethod: event.target.value as typeof paymentForm.paymentMethod
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                >
                  <option value="cash">Готівка</option>
                  <option value="card">Картка</option>
                  <option value="transfer">Переказ</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedOrder(null);
                  }}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <button
                  onClick={payForOrder}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
                >
                  Оплатити
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
