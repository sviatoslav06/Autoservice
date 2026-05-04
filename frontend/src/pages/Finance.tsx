import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, DollarSign, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

type FinancialOrder = {
  id: number;
  orderDate: string;
  status: string;
  totalAmount: string | number;
  paidAmount: string | number;
  outstandingAmount: string | number;
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
    licensePlate: string;
  };
  payments: Array<{
    id: number;
    amount: string | number;
    paymentDate: string;
    paymentMethod: 'cash' | 'card' | 'transfer';
    status: 'pending' | 'completed';
  }>;
};

type PaymentStats = {
  paymentsCount: number;
  completedPaymentsCount: number;
  totalCollected: string | number;
  averagePayment: string | number;
  outstandingAmount: string | number;
  paidOrdersCount: number;
  partiallyPaidOrdersCount: number;
  unpaidOrdersCount: number;
};

type MechanicPayroll = {
  id: number;
  user: {
    username: string;
  };
  hourlyRate: string | number;
  isAvailable?: boolean;
};

type PaymentForm = {
  amount: string;
  paymentMethod: 'cash' | 'card' | 'transfer';
  paymentDate: string;
};

const emptyPaymentForm: PaymentForm = {
  amount: '',
  paymentMethod: 'cash',
  paymentDate: new Date().toISOString().split('T')[0]
};

