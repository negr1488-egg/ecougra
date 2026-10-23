import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { api } from '../../lib/supabaseClient';

const FIELD_PRESETS = [
  { name: 'Мамонтовский куст (Стандарт)', prod: 14000, apg: 95.5, eq: 'modern', res: 15 },
  { name: 'Приобский энергокомплекс (ГТЭС)', prod: 28000, apg: 98.2, eq: 'hybrid', res: 25 },
  { name: 'Удалённый автономный участок (Старый фонд)', prod: 8500, apg: 84.0, eq: 'legacy', res: 0 }
];

export default function Co2Calculator({ user, onSaved }) {
  const [fieldName, setFieldName] = useState('Мамонтовский куст (Стандарт)');
  const [production, setProduction] = useState(14000);
  const [apgRate, setApgRate] = useState(95.5);
  const [equipment, setEquipment] = useState('modern');
  const [resShare, setResShare] = useState(15);
  const [history, setHistory] = useState(() => api.getCo2History());
  const [savedBanner, setSavedBanner] = useState(false);

  const applyPreset = (p) => {
    setFieldName(p.name);
    setProduction(p.prod);
    setApgRate(p.apg);
    setEquipment(p.eq);
    setResShare(p.res);
  };

  const calc = useMemo(() => {
    const scope1Base = production * 0.165;
    const flaringFactor = Math.max(0, (100 - apgRate) / 100);
    const flaringCo2 = production * flaringFactor * 0.28;

    const eqCoeff = equipment === 'legacy' ? 1.28 : equipment === 'modern' ? 0.92 : 0.74;
    const scope2Energy = production * 0.065 * eqCoeff * (1 - resShare / 100);

    const totalOptimized = Math.round(scope1Base * eqCoeff + flaringCo2 + scope2Energy);
    const totalBaseline = Math.round(production * 0.165 * 1.28 + production * 0.12 * 0.28 + production * 0.065 * 1.28);
    const savedTons = Math.max(0, totalBaseline - totalOptimized);

    const isCompliant = apgRate >= 95;
    const moneySavedRub = Math.round(savedTons * 1450 + (isCompliant ? 850000 : -1200000));

    const structureData = [
      { name: 'Добыча', базовый: Math.round(scope1Base * 1.28), текущий: Math.round(scope1Base * eqCoeff) },
      { name: 'Факел ПНГ', базовый: Math.round(production * 0.12 * 0.28), текущий: Math.round(flaringCo2) },
      { name: 'Энергия', базовый: Math.round(production * 0.065 * 1.28), текущий: Math.round(scope2Energy) }
    ];

    const trajectoryData = [
      { year: '2024', выбросы: totalBaseline },
      { year: '2025', выбросы: Math.round(totalBaseline * 0.88) },
      { year: '2026', выбросы: totalOptimized },
      { year: '2028', выбросы: Math.round(totalOptimized * 0.82) },
      { year: '2030', выбросы: Math.round(totalOptimized * 0.65) }
    ];

    const recs = [];
    if (apgRate < 95) {
      recs.push('КРИТИЧНО: Утилизация ПНГ ниже норматива 95% РФ. Подключите модульную ГПУ или компрессорную станцию обратной закачки.');
    } else {
      recs.push('Норматив ПНГ (≥95%) выполнен. Рекомендуется внедрение микротурбин для когенерации тепла.');
    }
    if (resShare < 20) {
      recs.push('Увеличьте долю солнечных бифациальных панелей на кустовой автоматике до 20–25% для снижения Scope 2.');
    }

    return { totalOptimized, totalBaseline, savedTons, moneySavedRub, structureData, trajectoryData, recs };
  }, [production, apgRate, equipment, resShare]);

  const handleSave = async () => {
    const updatedList = await api.saveCo2Calculation({
      user_id: user?.id || 'eco-usr-1',
      field_name: fieldName,
      oil_production_tons: production,
      apg_utilization_rate: apgRate,
      equipment_type: equipment,
      res_share: resShare,
      calculated_emissions_tons: calc.totalOptimized,
      saved_emissions_tons: calc.savedTons,
      financial_effect_rub: calc.moneySavedRub
    });
    setHistory(updatedList);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
    if (onSaved) onSaved();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="eyebrow mb-2">03 / Инженерный аудит декарбонизации</div>
          <h2 className="text-3xl font-extralight text-white tracking-tight">
            Калькулятор углеродного следа <strong className="font-semibold text-[#FFAA00]">CO₂ (Scope 1 & 2)</strong>
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {FIELD_PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-all ${
                fieldName === p.name
                  ? 'border-[#FFAA00] bg-[#FFAA00]/10 text-[#FFAA00]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
        {/* Левая колонка */}
        <div className="lg:col-span-5 arch-card p-7 space-y-6 min-w-0">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-2">
              Объект расчёта (привязка к {user?.username || '@pestrikov_kv'})
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full bg-[#08090f] border border-white/10 px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#FFAA00]"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-xs mb-2">
              <span className="text-[#8A93A6]">Объём добычи нефти:</span>
              <span className="text-white font-semibold">{production.toLocaleString()} т / мес</span>
            </div>
            <input
              type="range"
              min="2000"
              max="50000"
              step="500"
              value={production}
              onChange={(e) => setProduction(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-xs mb-2">
              <span className="text-[#8A93A6]">Утилизация ПНГ (норматив ≥95%):</span>
              <span className={apgRate >= 95 ? 'text-[#34D399] font-semibold' : 'text-red-400 font-semibold'}>
                {apgRate}%
              </span>
            </div>
            <input
              type="range"
              min="75"
              max="99.5"
              step="0.5"
              value={apgRate}
              onChange={(e) => setApgRate(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-xs mb-2">
              <span className="text-[#8A93A6]">Доля ВИЭ и когенерации:</span>
              <span className="text-[#22D3EE] font-semibold">{resShare}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={resShare}
              onChange={(e) => setResShare(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-2">
              Тип насосно-компрессорного оборудования
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'legacy', label: 'Базовый фонд' },
                { id: 'modern', label: 'ЧРП Энергоэфф.' },
                { id: 'hybrid', label: 'Smart Гибрид' }
              ].map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => setEquipment(eq.id)}
                  className={`py-2.5 px-2 font-mono text-[10px] uppercase border transition-all ${
                    equipment === eq.id
                      ? 'border-[#00C853] bg-[#00C853]/15 text-white'
                      : 'border-white/10 text-[#8A93A6]'
                  }`}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3.5 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-xs font-semibold uppercase tracking-[0.2em]"
          >
            Записать расчёт в БД (+50 XP)
          </button>

          {savedBanner && (
            <div className="p-3 border border-[#00C853]/50 bg-[#00C853]/10 font-mono text-[11px] text-[#34D399] text-center">
              ✓ Записано в таблицу public.eco_co2_calculations ({user?.username})
            </div>
          )}
        </div>

        {/* Правая колонка с жёстко зафиксированными по высоте графиками */}
        <div className="lg:col-span-7 arch-card p-7 flex flex-col justify-between space-y-6 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 arch-grid">
            <div className="arch-card p-4">
              <div className="font-mono text-[9px] uppercase text-[#8A93A6]">Выбросы по сценарию</div>
              <div className="text-2xl font-light text-white mt-1">
                {calc.totalOptimized.toLocaleString()} <span className="text-xs text-[#8A93A6]">т CO₂</span>
              </div>
            </div>
            <div className="arch-card p-4">
              <div className="font-mono text-[9px] uppercase text-[#34D399]">Сокращение следа</div>
              <div className="text-2xl font-light text-[#34D399] mt-1">
                -{calc.savedTons.toLocaleString()} <span className="text-xs">т CO₂</span>
              </div>
            </div>
            <div className="arch-card p-4">
              <div className="font-mono text-[9px] uppercase text-[#FFAA00]">Финансовый баланс</div>
              <div className={`text-xl font-mono mt-1 ${calc.moneySavedRub >= 0 ? 'text-[#FFAA00]' : 'text-red-400'}`}>
                {calc.moneySavedRub >= 0 ? '+' : ''}
                {(calc.moneySavedRub / 1000000).toFixed(2)} млн ₽
              </div>
            </div>
          </div>

          {/* ИСПРАВЛЕННЫЕ ГРАФИКИ: фиксированный height={210} в изолированном контейнере */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
            <div className="p-4 border border-white/[0.05] bg-[#08090f] min-w-0 overflow-hidden">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#8A93A6] mb-3">
                Структура выбросов по источникам (т)
              </div>
              <div className="w-full h-[210px] min-w-0">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={calc.structureData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#8A93A6" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#8A93A6" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#050810', borderColor: 'rgba(255,170,0,0.3)', fontSize: '11px' }}
                    />
                    <Bar dataKey="базовый" fill="#4A5464" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="текущий" fill="#00C853" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 border border-white/[0.05] bg-[#08090f] min-w-0 overflow-hidden">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#8A93A6] mb-3">
                Траектория декарбонизации до 2030 г.
              </div>
              <div className="w-full h-[210px] min-w-0">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={calc.trajectoryData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="co2GradFixed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFAA00" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#FFAA00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" stroke="#8A93A6" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#8A93A6" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#050810', borderColor: 'rgba(255,170,0,0.3)', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="выбросы" stroke="#FFAA00" strokeWidth={2} fill="url(#co2GradFixed)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="p-4 border border-white/10 bg-[#08090f] space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]">
              Экологическое предписание системы:
            </div>
            {calc.recs.map((r, i) => (
              <div key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                <span className="text-[#00C853] font-mono">→</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Журнал расчётов из БД */}
      <div className="border border-white/[0.06] bg-[#050810] p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-4">
          Последние записи в таблице public.eco_co2_calculations ({history.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {history.slice(0, 3).map((item) => (
            <div key={item.id} className="p-4 border border-white/[0.06] bg-[#08090f] flex justify-between items-center">
              <div>
                <div className="font-mono text-[10px] text-[#FFAA00]">{item.username || '@pestrikov_kv'}</div>
                <div className="text-xs font-medium text-white mt-0.5">{item.field_name}</div>
                <div className="font-mono text-[10px] text-[#8A93A6] mt-0.5">
                  Добыча: {Number(item.oil_production_tons).toLocaleString()} т · ПНГ: {item.apg_utilization_rate}%
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-xs text-[#34D399]">-{item.saved_emissions_tons} т</div>
                <div className="text-[10px] text-[#8A93A6]">{item.calculated_emissions_tons} т CO₂</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}