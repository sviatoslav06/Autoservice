import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Car } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';
import { Button } from '../components/ui/button';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  kilometrage?: number;
}

export const MyVehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles/my');
      setVehicles(res.data);
    } catch (err) {
      toast.error('Не вдалося завантажити автомобілі');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleAdd = async () => {
    if (!formData.make || !formData.model || !formData.year || !formData.licensePlate || !formData.vin) {
      toast.error('Заповніть обов’язкові поля');
      return;
    }

    try {
      const res = await api.post('/vehicles', formData);
      setVehicles((current) => [...current, res.data]);
      setShowModal(false);
      setFormData({});
      toast.success('Автомобіль успішно додано!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка додавання');
    }
  };

  const handleEdit = async () => {
    if (!editingVehicle) return;

    try {
      const updated = await api.put(`/vehicles/${editingVehicle.id}`, formData);
      setVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === editingVehicle.id ? updated.data : vehicle
        )
      );
      setEditingVehicle(null);
      setFormData({});
      setShowModal(false);
      toast.success('Автомобіль оновлено!');
    } catch (err: any) {
      toast.error('Помилка оновлення');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Видалити цей автомобіль?')) return;

    try {
      await api.delete(`/vehicles/${id}`);
      setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
      toast.success('Автомобіль видалено');
    } catch {
      toast.error('Не вдалося видалити автомобіль');
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData(vehicle);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingVehicle(null);
    setFormData({
      make: '',
      model: '',
      year: new Date().getFullYear(),
      vin: '',
      licensePlate: '',
      kilometrage: 0
    });
    setShowModal(true);
  };

  if (loading) return <div className="p-8 text-center">Завантаження...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Мої автомобілі</h1>
          <p className="text-gray-600">Керуйте вашими транспортними засобами</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Додати автомобіль</span>
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">Ще немає автомобілів</h3>
          <p className="text-gray-600 mb-6">Додайте ваш перший автомобіль для початку роботи</p>
          <button
            onClick={openCreateModal}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Додати перший автомобіль</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                      <Car className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {vehicle.make} {vehicle.model}
                      </h3>
                      <p className="text-sm text-gray-500">{vehicle.year}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Номерний знак</span>
                    <span className="text-sm font-medium text-gray-900">
                      {vehicle.licensePlate}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">VIN-код</span>
                    <span className="text-xs font-mono text-gray-900">
                      {vehicle.vin ? `${vehicle.vin.slice(0, 8)}...` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Пробіг</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(vehicle.kilometrage ?? 0).toLocaleString('uk-UA')} км
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openEditModal(vehicle)}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="text-sm">Редагувати</span>
                  </button>
                  <button
                    onClick={() => handleDelete(vehicle.id)}
                    className="flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg mx-4">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">
                {editingVehicle ? 'Редагувати автомобіль' : 'Додати автомобіль'}
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1 font-medium">Марка *</label>
                    <input
                      type="text"
                      value={formData.make || ''}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                      className="w-full px-4 py-3 border rounded-2xl"
                      placeholder="Toyota"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">Модель *</label>
                    <input
                      type="text"
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-4 py-3 border rounded-2xl"
                      placeholder="Camry"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1 font-medium">Рік *</label>
                    <input
                      type="number"
                      value={formData.year || ''}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) })}
                      className="w-full px-4 py-3 border rounded-2xl"
                      min={1980}
                      max={new Date().getFullYear() + 1}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">Номерний знак *</label>
                    <input
                      type="text"
                      value={formData.licensePlate || ''}
                      onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                      className="w-full px-4 py-3 border rounded-2xl font-mono"
                      placeholder="AA 1234 BB"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-medium">Пробіг (км)</label>
                    <input
                      type="number"
                      value={formData.kilometrage || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, kilometrage: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-4 py-3 border rounded-2xl"
                      placeholder="24500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1 font-medium">VIN-код *</label>
                  <input
                    type="text"
                    value={formData.vin || ''}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                    className="w-full px-4 py-3 border rounded-2xl font-mono"
                    placeholder="JT2BF22KX20012345"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowModal(false);
                      setEditingVehicle(null);
                      setFormData({});
                    }}
                  >
                    Скасувати
                  </Button>
                  <Button className="flex-1" onClick={editingVehicle ? handleEdit : handleAdd}>
                    {editingVehicle ? 'Зберегти зміни' : 'Додати автомобіль'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};