function money(value: string | number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function paymentStatusLabel(status: FinancialOrder['paymentStatus']) {
  if (status === 'paid') return 'Оплачено';
  if (status === 'partially_paid') return 'Частково оплачено';
  return 'Не оплачено';
}

function paymentStatusClass(status: FinancialOrder['paymentStatus']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'partially_paid') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

export const Finance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payments' | 'stats'>('payments');
  const [orders, setOrders] = useState<FinancialOrder[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partially_paid' | 'unpaid'>('all');
  const [selectedOrder, setSelectedOrder] = useState<FinancialOrder | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [form, setForm] = useState<PaymentForm>(emptyPaymentForm);
  const [mechanics, setMechanics] = useState<MechanicPayroll[]>([]);
  const [payrollLedger, setPayrollLedger] = useState<Record<number, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mechanic-payout-ledger') || '{}') as Record<number, number>;
    } catch {
      return {};
    }
  });

  const loadFinance = async () => {
    try {
      const [ordersResponse, statsResponse] = await Promise.all([
        api.get<FinancialOrder[]>('/payments/finance/orders'),
        api.get<PaymentStats>('/payments/stats')
      ]);
      setOrders(ordersResponse.data);
      setStats(statsResponse.data);
    } catch (error) {
      toast.error('Не вдалося завантажити фінансові дані');
    } finally {
      setLoading(false);
    }

    try {
      const mechanicsResponse = await api.get<MechanicPayroll[]>('/workers/mechanics');
      setMechanics(mechanicsResponse.data);
    } catch {
      setMechanics([]);
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  useEffect(() => {
    localStorage.setItem('mechanic-payout-ledger', JSON.stringify(payrollLedger));
  }, [payrollLedger]);

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'all') return orders;
    return orders.filter((order) => order.paymentStatus === filterStatus);
  }, [filterStatus, orders]);

  const financeSummary = useMemo(() => {
    const openInvoices = orders.filter((order) => order.paymentStatus !== 'paid').length;
    const partiallyPaid = orders.filter((order) => order.paymentStatus === 'partially_paid').length;

    return {
      openInvoices,
      partiallyPaid
    };
  }, [orders]);

  const openPaymentModal = (order: FinancialOrder) => {
    setSelectedOrder(order);
    const outstanding = Number(order.outstandingAmount);
    setForm({
      amount: String(outstanding > 0 ? outstanding : Number(order.totalAmount)),
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().split('T')[0]
    });
    setShowPaymentModal(true);
  };

  const registerPayment = async () => {
    if (!selectedOrder) return;

    try {
      await api.post(`/payments/orders/${selectedOrder.id}/pay`, {
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        paymentDate: `${form.paymentDate}T12:00:00.000Z`
      });
      toast.success('Платіж зареєстровано');
      setShowPaymentModal(false);
      setSelectedOrder(null);
      setForm(emptyPaymentForm);
      loadFinance();
    } catch (error) {
      toast.error('Не вдалося зареєструвати платіж');
    }
  };

  const payoutMechanic = (mechanic: MechanicPayroll) => {
    const scheduled = Number(mechanic.hourlyRate) * 160;
    const alreadyPaid = payrollLedger[mechanic.id] ?? 0;
    const payout = Math.max(0, scheduled - alreadyPaid);

    setPayrollLedger((current) => ({
      ...current,
      [mechanic.id]: alreadyPaid + payout
    }));

    toast.success(`Виплату ${mechanic.user.username} зафіксовано: ${money(payout)} грн`);
  };

  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ orders, stats }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finance-report.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">Завантаження фінансів...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Фінансовий облік</h1>
            <p className="text-sm sm:text-base text-gray-600">Платежі, заборгованість, виплати та звітність в одному місці</p>
          </div>
          <button
            onClick={exportReport}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            <span>Експорт звіту</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Сума до сплати</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{money(stats?.outstandingAmount ?? 0)} грн</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Зібрано</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{money(stats?.totalCollected ?? 0)} грн</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Платежів</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats?.paymentsCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Оплачені замовлення</p>
            <p className="mt-1 text-xl font-bold text-violet-700">{stats?.paidOrdersCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Відкриті рахунки</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{financeSummary.openInvoices}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1 w-fit">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-2 rounded-xl ${activeTab === 'payments' ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          Платежі
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-5 py-2 rounded-xl ${activeTab === 'stats' ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          Статистика
        </button>
      </div>

      {activeTab === 'payments' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Статус:</span>
              <select
                value={filterStatus}
                onChange={(event) =>
                  setFilterStatus(event.target.value as 'all' | 'paid' | 'partially_paid' | 'unpaid')
                }
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="all">Усі</option>
                <option value="paid">Оплачені</option>
                <option value="partially_paid">Частково оплачені</option>
                <option value="unpaid">Неоплачені</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {order.vehicle.make} {order.vehicle.model}
                        </h3>
                        <p className="text-sm text-gray-500">{order.client.user.username}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">{order.vehicle.licensePlate}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{money(order.totalAmount)} грн</p>
                    <p className="text-sm text-gray-500">До сплати: {money(order.outstandingAmount)} грн</p>
                    <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs ${paymentStatusClass(order.paymentStatus)}`}>
                      {paymentStatusLabel(order.paymentStatus)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {order.payments.map((payment) => (
                    <span
                      key={payment.id}
                      className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                    >
                      {payment.paymentMethod} · {money(payment.amount)} грн
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => openPaymentModal(order)}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 px-4 py-2 text-emerald-600 hover:bg-emerald-50"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Зареєструвати платіж</span>
                  </button>
                </div>
              </div>
            ))}

            {filteredOrders.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                Замовлень за обраним статусом не знайдено
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Зведення</h3>
            <div className="space-y-3 text-sm">
              <p>Всього платежів: {stats?.paymentsCount ?? 0}</p>
              <p>Підтверджених платежів: {stats?.completedPaymentsCount ?? 0}</p>
              <p>Середній платіж: {money(stats?.averagePayment ?? 0)} грн</p>
              <p>Оплачених замовлень: {stats?.paidOrdersCount ?? 0}</p>
              <p>Частково оплачених: {stats?.partiallyPaidOrdersCount ?? 0}</p>
              <p>Неоплачених: {stats?.unpaidOrdersCount ?? 0}</p>
              <p>З відкритим балансом: {financeSummary.openInvoices}</p>
              <p>Часткових оплат: {financeSummary.partiallyPaid}</p>
            </div>
          </div>

          <div className="md:col-span-2 rounded-3xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Штучна виплата зарплатні механікам</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {mechanics.map((mechanic) => {
                const monthlyEstimate = Number(mechanic.hourlyRate) * 160;
                const alreadyPaid = payrollLedger[mechanic.id] ?? 0;
                const remaining = Math.max(0, monthlyEstimate - alreadyPaid);

                return (
                  <div key={mechanic.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="font-semibold text-gray-900">{mechanic.user.username}</h4>
                    <p className="mt-1 text-sm text-gray-500">Ставка: {money(mechanic.hourlyRate)} грн/год</p>
                    <p className="mt-1 text-sm text-gray-500">Нараховано: {money(monthlyEstimate)} грн</p>
                    <p className="mt-1 text-sm text-gray-500">Вже виплачено: {money(alreadyPaid)} грн</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">До виплати: {money(remaining)} грн</p>
                    <button
                      onClick={() => payoutMechanic(mechanic)}
                      className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                    >
                      Зафіксувати виплату
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-2xl font-bold text-gray-900">Новий платіж</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedOrder(null);
                }}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сума</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(event) => setForm((state) => ({ ...state, amount: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Метод</label>
                <select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      paymentMethod: event.target.value as PaymentForm['paymentMethod']
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                >
                  <option value="cash">Готівка</option>
                  <option value="card">Картка</option>
                  <option value="transfer">Переказ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={(event) => setForm((state) => ({ ...state, paymentDate: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
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
                  onClick={registerPayment}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700"
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
