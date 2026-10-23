import React, { useState, useEffect } from 'react';
import Header from './components/Layout/Header';
import KpiCards from './components/Dashboard/KpiCards';
import AchievementTree from './components/Dashboard/AchievementTree';
import EcoMap from './components/EcoMap/EcoMap';
import Co2Calculator from './components/Calculator/Co2Calculator';
import ReclamationSim from './components/Simulator/ReclamationSim';
import EcoQuests from './components/Simulator/EcoQuests';
import HelmetTelemetry from './components/Monitoring/HelmetTelemetry';
import GreenFootprint from './components/Workshop/GreenFootprint';
import ExtendedModules from './components/Extended/ExtendedModules';
import { api, AVATAR_PRESETS } from './lib/supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [simSubTab, setSimSubTab] = useState('sim');
  const [showCertModal, setShowCertModal] = useState(false);

  useEffect(() => {
    refreshUser();
  }, []);

  const refreshUser = async () => {
    const res = await api.auth.getUser();
    if (res?.user) setUser(res.user);
  };

  const preset = AVATAR_PRESETS.find((a) => a.id === user?.avatar_preset) || AVATAR_PRESETS[0];
  const votesLeft = Math.max(0, (user?.votes_quota || 3) - (user?.votes_used || 0));

  return (
    <div className="min-h-screen bg-[#050810] text-[#F2F4F8] flex flex-col relative">
      <div className="grain-overlay" />

      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(0, 200, 83, 0.06) 0%, rgba(255, 170, 0, 0.03) 45%, transparent 100%)'
        }}
      />

      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAuthSuccess={(u) => setUser(u)}
        onSignOut={() => setUser(null)}
        onOpenCert={() => setShowCertModal(true)}
      />

      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
        {activeTab === 'dashboard' && (
          <div className="space-y-12">
            {/* HERO-СЕКЦИЯ + КАРТОЧКА ПРОФИЛЯ С АВАТАРКОЙ И КВОТОЙ ГОЛОСОВ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 arch-grid">
              <div className="lg:col-span-8 arch-card p-8 sm:p-11 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="eyebrow eyebrow-emerald">Автономная платформа экологического контроля ХМАО</div>
                  <h1 className="text-4xl sm:text-5xl font-extralight tracking-[-1.5px] text-white leading-[1.08]">
                    Экологический модуль
                    <strong className="block font-semibold text-[#34D399] mt-1">«Зелёная Югра»</strong>
                  </h1>
                  <p className="text-sm font-light text-[#8A93A6] max-w-2xl leading-relaxed">
                    Собственная база данных исследователей ХМАО-Югры: ГИС-карта рекультивации и ПНГ, инженерный аудит CO₂, квотируемое голосование за проекты (3 голоса на аккаунт), чат по <code className="text-[#FFAA00]">@username</code> и зал защиты проектов.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-8">
                  <button
                    onClick={() => setActiveTab('workshop')}
                    className="px-5 py-3 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-xs font-semibold uppercase tracking-[0.2em]"
                  >
                    Голосовать за проекты ({votesLeft}/3) →
                  </button>
                  <button
                    onClick={() => setActiveTab('extended')}
                    className="px-5 py-3 border border-[#FFAA00]/60 text-[#FFAA00] hover:bg-[#FFAA00]/10 font-mono text-xs uppercase tracking-[0.2em]"
                  >
                    Платформа защиты & Чат @username
                  </button>
                </div>
              </div>

              {/* КАРТОЧКА ПРОФИЛЯ ИССЛЕДОВАТЕЛЯ С АВАТАРКОЙ */}
              <div className="lg:col-span-4 arch-card p-7 flex flex-col justify-between bg-[#08090f]">
                {user ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-[#8A93A6] mb-4">
                        <span>КАРТОЧКА ИССЛЕДОВАТЕЛЯ ЭКО-БД</span>
                        <span className="text-[#34D399]">● ONLINE</span>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className="w-16 h-16 rounded-full object-cover border-2 border-[#00C853]"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2 shrink-0"
                            style={{ backgroundColor: preset.bg, borderColor: preset.color }}
                          >
                            {preset.icon}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold text-[#FFAA00] truncate">{user.username}</div>
                          <div className="text-base font-medium text-white truncate">{user.full_name}</div>
                          <div className="text-[11px] text-[#8A93A6] truncate">{user.role}</div>
                        </div>
                      </div>

                      <p className="text-xs font-light text-zinc-400 leading-relaxed border-l-2 border-[#00C853] pl-3 mb-4">
                        {user.bio}
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                      <div className="grid grid-cols-3 gap-2 font-mono text-center">
                        <div className="p-2 bg-[#050810] border border-white/5">
                          <div className="text-[9px] text-[#8A93A6]">ОПЫТ</div>
                          <div className="text-xs text-[#34D399] font-bold">{user.green_points} XP</div>
                        </div>
                        <div className="p-2 bg-[#050810] border border-white/5">
                          <div className="text-[9px] text-[#8A93A6]">ГОЛОСОВ</div>
                          <div className="text-xs text-[#FFAA00] font-bold">{votesLeft} / {user.votes_quota || 3}</div>
                        </div>
                        <div className="p-2 bg-[#050810] border border-white/5">
                          <div className="text-[9px] text-[#8A93A6]">РАНГ</div>
                          <div className="text-xs text-white font-bold">LVL 0{user.tree_level}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="my-auto text-center font-mono text-xs text-[#8A93A6]">
                    Войдите в аккаунт «Зелёная Югра» в верхнем меню
                  </div>
                )}
              </div>
            </div>

            <KpiCards onNavigate={(tab) => setActiveTab(tab)} />

            <AchievementTree
              user={user}
              onActionClick={(tab) => setActiveTab(tab)}
              showCertModal={showCertModal}
              setShowCertModal={setShowCertModal}
            />
          </div>
        )}

        {activeTab === 'map' && <EcoMap />}

        {activeTab === 'calculator' && (
          <Co2Calculator user={user} onSaved={refreshUser} />
        )}

        {activeTab === 'simulator' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
              <div>
                <div className="eyebrow mb-2">04 / Интерактивные тренажёры и проверка знаний</div>
                <h2 className="text-3xl font-extralight text-white tracking-tight">
                  Симуляторы процессов и <strong className="font-semibold text-[#34D399]">Эко-квесты Югры</strong>
                </h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSimSubTab('sim')}
                  className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest border ${
                    simSubTab === 'sim'
                      ? 'border-[#00C853] bg-[#00C853] text-[#050810] font-semibold'
                      : 'border-white/15 text-zinc-300'
                  }`}
                >
                  Тренажёры рекультивации и ESG
                </button>
                <button
                  onClick={() => setSimSubTab('quests')}
                  className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest border ${
                    simSubTab === 'quests'
                      ? 'border-[#FFAA00] bg-[#FFAA00] text-[#050810] font-semibold'
                      : 'border-white/15 text-zinc-300'
                  }`}
                >
                  Эко-квесты и Дебат-клуб
                </button>
              </div>
            </div>

            {simSubTab === 'sim' ? (
              <ReclamationSim user={user} onComplete={refreshUser} />
            ) : (
              <EcoQuests user={user} onComplete={refreshUser} />
            )}
          </div>
        )}

        {activeTab === 'monitoring' && <HelmetTelemetry />}

        {activeTab === 'workshop' && (
          <GreenFootprint
            user={user}
            onProjectSubmitted={refreshUser}
            onNavigateDefense={() => setActiveTab('extended')}
          />
        )}

        {activeTab === 'extended' && (
          <ExtendedModules user={user} onActionComplete={refreshUser} />
        )}
      </main>

      <footer className="relative z-10 border-t border-white/[0.05] bg-[#050810] py-8 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-widest text-[#4A5464]">
          <div>ЗЕЛЁНАЯ ЮГРА · АВТОНОМНАЯ ЭКО-ПЛАТФОРМА «ЮГРА.НЕФТЬ» (2026)</div>
          <div>МБОУ «СОШ № 1» пгт. Пойковский · Авторы: @pestrikov_kv, @morozov_ap · Рук.: @rahmanov_av</div>
        </div>
      </footer>
    </div>
  );
}