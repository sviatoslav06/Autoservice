import React, { useState } from 'react';
import { XCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  id: string;
  orderNumber: string;
  vehicle: {
    brand: string;
    model: string;
    licensePlate: string;
  };
}

interface CancelOrderModalProps {
  order: Order;
  onCancel: (reason: string) => void;
  onClose: () => void;
  processing: boolean;
  success: boolean;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  onCancel,
  onClose,
  processing,
  success,
}) => {
  const [reason, setReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');

  const predefinedReasons = [
    'Змінилися плани',
    'Знайшов інший автосервіс',
    'Не влаштовує ціна',
    'Не влаштовує час',
    'Інше',
  ];

  const handleSubmit = () => {
    const finalReason = selectedReason === 'Інше' ? reason : selectedReason;
    if (!finalReason) {
      toast.error('Будь ласка, вкажіть причину скасування');
      return;
    }
    onCancel(finalReason);
    toast.success('Замовлення скасовано');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl">
        <div className="p-6 sm:p-7">
          {!success ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Скасування замовлення
                    </h2>
                    <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  disabled={processing}
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">
                    Увага! Скасування замовлення може призвести до штрафних санкцій,
                    якщо до початку обслуговування залишилося менше 24 годин.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Причина скасування
                  </label>
                  <div className="space-y-2">
                    {predefinedReasons.map((predefinedReason) => (
                      <label
                        key={predefinedReason}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl border border-transparent px-2 py-1.5 transition-colors hover:bg-muted/60"
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={predefinedReason}
                          checked={selectedReason === predefinedReason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                          className="h-4 w-4 text-primary"
                          disabled={processing}
                        />
                        <span className="text-sm text-foreground">{predefinedReason}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedReason === 'Інше' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Опишіть причину
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      disabled={processing}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                      placeholder="Будь ласка, опишіть причину скасування..."
                    />
                  </div>
                )}

                {processing && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 animate-spin text-amber-700" />
                      <div>
                        <h3 className="font-medium text-amber-900">Обробка запиту</h3>
                        <p className="text-sm text-amber-700">
                          Зачекайте, будь ласка...
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 mt-6">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="flex-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Назад
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing || !selectedReason}
                  className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    processing || !selectedReason
                      ? 'cursor-not-allowed bg-muted text-muted-foreground'
                      : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  }`}
                >
                  Скасувати замовлення
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h3 className="mb-2 text-2xl font-semibold text-green-900">
                  Замовлення скасовано!
                </h3>
                <p className="text-green-700">
                  Замовлення {order.orderNumber} успішно скасовано
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
