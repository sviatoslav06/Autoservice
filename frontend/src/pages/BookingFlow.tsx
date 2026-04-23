import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, Car, CheckCircle, Plus, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
};

type Service = {
  id: number;
  name: string;
  standardPrice: string | number;
  durationMinutes: number;
  category?: string;
};

type Box = {
  id: number;
  boxNumber: string;
  status: string;
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

function formatMoney(value: string | number) {
  return `${Number(value || 0).toLocaleString('uk-UA')} ₴`;
}

export const BookingFlow: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [availableMechanics, setAvailableMechanics] = useState<Mechanic[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | null>(null);

  const calendarDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 21; i += 1) {
      const next = new Date(today);
      next.setDate(today.getDate() + i);
      dates.push({
        date: next.toISOString().split('T')[0],
        day: next.getDate(),
        month: next.toLocaleDateString('uk-UA', { month: 'short' }),
        weekday: next.toLocaleDateString('uk-UA', { weekday: 'short' }),
        available: next.getDay() !== 0
      });
    }
    return dates;
  }, []);

  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [vehiclesResponse, servicesResponse] = await Promise.all([
          api.get('/vehicles/my'),
          api.get('/services')
        ]);
        setVehicles(vehiclesResponse.data);
        setServices(servicesResponse.data);
      } catch {
        toast.error('Не вдалося завантажити дані для запису');
      }
    };

    loadData();
  }, []);

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, service) => sum + Number(service.standardPrice), 0),
    [selectedServices]
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0),
    [selectedServices]
  );

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();

    if (!q) {
      return services;
    }

    return services.filter((service) => {
      return [service.name, service.category ?? '', String(service.durationMinutes ?? ''), String(service.standardPrice ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [serviceSearch, services]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!selectedDate || !selectedTime || !selectedServices.length) return;

      const startTime = `${selectedDate}T${selectedTime}:00`;

      try {
        const [boxesResponse, mechanicsResponse] = await Promise.all([
          api.get('/boxes/available', {
            params: { startTime, durationMinutes: totalDuration }
          }),
          api.get('/workers/mechanics/available', {
            params: { startTime, durationMinutes: totalDuration }
          })
        ]);

        const boxes: Box[] = boxesResponse.data;
        const recommendedBox = boxes.find((box) => box.isAvailable);

        setAvailableBoxes(boxes);
        setAvailableMechanics(mechanicsResponse.data);
        setSelectedBoxId((current) => {
          if (current && boxes.some((box) => box.id === current && box.isAvailable)) {
            return current;
          }

          return recommendedBox?.id ?? null;
        });
        setSelectedMechanicId(mechanicsResponse.data[0]?.id ?? null);
      } catch {
        setAvailableBoxes([]);
        setAvailableMechanics([]);
        setSelectedBoxId(null);
        setSelectedMechanicId(null);
      }
    };

    loadAvailability();
  }, [selectedDate, selectedTime, selectedServices, totalDuration]);

  const handleNext = () => {
    if (step === 1 && !selectedVehicle) {
      toast.error('Оберіть автомобіль');
      return;
    }
    if (step === 2 && !selectedServices.length) {
      toast.error('Оберіть хоча б одну послугу');
      return;
    }
    if (step === 3 && (!selectedDate || !selectedTime)) {
      toast.error('Оберіть дату та час');
      return;
    }
    setStep((current) => current + 1);
  };

  const handleSubmit = async () => {
    if (!selectedVehicle || !selectedServices.length || !selectedBoxId || !selectedMechanicId) {
      toast.error('Заповніть усі кроки');
      return;
    }

    try {
      await api.post('/orders', {
        vehicleId: selectedVehicle.id,
        boxId: selectedBoxId,
        startTime: `${selectedDate}T${selectedTime}:00`,
        services: selectedServices.map((service) => ({
          serviceId: service.id,
          workerId: selectedMechanicId
        }))
      });
      toast.success('Замовлення успішно створено');
      navigate('/my-orders');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Помилка створення замовлення');
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Запис на сервіс</h1>
        <p className="text-sm sm:text-base text-gray-600">Крок {step} з 4</p>
      </div>

      <div className="mb-8">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[620px] items-start">
            {[
              { id: 1, label: 'Авто' },
              { id: 2, label: 'Послуги' },
              { id: 3, label: 'Дата' },
              { id: 4, label: 'Підтвердження' }
            ].map((stepItem, index, allSteps) => (
              <React.Fragment key={stepItem.id}>
                <div className="flex min-w-0 flex-1 flex-col items-center px-2 text-center">
                  <div
                    className={`h-8 w-8 rounded-full text-sm font-semibold flex items-center justify-center ${
                      step >= stepItem.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {stepItem.id}
                  </div>
                  <span
                    className={`mt-2 text-xs sm:text-sm leading-tight ${
                      step >= stepItem.id ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {stepItem.label}
                  </span>
                </div>
                {index < allSteps.length - 1 ? (
                  <div
                    className={`mt-4 h-1 min-w-[28px] flex-1 rounded-full ${
                      step > stepItem.id ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 md:p-8">
        {step === 1 ? (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">Виберіть автомобіль</h2>
            {vehicles.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((vehicle) => (
                  <Card
                    key={vehicle.id}
                    className={`cursor-pointer transition-all ${selectedVehicle?.id === vehicle.id ? 'ring-2 ring-blue-600' : 'hover:border-blue-300'}`}
                    onClick={() => setSelectedVehicle(vehicle)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Car className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{vehicle.make} {vehicle.model}</p>
                          <p className="text-sm text-gray-500">{vehicle.year} • {vehicle.licensePlate}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-600">
                  У вас немає автомобілів. Додайте авто перед записом на сервіс.
                </CardContent>
              </Card>
            )}
            <button
              onClick={() => navigate('/my-vehicles')}
              className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Додати новий автомобіль
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">Виберіть послуги</h2>
            <div className="mb-4 max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Пошук послуг..."
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="space-y-3">
              {filteredServices.map((service) => {
                const selected = selectedServices.some((item) => item.id === service.id);
                return (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all ${selected ? 'ring-2 ring-blue-600 bg-blue-50/30' : 'hover:border-blue-300'}`}
                    onClick={() => {
                      setSelectedServices((current) =>
                        selected ? current.filter((item) => item.id !== service.id) : [...current, service]
                      );
                    }}
                  >
                    <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{service.name}</p>
                        <p className="text-sm text-gray-500">
                          {service.category ? `${service.category} • ` : ''}
                          {service.durationMinutes} хв
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">{formatMoney(service.standardPrice)}</p>
                    </CardContent>
                  </Card>
                );
              })}
              {!filteredServices.length ? (
                <Card>
                  <CardContent className="p-6 text-center text-gray-500">
                    Послуг не знайдено
                  </CardContent>
                </Card>
              ) : null}
            </div>
            {selectedServices.length ? (
              <div className="mt-5 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Загальна вартість</span>
                  <span className="font-bold text-blue-700">{formatMoney(totalPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Орієнтовний час</span>
                  <span className="font-medium text-gray-700">~{totalDuration} хв</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">Виберіть дату і час</h2>

            <h3 className="font-medium text-gray-900 mb-3">Дата</h3>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-72 overflow-y-auto pr-1">
              {calendarDates.map((dateObj) => (
                <button
                  key={dateObj.date}
                  onClick={() => dateObj.available && setSelectedDate(dateObj.date)}
                  disabled={!dateObj.available}
                  className={`p-2 rounded-lg text-center transition-all border ${
                    selectedDate === dateObj.date
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dateObj.available
                      ? 'bg-white border-gray-200 hover:border-blue-300'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <div className="text-[10px] sm:text-xs">{dateObj.weekday}</div>
                  <div className="font-bold text-base">{dateObj.day}</div>
                  <div className="text-[10px] sm:text-xs">{dateObj.month}</div>
                </button>
              ))}
            </div>

            {selectedDate ? (
              <>
                <h3 className="font-medium text-gray-900 mb-3 mt-6">Час</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`py-2.5 rounded-lg border transition-all ${
                        selectedTime === time
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <Card className={selectedBoxId ? 'ring-2 ring-blue-600' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-gray-500">Автоматично обраний бокс</p>
                  <p className="font-medium mt-1">
                    {availableBoxes.find((box) => box.id === selectedBoxId)?.boxNumber ?? 'Немає доступних'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Підбирається системою за вільним слотом</p>
                </CardContent>
              </Card>

              <Card className={selectedMechanicId ? 'ring-2 ring-blue-600' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-gray-500">Автоматично обраний механік</p>
                  <p className="font-medium mt-1">
                    {availableMechanics.find((mechanic) => mechanic.id === selectedMechanicId)?.user.username ?? 'Немає доступних'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Механік призначається автоматично</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
                <CalendarIcon className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Підтвердження замовлення</h2>
              <p className="text-sm text-gray-600">Перевірте всі деталі перед відправкою</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs uppercase text-gray-500">Автомобіль</p>
                <p className="font-medium mt-1">
                  {selectedVehicle?.make} {selectedVehicle?.model} • {selectedVehicle?.licensePlate}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs uppercase text-gray-500 mb-2">Послуги</p>
                {selectedServices.map((service) => (
                  <div key={service.id} className="flex justify-between text-sm py-1">
                    <span>{service.name}</span>
                    <span>{formatMoney(service.standardPrice)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold">
                  <span>Разом</span>
                  <span>{formatMoney(totalPrice)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs uppercase text-gray-500">Дата і час</p>
                <p className="font-medium mt-1">{selectedDate} • {selectedTime}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-sm">
                  <div>
                    <span className="text-gray-500">Бокс: </span>
                    <span>{availableBoxes.find((box) => box.id === selectedBoxId)?.boxNumber ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Механік: </span>
                    <span>{availableMechanics.find((mechanic) => mechanic.id === selectedMechanicId)?.user.username ?? '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button onClick={handleNext}>
              Далі
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" />
              Підтвердити запис
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 text-sm text-gray-500 flex items-center gap-2">
        <Wrench className="w-4 h-4" />
        Призначення боксу та механіка виконується автоматично на основі вільних слотів.
      </div>
    </div>
  );
};
