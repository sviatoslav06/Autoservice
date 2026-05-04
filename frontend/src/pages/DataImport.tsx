import React, { useState } from 'react';
import { CheckCircle2, Database, Download, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

type ExternalImportReport = {
  sourceSummary: {
    allowsMixedSources: boolean;
    usesGeneratedValues: boolean;
    targetTables: string[];
  };
  targets: {
    minExternalRecords: number;
  };
  importedRows: Record<string, number>;
  totals: {
    externalRecords: number;
    requirementSatisfied: boolean;
  };
};

type DataImportResponse = {
  message?: string;
  report?: ExternalImportReport;
};

export const DataImport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [report, setReport] = useState<ExternalImportReport | null>(null);

  const runImport = async () => {
    setLoading(true);
    setResult(null);
    setReport(null);

    try {
      const response = await api.post<DataImportResponse>('/data-import/external-data/import');
      setResult(response.data?.message ?? 'Дані успішно імпортовано');
      setReport(response.data?.report ?? null);
      toast.success('Зовнішні дані завантажено');
    } catch {
      toast.error('Не вдалося запустити імпорт');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4" />
              Демо-дані для старту
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Завантаження реалістичного демо-набору
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              Імпортуються зовнішні каталоги автомобілів, деталей, послуг, боксів, механіків і
              генерація замовлень.
            </p>
          </div>

          <button
            onClick={runImport}
            disabled={loading}
            className="inline-flex items-center gap-3 rounded-2xl bg-blue-600 px-6 py-3 text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            <span>{loading ? 'Імпорт виконується...' : 'Запустити імпорт'}</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Database className="h-6 w-6 text-blue-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Що оновлюється</h2>
          <p className="mt-2 text-sm text-gray-600">
            Клієнти, машини, бокси, механіки, деталі, послуги та замовлення.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Database className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Джерела</h2>
          <p className="mt-2 text-sm text-gray-600">
            Використовуються відкриті каталоги, а відсутні значення добираються генератором.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Database className="h-6 w-6 text-amber-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Обсяг</h2>
          <p className="mt-2 text-sm text-gray-600">
            Генерується не менше 1000 записів по зовнішніх таблицях.
          </p>
        </div>
      </div>

      {result && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {result}
        </div>
      )}

      {report && (
        <div className="mt-6 space-y-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              report.totals.requirementSatisfied
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Підсумок імпорту
            </div>
            <p className="mt-1">
              Зовнішніх записів: {report.totals.externalRecords} (мінімум: {report.targets.minExternalRecords})
            </p>
            <p className="mt-1">
              Статус вимоги: {report.totals.requirementSatisfied ? 'виконано' : 'не виконано'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-gray-900">Таблиці зовнішньої ініціалізації</h3>
            <p className="mt-1 text-sm text-gray-600">
              Використано {report.sourceSummary.targetTables.length} таблиць: {report.sourceSummary.targetTables.join(', ')}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.sourceSummary.targetTables.map((tableName) => (
                <div key={tableName} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-medium text-gray-700">{tableName}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{report.importedRows[tableName] ?? 0}</p>
                  <p className="text-xs text-gray-500">імпортовано записів</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
