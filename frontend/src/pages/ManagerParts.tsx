import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, Package, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

type Category = {
  id: number;
  name: string;
  description?: string | null;
};

type Part = {
  id: number;
  categoryId: number;
  article: string;
  name: string;
  basePrice: string | number;
  stockQuantity: number;
  supplier?: string | null;
  category?: Category;
  customFields?: Array<{
    fieldId: number;
    fieldValue: string;
    field: CategoryField;
  }>;
};

type PartForm = {
  categoryId: string;
  article: string;
  name: string;
  basePrice: string;
  stockQuantity: string;
  supplier: string;
  customFields: Array<{
    fieldId: number;
    value: string;
  }>;
};

type CategoryField = {
  id: number;
  categoryId: number;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean';
  isRequired: boolean;
};

type FieldForm = {
  fieldName: string;
  fieldType: CategoryField['fieldType'];
  isRequired: boolean;
};

const emptyForm: PartForm = {
  categoryId: '',
  article: '',
  name: '',
  basePrice: '',
  stockQuantity: '0',
  supplier: '',
  customFields: []
};

const emptyFieldForm: FieldForm = {
  fieldName: '',
  fieldType: 'text',
  isRequired: false
};

type CategoryForm = {
  name: string;
  description: string;
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  description: ''
};

