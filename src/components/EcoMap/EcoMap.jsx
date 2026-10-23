import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LAYER_CONFIG, ECO_POINTS } from '../../data/mapLayers';

function MapFlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 8, { duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

const createCustomIcon = (color, isSelected) =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      width: ${isSelected ? '20px' : '14px'};
      height: ${isSelected ? '20px' : '14px'};
      background: ${color};
      border-radius: 50%;
      box-shadow: 0 0 ${isSelected ? '22px' : '12px'} ${color};
      border: 2px solid #050810;
      transition: all 0.3s ease;">
    </div>`,
    iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
    iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7]
  });

export default function EcoMap() {
  const [activeLayers, setActiveLayers] = useState(['apg', 'reclamation', 'renewables', 'reserves']);
  const [selectedPoint, setSelectedPoint] = useState(ECO_POINTS[0]);
  const [flyCoords, setFlyCoords] = useState(null);

  const toggleLayer = (type) => {
    setActiveLayers((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const filteredPoints = ECO_POINTS.filter((p) => activeLayers.includes(p.type));

  const handleSelectPoint = (pt) => {
    setSelectedPoint(pt);
    setFlyCoords([pt.lat, pt.lng]);
  };

  return (
    <div className="space-y-6">
      {/* Заголовок и переключатели слоёв */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="eyebrow mb-2">02 / Геоинформационная система ХМАО-Югры</div>
          <h2 className="text-3xl font-extralight text-white tracking-tight">
            Интерактивная карта <strong className="font-semibold text-[#00C853]">«Экологические инициативы Югры»</strong>
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(LAYER_CONFIG).map(([key, cfg]) => {
            const active = activeLayers.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={`px-3.5 py-2 border font-mono text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all ${
                  active
                    ? 'border-white/25 bg-[#080c17] text-white'
                    : 'border-white/5 bg-transparent text-zinc-600'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: cfg.color,
                    boxShadow: active ? `0 0 10px ${cfg.color}` : 'none'
                  }}
                />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Сетка: Карта + Боковой Эко-паспорт объекта */}
      <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
        {/* Карта Leaflet */}
        <div className="lg:col-span-8 arch-card h-[540px] relative">
          <MapContainer
            center={[61.23, 72.58]}
            zoom={6}
            className="w-full h-full z-0"
            attributionControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <MapFlyTo coords={flyCoords} />

            {filteredPoints.map((pt) => {
              const cfg = LAYER_CONFIG[pt.type];
              const isSelected = selectedPoint?.id === pt.id;
              return (
                <React.Fragment key={pt.id}>
                  {isSelected && (
                    <Circle
                      center={[pt.lat, pt.lng]}
                      radius={22000}
                      pathOptions={{ color: cfg.color, fillColor: cfg.color, fillOpacity: 0.12, weight: 1 }}
                    />
                  )}
                  <Marker
                    position={[pt.lat, pt.lng]}
                    icon={createCustomIcon(cfg.color, isSelected)}
                    eventHandlers={{
                      click: () => handleSelectPoint(pt)
                    }}
                  >
                    <Popup>
                      <div className="p-1 max-w-xs">
                        <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: cfg.color }}>
                          {cfg.code} · {pt.region}
                        </div>
                        <div className="text-sm font-semibold text-white mt-1">{pt.name}</div>
                        <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{pt.desc}</p>
                        <div className="mt-2 pt-2 border-t border-white/10 font-mono text-[10px] text-[#00C853]">
                          Целевой KPI: {pt.kpi}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>

          <div className="absolute bottom-4 left-4 z-[400] bg-[#050810]/90 backdrop-blur-md border border-white/10 px-3.5 py-2 font-mono text-[10px] text-zinc-400">
            КООРДИНАТЫ: {selectedPoint?.lat.toFixed(3)}° N, {selectedPoint?.lng.toFixed(3)}° E · ОБЪЕКТОВ АКТИВНО: {filteredPoints.length}
          </div>
        </div>

        {/* Эко-паспорт выбранного объекта и реестр */}
        <div className="lg:col-span-4 arch-card p-6 flex flex-col justify-between h-[540px] overflow-y-auto">
          {selectedPoint && (
            <div className="space-y-5">
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-widest mb-1"
                  style={{ color: LAYER_CONFIG[selectedPoint.type].color }}
                >
                  ЭКО-ПАСПОРТ ОБЪЕКТА · {LAYER_CONFIG[selectedPoint.type].code}
                </div>
                <h3 className="text-lg font-medium text-white leading-snug">{selectedPoint.name}</h3>
                <div className="font-mono text-[11px] text-zinc-500 mt-1">{selectedPoint.region}</div>
              </div>

              <p className="text-xs text-zinc-300 font-light leading-relaxed border-l-2 border-[#FFAA00] pl-3">
                {selectedPoint.desc}
              </p>

              <div className="grid grid-cols-2 arch-grid">
                <div className="arch-card p-3">
                  <div className="font-mono text-[9px] uppercase text-zinc-500">Ключевой KPI</div>
                  <div className="font-mono text-xs font-semibold text-[#00C853] mt-1">{selectedPoint.kpi}</div>
                </div>
                <div className="arch-card p-3">
                  <div className="font-mono text-[9px] uppercase text-zinc-500">Эффект CO₂</div>
                  <div className="font-mono text-xs font-semibold text-[#FFAA00] mt-1">{selectedPoint.co2Saved}</div>
                </div>
                <div className="arch-card p-3">
                  <div className="font-mono text-[9px] uppercase text-zinc-500">Контроль ПНГ</div>
                  <div className="font-mono text-xs text-white mt-1">{selectedPoint.apgRate}</div>
                </div>
                <div className="arch-card p-3">
                  <div className="font-mono text-[9px] uppercase text-zinc-500">Кислотность почвы</div>
                  <div className="font-mono text-xs text-white mt-1">pH {selectedPoint.soilPh}</div>
                </div>
              </div>
            </div>
          )}

          {/* Быстрый список объектов для перелёта по карте */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2.5">
              Быстрый переход по объектам ХМАО:
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {filteredPoints.map((pt) => {
                const active = selectedPoint?.id === pt.id;
                return (
                  <button
                    key={pt.id}
                    onClick={() => handleSelectPoint(pt)}
                    className={`w-full text-left px-3 py-2 border text-xs flex items-center justify-between transition-all ${
                      active
                        ? 'border-[#00C853] bg-[#00C853]/10 text-white'
                        : 'border-white/5 bg-white/[0.01] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <span className="truncate pr-2">{pt.name}</span>
                    <span className="font-mono text-[10px] text-[#FFAA00] shrink-0">→</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}