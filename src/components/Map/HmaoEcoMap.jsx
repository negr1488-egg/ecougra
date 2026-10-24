import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '../ui/DesignSystem';
import { MapPin, Search, Layers, ExternalLink, Navigation } from 'lucide-react';

const MAP_POINTS = [
  {
    id: 'p1',
    title: 'МБОУ «СОШ № 1» (пгт. Пойковский)',
    layer: 'schools',
    layerLabel: 'Школа-участник',
    coords: [61.2333, 71.9333],
    address: 'ХМАО, Нефтеюганский р-н, пгт. Пойковский',
    kpi: 'Лидер эко-рейтинга · 12 проектов',
    desc: 'Флагманская площадка проекта «Зелёная Югра» и Роснефть-классов.',
    link: '/gamification'
  },
  {
    id: 'p2',
    title: 'Приобский энергокомплекс (ГТЭС)',
    layer: 'apg',
    layerLabel: 'Утилизация ПНГ',
    coords: [61.0841, 69.5214],
    address: 'ХМАО, Ханты-Мансийский р-н, Приобское м/р',
    kpi: 'Утилизация ПНГ: 98.4%',
    desc: 'Переработка попутного нефтяного газа в электроэнергию с минимальным углеродным следом.',
    link: '/learn'
  },
  {
    id: 'p3',
    title: 'Мамонтовский полигон биорекультивации',
    layer: 'reclamation',
    layerLabel: 'Рекультивация',
    coords: [60.8622, 72.4511],
    address: 'ХМАО, Нефтеюганский р-н, Мамонтовское м/р',
    kpi: 'Восстановлено 48 га тайги',
    desc: 'Внесение аборигенных штаммов бактерий-деструкторов и высадка сеянцев сибирского кедра.',
    link: '/learn'
  },
  {
    id: 'p4',
    title: 'Солнечный энергомодуль телеметрии куста № 14',
    layer: 'res',
    layerLabel: 'ВИЭ (Солнечная энергия)',
    coords: [61.2512, 73.3941],
    address: 'ХМАО, Сургутский р-н',
    kpi: '-35% выбросов Scope 2',
    desc: 'Автономное питание датчиков загазованности и связи от фотоэлектрических панелей.',
    link: '/learn'
  },
  {
    id: 'p5',
    title: 'Природный парк «Кондинские озёра»',
    layer: 'oopt',
    layerLabel: 'ООПТ (Заповедник)',
    coords: [60.8333, 63.7667],
    address: 'ХМАО, Советский р-н',
    kpi: 'Особо охраняемая территория',
    desc: 'Эталонный участок биоразнообразия с цифровым контролем чистоты водоёмов.',
    link: '/activities'
  },
  {
    id: 'p6',
    title: 'Югорский государственный университет (ЮГУ)',
    layer: 'schools',
    layerLabel: 'ВУЗ-партнёр',
    coords: [61.0042, 69.0019],
    address: 'г. Ханты-Мансийск, ул. Чехова, 16',
    kpi: 'Карбоновый полигон «Мухрино»',
    desc: 'Научное сопровождение школьных и студенческих проектов по климату и экологии.',
    link: '/gamification'
  }
];

const LAYERS = [
  { id: 'all', label: 'Все слои (6)', color: 'gold' },
  { id: 'apg', label: '🔥 ПНГ', color: 'gold' },
  { id: 'reclamation', label: '🌲 Рекультивация', color: 'emerald' },
  { id: 'res', label: '☀️ ВИЭ', color: 'cyan' },
  { id: 'oopt', label: '🦌 ООПТ', color: 'purple' },
  { id: 'schools', label: '🏫 Школы и ВУЗы', color: 'emerald' }
];