export const ManagerParts: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState<Part | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PartForm>(emptyForm);
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([]);
  const [partFields, setPartFields] = useState<CategoryField[]>([]);
  const [fieldForm, setFieldForm] = useState<FieldForm>(emptyFieldForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);

  const loadData = async () => {
    try {
      const [partsResponse, categoriesResponse] = await Promise.all([
        api.get<Part[]>('/parts'),
        api.get<Category[]>('/part-categories')
      ]);
      setParts(partsResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      toast.error('Не вдалося завантажити деталі');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loadFields = async () => {
      if (categoryFilter === 'all') {
        setCategoryFields([]);
        return;
      }

      try {
        const response = await api.get<CategoryField[]>(`/part-fields/${categoryFilter}`);
        setCategoryFields(response.data);
      } catch {
        setCategoryFields([]);
      }
    };

    loadFields();
    setFieldForm(emptyFieldForm);
  }, [categoryFilter]);

  useEffect(() => {
    const loadPartFields = async () => {
      if (!showModal || !form.categoryId) {
        setPartFields([]);
        return;
      }

      try {
        const response = await api.get<CategoryField[]>(`/part-fields/${form.categoryId}`);
        setPartFields(response.data);
      } catch {
        setPartFields([]);
      }
    };

    loadPartFields();
  }, [form.categoryId, showModal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts.filter((part) => {
      const matchesSearch = !q
        ? true
        : [part.name, part.article, part.supplier ?? '', part.category?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q);
      const matchesCategory = categoryFilter === 'all' || String(part.categoryId) === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [search, categoryFilter, parts]);

  const stats = useMemo(() => {
    const totalStock = parts.reduce((sum, part) => sum + Number(part.stockQuantity || 0), 0);
    const inventoryValue = parts.reduce(
      (sum, part) => sum + Number(part.basePrice || 0) * Number(part.stockQuantity || 0),
      0
    );

    return {
      total: parts.length,
      categories: categories.length,
      totalStock,
      inventoryValue
    };
  }, [parts, categories]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (part: Part) => {
    setEditing(part);
    setForm({
      categoryId: String(part.categoryId),
      article: part.article,
      name: part.name,
      basePrice: String(part.basePrice),
      stockQuantity: String(part.stockQuantity),
      supplier: part.supplier ?? '',
      customFields:
        part.customFields?.map((field) => ({
          fieldId: field.fieldId,
          value: field.fieldValue
        })) ?? []
    });
    setShowModal(true);
  };

  const savePart = async () => {
    const fieldDefinitions = new Map(partFields.map((field) => [field.id, field]));
    const payload = {
      categoryId: Number(form.categoryId),
      article: form.article.trim(),
      name: form.name.trim(),
      basePrice: Number(form.basePrice),
      stockQuantity: Number(form.stockQuantity),
      supplier: form.supplier.trim() || undefined,
      customFields: form.customFields
        .filter((field) => {
          const definition = fieldDefinitions.get(field.fieldId);
          if (!definition) return false;
          if (definition.isRequired) return true;
          return field.value.trim().length > 0;
        })
        .map((field) => ({
          fieldId: field.fieldId,
          value: field.value
        }))
    };

    try {
      if (editing) {
        await api.put(`/parts/${editing.id}`, payload);
        toast.success('Деталь оновлено');
      } else {
        await api.post('/parts', payload);
        toast.success('Деталь додано');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadData();
    } catch (error) {
      toast.error('Не вдалося зберегти деталь');
    }
  };

  const removePart = async (id: number) => {
    if (!confirm('Видалити цю деталь?')) return;

    try {
      await api.delete(`/parts/${id}`);
      setParts((current) => current.filter((part) => part.id !== id));
      toast.success('Деталь видалено');
    } catch (error) {
      toast.error('Не вдалося видалити деталь');
    }
  };

  const saveField = async () => {
    if (categoryFilter === 'all') {
      toast.error('Оберіть категорію для створення поля');
      return;
    }

    try {
      await api.post('/part-fields', {
        categoryId: Number(categoryFilter),
        fieldName: fieldForm.fieldName.trim(),
        fieldType: fieldForm.fieldType,
        isRequired: fieldForm.isRequired
      });
      toast.success('Поле категорії додано');
      const response = await api.get<CategoryField[]>(`/part-fields/${categoryFilter}`);
      setCategoryFields(response.data);
      setFieldForm(emptyFieldForm);
    } catch {
      toast.error('Не вдалося створити поле');
    }
  };

  const removeField = async (id: number) => {
    if (!confirm('Видалити це поле категорії?')) return;

    try {
      await api.delete(`/part-fields/${id}`);
      setCategoryFields((current) => current.filter((field) => field.id !== id));
      toast.success('Поле видалено');
    } catch {
      toast.error('Не вдалося видалити поле');
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Вкажіть назву категорії');
      return;
    }

    try {
      const response = await api.post<Category>('/part-categories', {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined
      });

      setCategories((current) => [...current, response.data]);
      setCategoryForm(emptyCategoryForm);
      toast.success('Категорію додано');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Не вдалося створити категорію');
    }
  };

  const removeCategory = async (id: number) => {
    if (!confirm('Видалити цю категорію?')) return;

    try {
      await api.delete(`/part-categories/${id}`);
      setCategories((current) => current.filter((category) => category.id !== id));
      if (categoryFilter === String(id)) {
        setCategoryFilter('all');
      }
      toast.success('Категорію видалено');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Не вдалося видалити категорію');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Завантаження деталей...</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Управління деталями</h1>
            <p className="text-sm sm:text-base text-gray-600">Склад, категорії, поля та постачальники</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Додати деталь</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Номенклатура</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Категорії</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{stats.categories}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Залишок</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.totalStock}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white/90 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Вартість складу</p>
            <p className="mt-1 text-lg font-bold text-violet-700">{Number(stats.inventoryValue).toLocaleString('uk-UA')} грн</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук деталей..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 md:w-64"
          >
            <option value="all">Всі категорії</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-800">Категорії деталей</h3>
            <span className="text-xs text-gray-500">{categories.length} всього</span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Нова категорія"
              className="rounded-xl border border-gray-300 px-4 py-2.5"
            />
            <input
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Опис (необов'язково)"
              className="rounded-xl border border-gray-300 px-4 py-2.5"
            />
            <button
              onClick={saveCategory}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
            >
              Створити категорію
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <div key={category.id} className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm">
                <span>{category.name}</span>
                <button
                  onClick={() => removeCategory(category.id)}
                  className="rounded-full border border-red-300 p-1 text-red-600 hover:bg-red-50"
                  title="Видалити категорію"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {categoryFilter !== 'all' && (
        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Поля категорії</h2>
              <p className="text-sm text-gray-500">Налаштування додаткових характеристик для вибраної категорії</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <input
              value={fieldForm.fieldName}
              onChange={(event) => setFieldForm((current) => ({ ...current, fieldName: event.target.value }))}
              placeholder="Назва поля"
              className="rounded-xl border border-gray-300 px-4 py-2.5"
            />
            <select
              value={fieldForm.fieldType}
              onChange={(event) =>
                setFieldForm((current) => ({ ...current, fieldType: event.target.value as CategoryField['fieldType'] }))
              }
              className="rounded-xl border border-gray-300 px-4 py-2.5"
            >
              <option value="text">Текст</option>
              <option value="number">Число</option>
              <option value="date">Дата</option>
              <option value="boolean">Так / Ні</option>
            </select>
            <label className="flex items-center gap-3 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={fieldForm.isRequired}
                onChange={(event) => setFieldForm((current) => ({ ...current, isRequired: event.target.checked }))}
              />
              Обов&apos;язкове
            </label>
            <button
              onClick={saveField}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
            >
              Додати поле
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categoryFields.map((field) => (
              <div key={field.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{field.fieldName}</p>
                    <p className="text-xs text-gray-500">
                      {field.fieldType} {field.isRequired ? '· обов’язкове' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeField(field.id)}
                    className="rounded-lg border border-red-600 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Деталь</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Артикул</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категорія</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ціна</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Залишок</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Постачальник</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((part) => (
                <tr key={part.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{part.name}</p>
                        {part.customFields?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {part.customFields.map((field) => (
                              <span
                                key={field.fieldId}
                                className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700"
                              >
                                {field.field.fieldName}: {field.fieldValue}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{part.article}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{part.category?.name ?? 'Без категорії'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{Number(part.basePrice)} грн</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{part.stockQuantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{part.supplier || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(part)}
                        className="rounded-lg border border-blue-600 p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removePart(part.id)}
                        className="rounded-lg border border-red-600 p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!filtered.length && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
          Деталей не знайдено
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editing ? 'Редагувати деталь' : 'Додати деталь'}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Категорія</label>
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        categoryId: event.target.value,
                        customFields: []
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  >
                    <option value="">Оберіть категорію</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Артикул</label>
                  <input
                    value={form.article}
                    onChange={(event) => setForm((state) => ({ ...state, article: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ціна</label>
                  <input
                    type="number"
                    value={form.basePrice}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, basePrice: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Залишок</label>
                  <input
                    type="number"
                    value={form.stockQuantity}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, stockQuantity: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Постачальник</label>
                <input
                  value={form.supplier}
                  onChange={(event) => setForm((state) => ({ ...state, supplier: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>

              {!!partFields.length && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900">Додаткові поля категорії</h3>
                    <p className="text-sm text-gray-500">Поля залежать від обраної категорії</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {partFields.map((field) => {
                      const currentValue =
                        form.customFields.find((item) => item.fieldId === field.id)?.value ?? '';

                      const updateFieldValue = (value: string) => {
                        setForm((state) => ({
                          ...state,
                          customFields: [
                            ...state.customFields.filter((item) => item.fieldId !== field.id),
                            { fieldId: field.id, value }
                          ]
                        }));
                      };

                      return (
                        <div key={field.id} className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {field.fieldName}
                            {field.isRequired ? ' *' : ''}
                          </label>
                          {field.fieldType === 'boolean' ? (
                            <select
                              value={currentValue}
                              onChange={(event) => updateFieldValue(event.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2"
                            >
                              <option value="">Оберіть значення</option>
                              <option value="true">Так</option>
                              <option value="false">Ні</option>
                            </select>
                          ) : (
                            <input
                              type={
                                field.fieldType === 'number'
                                  ? 'number'
                                  : field.fieldType === 'date'
                                    ? 'date'
                                    : 'text'
                              }
                              value={currentValue}
                              onChange={(event) => updateFieldValue(event.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Скасувати
                </button>
                <button
                  onClick={savePart}
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
