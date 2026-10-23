import React, { useState } from 'react';

const FIELDS_DATA = [
  {
    id: 'all',
    name: 'ХМАО-Югра (Сводка)',
    hectares: '1 420',
    co2Reduced: '718.5',
    apgLevel: '97.6%',
    waterClosed: '99.2%',
    sensorsActive: '248 касок',
    status: 'Целевой норматив выполнен'
  },
  {
    id: 'mamontovskoe',
    name: 'Мамонтовское (пгт. Пойковский)',
    hectares: '310',
    co2Reduced: '142.0',
    apgLevel: '97.8%',
    waterClosed: '99.5%',
    sensorsActive: '64 каски',
    status: 'Базовый полигон СОШ №1'
  },
  {
    id: 'priobskoe',
    name: 'Приобское месторождение',
    hectares: '485',
    co2Reduced: '285.0',
    apgLevel: '98.1%',
    waterClosed: '99.4%',
    sensorsActive: '82 каски',
    status: 'Когенерация ГТЭС 315 МВт'
  },
  {
    id: 'samotlor',
    name: 'Самотлорское месторождение',
    hectares: '390',
    co2Reduced: '176.5',
    apgLevel: '96.7%',
    waterClosed: '98.9%',
    sensorsActive: '58 касок',
    status: 'Биоремедиация почв'
  },
  {
    id: 'fedorovskoe',
    name: 'Фёдоровское месторождение',
    hectares: '235',
    co2Reduced: '115.0',
    apgLevel: '98.2%',
    waterClosed: '99.1%',
    sensorsActive: '44 каски',
    status: 'Солнечная телеметрия ВИЭ'
  }
];

export default function KpiCards({ onNavigate }) {
  const [selectedField, setSelectedField] = useState(FIELDS_DATA[0]);

  const metrics = [
    {
      num: '01 / РЕКУЛЬТИВАЦИЯ',
      value: selectedField.hectares,
      unit: 'га тайги',
      label: 'Восстановлено земель',
      sub: 'Лесотехнический этап и высадка сеянцев сибирского кедра',
      color: 'text-[#34D399]',
      targetTab: 'simulator'
    },
    {
      num: '02 / ДЕКАРБОНИЗАЦИЯ',
      value: selectedField.co2Reduced,
      unit: 'тыс. т CO₂',
      label: 'Снижение выбросов',
      sub: `Полезное использование ПНГ: ${selectedField.apgLevel} (норматив ≥ 95%)`,
      color: 'text-[#FFAA00]',
      targetTab: 'calculator'
    },
    {
      num: '03 / ПРОМБЕЗОПАСНОСТЬ',
      value: selectedField.waterClosed,
      unit: 'индекс ПДК',
      label: 'Чистота рабочей зоны',
      sub: `Сеть BLE Mesh + LoRa (MQ-4 / MQ-7): ${selectedField.sensorsActive}`,
      color: 'text-[#22D3EE]',
      targetTab: 'monitoring'
    },
    {
      num: '04 / ПЕД. ЭКСПЕРИМЕНТ',
      value: '+22',
      unit: '% знаний',
      label: 'Рост эффективности ЦОС',
      sub: 'Увеличение мотивации школьников в 2.5 раза (60 учеников)',
      color: 'text-[#FFAA00]',
      targetTab: 'extended'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#4A5464] mr-2">
            Промысловый сектор:
          </span>
          {FIELDS_DATA.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedField(f)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-all ${
                selectedField.id === f.id
                  ? 'border-[#FFAA00] bg-[#FFAA00]/10 text-[#FFAA00]'
                  : 'border-white/[0.05] bg-[#050810] text-[#8A93A6] hover:border-white/20 hover:text-white'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="font-mono text-[10px] uppercase tracking-widest text-[#34D399] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] shadow-[0_0_8px_#00C853]" />
          <span>{selectedField.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 arch-grid">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            onClick={() => onNavigate && onNavigate(m.targetTab)}
            className={`arch-card arch-card-top-line p-7 flex flex-col justify-between cursor-pointer group ${m.color}`}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#4A5464] group-hover:text-current transition-colors">
                {m.num}
              </span>
              <span className="font-mono text-xs text-[#4A5464] group-hover:text-current group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                ↗
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[40px] font-extralight tracking-[-1.5px] leading-none text-[#F2F4F8] group-hover:text-current transition-colors">
                  {m.value}
                </span>
                <span className="font-mono text-xs text-[#8A93A6]">{m.unit}</span>
              </div>
              <div className="text-sm font-medium text-[#F2F4F8] mb-1.5">{m.label}</div>
              <p className="text-xs font-light text-[#8A93A6] leading-relaxed">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}