export default function HmaoEcoMap() {
  const [activeLayer, setActiveLayer] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState(MAP_POINTS[0]);
  const navigate = useNavigate();

  const yandexApiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '';

  const filteredPoints = useMemo(() => {
    return MAP_POINTS.filter((pt) => {
      const matchLayer = activeLayer === 'all' || pt.layer === activeLayer;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        pt.title.toLowerCase().includes(q) ||
        pt.address.toLowerCase().includes(q) ||
        pt.coords.join(', ').includes(q);
      return matchLayer && matchSearch;
    });
  }, [activeLayer, searchQuery]);

  // Формируем URL интерактивного виджета Яндекс.Карт с метками (работает всегда, даже если API-ключ v3 ещё модерируется)
  const yandexWidgetUrl = useMemo(() => {
    const center = selectedPoint ? `${selectedPoint.coords[1]},${selectedPoint.coords[0]}` : '71.9333,61.2333';
    const pts = filteredPoints
      .map((p, idx) => `${p.coords[1]},${p.coords[0]},pm2gnm${idx + 1}`)
      .join('~');
    return `https://yandex.ru/map-widget/v1/?ll=${center}&z=7&l=map&pt=${pts}`;
  }, [filteredPoints, selectedPoint]);

  return (
    <div className="space-y-6">
      {/* Панель слоёв и поиска по адресу / координатам */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveLayer(l.id)}
                className={`px-3.5 py-2 font-mono text-xs uppercase border transition-all ${
                  activeLayer === l.id
                    ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold'
                    : 'border-white/10 bg-[#050810] text-[#8A93A6] hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search size={14} className="absolute left-3 top-3 text-[#8A93A6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по адресу или координатам..."
              className="w-full bg-[#050810] border border-white/15 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFAA00]"
            />
          </div>
        </div>
      </Card>

      {/* Карта Яндекс + Интерактивный список кластеров и попап */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-0 overflow-hidden border-white/15 relative min-h-[480px]">
          <div className="bg-[#050810] px-4 py-2.5 border-b border-white/10 flex items-center justify-between font-mono text-[10px] text-[#8A93A6]">
            <span className="flex items-center gap-1.5 text-[#34D399]">
              <Layers size={13} /> ГИС «Зелёная Югра» · Yandex Maps Engine {yandexApiKey ? '(API 3.0 Key Active)' : '(Interactive Mode)'}
            </span>
            <span>Координаты центра: {selectedPoint?.coords.join(', ')}</span>
          </div>

          <iframe
            title="Yandex Eco Map HMAO"
            src={yandexWidgetUrl}
            className="w-full h-[460px] border-0"
            allowFullScreen
          />
        </Card>

        {/* Правая колонка: Выбранный объект (Попап-карточка) + Список маркеров */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          {selectedPoint && (
            <Card className="p-5 border-[#00C853]/40 space-y-3">
              <div className="flex items-center justify-between">
                <Badge color="emerald">{selectedPoint.layerLabel}</Badge>
                <span className="font-mono text-[10px] text-[#FFAA00]">
                  {selectedPoint.coords[0]}° N, {selectedPoint.coords[1]}° E
                </span>
              </div>
              <h3 className="text-base font-medium text-white">{selectedPoint.title}</h3>
              <p className="text-xs text-[#8A93A6] flex items-center gap-1">
                <MapPin size={12} className="text-[#FFAA00] shrink-0" /> {selectedPoint.address}
              </p>
              <div className="p-2.5 bg-[#050810] border border-white/10 font-mono text-xs text-[#34D399]">
                KPI: {selectedPoint.kpi}
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{selectedPoint.desc}</p>
              <Button size="sm" onClick={() => navigate(selectedPoint.link)} className="w-full">
                Перейти к объекту / проекту <ExternalLink size={13} />
              </Button>
            </Card>
          )}

          <Card className="p-4 space-y-2 max-h-[250px] overflow-y-auto">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-2">
              Объекты на карте ({filteredPoints.length})
            </div>
            {filteredPoints.map((pt, i) => (
              <button
                key={pt.id}
                onClick={() => setSelectedPoint(pt)}
                className={`w-full text-left p-2.5 border transition-all flex items-center justify-between text-xs ${
                  selectedPoint?.id === pt.id
                    ? 'border-[#FFAA00] bg-[#FFAA00]/10 text-white'
                    : 'border-white/5 bg-[#050810] text-zinc-300 hover:text-white'
                }`}
              >
                <span className="truncate">
                  <strong className="font-mono text-[#FFAA00] mr-1.5">#{i + 1}</strong>
                  {pt.title}
                </span>
                <Navigation size={12} className="text-[#34D399] shrink-0" />
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}