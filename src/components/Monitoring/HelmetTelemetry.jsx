import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

const WORKERS = [
  { id: 'ESP32-NODE-01', name: 'Пост №1 · Куст №14 (Мамонтово)', battery: 94, rssi: '-62 dBm (LoRa Mesh)' },
  { id: 'ESP32-NODE-02', name: 'Пост №2 · Факельный сектор Б', battery: 88, rssi: '-68 dBm (BLE Mesh)' },
  { id: 'ESP32-NODE-03', name: 'Пост №3 · Полигон рекультивации', battery: 99, rssi: '-55 dBm (LoRa Gateway)' }
];

export default function HelmetTelemetry() {
  const [selectedWorker, setSelectedWorker] = useState(WORKERS[0]);
  const [leakSimulated, setLeakSimulated] = useState(false);
  const [history, setHistory] = useState([
    { time: '12:00:00', ch4: 11, co: 3, pulse: 74 },
    { time: '12:00:03', ch4: 13, co: 4, pulse: 75 },
    { time: '12:00:06', ch4: 12, co: 4, pulse: 74 },
    { time: '12:00:09', ch4: 14, co: 5, pulse: 76 }
  ]);
  const [alerts, setAlerts] = useState([
    { id: 1, time: '11:42:10', msg: 'ESP32-NODE-01: Калибровка сенсоров MQ-4 (CH₄) и MQ-7 (CO) завершена', level: 'normal' }
  ]);

  const PDK = { CH4: 50, CO: 20 };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      const ch4 = leakSimulated ? Math.floor(62 + Math.random() * 22) : Math.floor(11 + Math.random() * 12);
      const co = leakSimulated ? Math.floor(24 + Math.random() * 9) : Math.floor(3 + Math.random() * 5);
      const pulse = leakSimulated ? Math.floor(105 + Math.random() * 12) : Math.floor(72 + Math.random() * 8);

      setHistory((prev) => [...prev.slice(-14), { time: now, ch4, co, pulse }]);

      if (ch4 > PDK.CH4 || co > PDK.CO) {
        setAlerts((prev) => [
          {
            id: Date.now(),
            time: now,
            msg: `ТРЕВОГА ПДК [${selectedWorker.id}]: CH₄=${ch4} ppm, CO=${co} ppm! Зафиксирован выброс в таблицу eco_gas_telemetry`,
            level: 'danger'
          },
          ...prev.slice(0, 5)
        ]);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [leakSimulated, selectedWorker]);

  const latest = history[history.length - 1] || { ch4: 12, co: 4, pulse: 75 };
  const isDanger = latest.ch4 > PDK.CH4 || latest.co > PDK.CO;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="eyebrow mb-2">05 / Экологический IoT-мониторинг атмосферного воздуха</div>
          <h2 className="text-3xl font-extralight text-white tracking-tight">
            Телеметрия датчиков газа <strong className="font-semibold text-[#22D3EE]">MQ-4 (CH₄) и MQ-7 (CO)</strong>
          </h2>
        </div>

        <button
          onClick={() => setLeakSimulated(!leakSimulated)}
          className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest border transition-all ${
            leakSimulated
              ? 'border-red-500 bg-red-500 text-white animate-pulse'
              : 'border-red-500/50 text-red-400 hover:bg-red-500/10'
          }`}
        >
          {leakSimulated ? '⚠ ОТКЛЮЧИТЬ ТЕСТ ВЫБРОСА ГАЗА' : '⚡ СИМУЛИРОВАТЬ ПРЕВЫШЕНИЕ ПДК'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 arch-grid">
        {WORKERS.map((w) => {
          const active = selectedWorker.id === w.id;
          return (
            <button
              key={w.id}
              onClick={() => setSelectedWorker(w)}
              className={`arch-card p-5 text-left transition-all border-l-2 ${
                active ? 'border-l-[#22D3EE] bg-[#080d1a]' : 'border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] text-[#8A93A6] mb-1">
                <span className="text-[#22D3EE]">{w.id}</span>
                <span>🔋 {w.battery}% · {w.rssi}</span>
              </div>
              <div className="text-sm font-medium text-white">{w.name}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 arch-grid">
        <div className="arch-card p-6">
          <div className="flex justify-between font-mono text-[10px] text-[#8A93A6] mb-2">
            <span>СЕНСОР MQ-4 (МЕТАН CH₄)</span>
            <span>ПДК: {PDK.CH4} ppm</span>
          </div>
          <div className={`text-3xl font-light ${latest.ch4 > PDK.CH4 ? 'text-red-400' : 'text-[#34D399]'}`}>
            {latest.ch4} <span className="text-xs font-mono text-[#8A93A6]">ppm</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 mt-3">
            <div
              className={`h-full transition-all ${latest.ch4 > PDK.CH4 ? 'bg-red-500' : 'bg-[#00C853]'}`}
              style={{ width: `${Math.min(100, (latest.ch4 / 80) * 100)}%` }}
            />
          </div>
        </div>

        <div className="arch-card p-6">
          <div className="flex justify-between font-mono text-[10px] text-[#8A93A6] mb-2">
            <span>СЕНСОР MQ-7 (УГАРНЫЙ ГАЗ CO)</span>
            <span>ПДК: {PDK.CO} ppm</span>
          </div>
          <div className={`text-3xl font-light ${latest.co > PDK.CO ? 'text-red-400' : 'text-[#FFAA00]'}`}>
            {latest.co} <span className="text-xs font-mono text-[#8A93A6]">ppm</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 mt-3">
            <div
              className={`h-full transition-all ${latest.co > PDK.CO ? 'bg-red-500' : 'bg-[#FFAA00]'}`}
              style={{ width: `${Math.min(100, (latest.co / 40) * 100)}%` }}
            />
          </div>
        </div>

        <div className="arch-card p-6">
          <div className="flex justify-between font-mono text-[10px] text-[#8A93A6] mb-2">
            <span>MAX30102 (ПУЛЬС / SpO₂)</span>
            <span>НОРМА: 60–95</span>
          </div>
          <div className="text-3xl font-light text-white">
            {latest.pulse} <span className="text-xs font-mono text-[#8A93A6]">bpm · 98%</span>
          </div>
          <div className="font-mono text-[10px] text-[#34D399] mt-3">● Телеметрия оператора</div>
        </div>

        <div className="arch-card p-6">
          <div className="flex justify-between font-mono text-[10px] text-[#8A93A6] mb-2">
            <span>СТАТУС ПДК АТМОСФЕРЫ</span>
            <span>ESP32-S3</span>
          </div>
          <div className={`text-base font-mono font-semibold mt-1 ${isDanger ? 'text-red-400 animate-pulse' : 'text-[#34D399]'}`}>
            {isDanger ? '⚠ ТРЕВОГА: ПРЕВЫШЕНИЕ ПДК' : '✓ ВОЗДУХ В ПРЕДЕЛАХ НОРМЫ'}
          </div>
          <div className="font-mono text-[10px] text-[#8A93A6] mt-3">Запись в БД: public.eco_gas_telemetry</div>
        </div>
      </div>

      {/* ИСПРАВЛЕННЫЙ ГРАФИК: фиксированный height={240} */}
      <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
        <div className="lg:col-span-8 arch-card p-6 min-w-0 overflow-hidden">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-4">
            Потоковая концентрация метана (MQ-4) и угарного газа (MQ-7)
          </div>
          <div className="w-full h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#8A93A6" tick={{ fontSize: 10 }} />
                <YAxis stroke="#8A93A6" tick={{ fontSize: 10 }} domain={[0, 90]} />
                <Tooltip contentStyle={{ backgroundColor: '#050810', borderColor: 'rgba(255,255,255,0.1)', fontSize: '11px' }} />
                <ReferenceLine y={PDK.CH4} stroke="#EF4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="ch4" name="Метан CH₄ (ppm)" stroke="#00C853" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="co" name="Угарный газ CO (ppm)" stroke="#FFAA00" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 arch-card p-6 flex flex-col justify-between min-w-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00] mb-3">
              Бортовой журнал событий ПДК
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[210px] pr-1">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 border font-mono text-[11px] leading-snug ${
                    a.level === 'danger'
                      ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : 'border-white/5 bg-[#08090f] text-zinc-300'
                  }`}
                >
                  <span className="text-[#8A93A6] block text-[9px] mb-0.5">{a.time}</span>
                  {a.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}