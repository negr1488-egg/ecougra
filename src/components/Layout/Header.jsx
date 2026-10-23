import React, { useState } from 'react';
import AuthModal from './AuthModal';
import { AVATAR_PRESETS } from '../../lib/supabaseClient';

export default function Header({ user, onAuthSuccess, onSignOut, activeTab, setActiveTab, onOpenCert }) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const navLinks = [
    { id: 'dashboard', num: '01', label: 'Дашборд' },
    { id: 'map', num: '02', label: 'ГИС Карта' },
    { id: 'calculator', num: '03', label: 'CO₂ Аудит' },
    { id: 'simulator', num: '04', label: 'Симуляторы' },
    { id: 'monitoring', num: '05', label: 'Датчики среды' },
    { id: 'workshop', num: '06', label: 'Проекты & Голоса' },
    { id: 'extended', num: '07', label: 'Защита & Чат' }
  ];

  const preset = AVATAR_PRESETS.find((a) => a.id === user?.avatar_preset) || AVATAR_PRESETS[0];
  const votesLeft = Math.max(0, (user?.votes_quota || 3) - (user?.votes_used || 0));

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#050810]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* БРЕНД И ЛОГОТИП { 💧🌿 } */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3.5 cursor-pointer group shrink-0"
          >
            <svg className="w-11 h-11 group-hover:scale-105 transition-transform duration-500" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="20" fill="url(#lgGlow)" opacity="0.18" />
              <path d="M12 12C8 12 8 16.5 8 22C8 27.5 8 32 12 32" stroke="#FFAA00" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M32 12C36 12 36 16.5 36 22C36 27.5 36 32 32 32" stroke="#FFAA00" strokeWidth="1.6" strokeLinecap="round" />
              <path
                d="M22 7.5C22 7.5 13.5 16.5 13.5 24.5C13.5 29.5 17.3 33 22 33C26.7 33 30.5 29.5 30.5 24.5C30.5 16.5 22 7.5 22 7.5Z"
                stroke="url(#lgGrad)"
                strokeWidth="1.8"
                fill="rgba(0, 200, 83, 0.08)"
              />
              <path d="M22 30V17M22 25L26.5 21M22 22L17.5 18.5" stroke="url(#lgGrad)" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="22" cy="16.5" r="1.6" fill="#FFAA00" />
              <circle cx="26.5" cy="21" r="1.5" fill="#00C853" />
              <circle cx="17.5" cy="18.5" r="1.5" fill="#22D3EE" />
              <defs>
                <radialGradient id="lgGlow" cx="0.5" cy="0.5" r="0.5">
                  <stop stopColor="#00C853" />
                  <stop offset="1" stopColor="#050810" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="lgGrad" x1="13.5" y1="7.5" x2="30.5" y2="33" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFAA00" />
                  <stop offset="0.5" stopColor="#00C853" />
                  <stop offset="1" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
            </svg>

            <div>
              <div className="text-[13px] font-light tracking-[0.4em] text-[#F2F4F8] uppercase">
                ЗЕЛЁНАЯ <strong className="font-semibold text-[#00C853]">ЮГРА</strong>
              </div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#FFAA00] mt-0.5">
                ЭКО-ПЛАТФОРМА «ЮГРА.НЕФТЬ»
              </div>
            </div>
          </div>

          {/* НАВИГАЦИЯ */}
          <nav className="hidden xl:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`group relative px-3 py-2 flex items-center gap-1.5 transition-all ${
                    isActive ? 'text-[#FFAA00]' : 'text-[#8A93A6] hover:text-[#F2F4F8]'
                  }`}
                >
                  <span className={`font-mono text-[9px] ${isActive ? 'text-[#FFAA00]' : 'text-[#4A5464]'}`}>
                    {link.num}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.15em]">{link.label}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      isActive ? 'bg-[#00C853] shadow-[0_0_10px_#00C853]' : 'bg-transparent'
                    }`}
                  />
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-[#FFAA00] to-transparent" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* ПРОФИЛЬ С АВАТАРКОЙ, @USERNAME И КВОТОЙ ГОЛОСОВ */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="flex items-center gap-3 px-3 py-1.5 bg-[#08090f] border border-white/[0.08] hover:border-[#FFAA00]/60 transition-all group"
                >
                  {/* Аватарка */}
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-8 h-8 rounded-full object-cover border border-[#00C853]"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm border"
                      style={{ backgroundColor: preset.bg, borderColor: preset.color }}
                    >
                      {preset.icon}
                    </div>
                  )}

                  <div className="text-left hidden sm:block">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#FFAA00]">
                        {user.username}
                      </span>
                      <span className="px-1.5 py-0.2 bg-[#00C853]/15 border border-[#00C853]/40 font-mono text-[9px] text-[#34D399]">
                        L{user.tree_level || 1}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-[#8A93A6] mt-0.5">
                      {user.green_points || 0} XP · Голосов: <strong className="text-white">{votesLeft}/{user.votes_quota || 3}</strong>
                    </div>
                  </div>
                </button>

                <button
                  onClick={onOpenCert}
                  title="Именной сертификат"
                  className="px-2.5 py-2 border border-[#FFAA00]/40 bg-[#FFAA00]/10 hover:bg-[#FFAA00] text-[#FFAA00] hover:text-[#050810] font-mono text-[10px] font-bold transition-all"
                >
                  ★
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-4 py-2.5 bg-[#00C853] hover:bg-[#34D399] text-[#050810] font-mono text-[10px] font-semibold uppercase tracking-[0.22em]"
              >
                Вход в Эко-БД
              </button>
            )}
          </div>
        </div>

        {/* Мобильное меню */}
        <div className="xl:hidden flex items-center overflow-x-auto border-t border-white/[0.05] bg-[#050810] px-3 py-2 gap-1.5">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'border-[#FFAA00]/60 text-[#FFAA00] bg-[#FFAA00]/10'
                    : 'border-white/[0.04] text-[#8A93A6]'
                }`}
              >
                <span className="text-[#4A5464] mr-1">{link.num}</span>
                {link.label}
              </button>
            );
          })}
        </div>
      </header>

      {isAuthOpen && (
        <AuthModal
          user={user}
          onClose={() => setIsAuthOpen(false)}
          onSignOut={() => {
            onSignOut();
            setIsAuthOpen(false);
          }}
          onSuccess={(u) => {
            onAuthSuccess(u);
            setIsAuthOpen(false);
          }}
        />
      )}
    </>
  );
}