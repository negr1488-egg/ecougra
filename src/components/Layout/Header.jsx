import React, { useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  BookOpen,
  Compass,
  MessageSquare,
  Trophy,
  User,
  Shield,
  Bell,
  MoreHorizontal,
  Flame,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Badge } from '../ui/DesignSystem';

export default function Header({ children }) {
  const { profile, hasRole, notifications, unreadChatCount, markNotificationsRead, signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminOrDev = hasRole(['admin', 'dev']);
  const unreadNotifsCount = notifications.filter((n) => !n.read_at).length;

  const mainTabs = [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/learn', label: 'Обучение', icon: BookOpen },
    { to: '/activities', label: 'Активности', icon: Compass },
    { to: '/chat', label: 'Чат', icon: MessageSquare, badge: unreadChatCount },
    { to: '/gamification', label: 'Геймификация', icon: Trophy },
    { to: '/profile', label: 'Профиль', icon: User }
  ];

  if (isAdminOrDev) {
    mainTabs.push({ to: '/admin', label: 'Админ', icon: Shield });
  }

  // Мобильный bottom-nav: строго 5 ключевых иконок
  const mobileBottomTabs = [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/learn', label: 'Обучение', icon: BookOpen },
    { to: '/activities', label: 'Активности', icon: Compass },
    { to: '/chat', label: 'Чат', icon: MessageSquare, badge: unreadChatCount },
    { to: '/profile', label: 'Профиль', icon: User }
  ];

  // Свайпы между вкладками на мобильных устройствах
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 95) {
      const paths = mobileBottomTabs.map((t) => t.to);
      const currIdx = paths.indexOf(location.pathname);
      if (currIdx !== -1) {
        if (deltaX < 0 && currIdx < paths.length - 1) navigate(paths[currIdx + 1]);
        if (deltaX > 0 && currIdx > 0) navigate(paths[currIdx - 1]);
      }
    }
    touchStartX.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen flex flex-col bg-[#050810] text-[#F2F4F8] pb-16 lg:pb-0"
    >
      <header className="sticky top-0 z-50 w-full bg-[#050810]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* ЛОГОТИП */}
          <div onClick={() => navigate('/')} className="flex items-center gap-3 cursor-pointer group shrink-0">
            <svg className="w-9 h-9 group-hover:scale-105 transition-transform" viewBox="0 0 44 44" fill="none">
              <path d="M12 12C8 12 8 16.5 8 22C8 27.5 8 32 12 32" stroke="#FFAA00" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M32 12C36 12 36 16.5 36 22C36 27.5 36 32 32 32" stroke="#FFAA00" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M22 7.5C22 7.5 13.5 16.5 13.5 24.5C13.5 29.5 17.3 33 22 33C26.7 33 30.5 29.5 30.5 24.5C30.5 16.5 22 7.5 22 7.5Z" stroke="#00C853" strokeWidth="1.8" fill="rgba(0,200,83,0.1)" />
              <circle cx="22" cy="22" r="2" fill="#FFAA00" />
            </svg>
            <div>
              <div className="text-xs font-light tracking-[0.35em] text-white uppercase">
                ЮГРА<span className="text-[#FFAA00]">.</span><strong className="font-semibold text-[#FFAA00]">НЕФТЬ</strong>
              </div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#34D399]">
                ЗЕЛЁНАЯ ЮГРА
              </div>
            </div>
          </div>

          {/* ДЕСКТОПНЫЕ ВКЛАДКИ */}
          <nav className="hidden lg:flex items-center gap-1">
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) =>
                    `relative px-3.5 py-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                      isActive ? 'text-[#FFAA00]' : 'text-[#8A93A6] hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={14} className={isActive ? 'text-[#00C853]' : ''} />
                      <span>{tab.label}</span>
                      {tab.badge > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#00C853] text-[#050810] font-bold text-[9px]">
                          {tab.badge}
                        </span>
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="activeTabLine"
                          className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-[#00C853] via-[#FFAA00] to-[#00C853] shadow-[0_0_10px_#FFAA00]"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}

            {/* Выпадающее меню «Ещё» */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="px-3 py-2 text-[#8A93A6] hover:text-white flex items-center gap-1 font-mono text-[11px] uppercase"
              >
                <MoreHorizontal size={15} />
                <span>Ещё</span>
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    onMouseLeave={() => setMoreOpen(false)}
                    className="absolute right-0 mt-2 w-56 bg-[#070b14] border border-white/15 shadow-2xl p-2 z-50 space-y-1 font-mono text-xs"
                  >
                    <button
                      onClick={() => { navigate('/gamification'); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 text-zinc-300 flex items-center justify-between"
                    >
                      <span>Лидерборд и Дерево</span>
                      <Trophy size={13} className="text-[#FFAA00]" />
                    </button>
                    <a
                      href="https://ugra-oil.vercel.app/"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full px-3 py-2 hover:bg-white/5 text-zinc-300 flex items-center justify-between"
                    >
                      <span>3D-Портал ЮГРА.НЕФТЬ</span>
                      <ExternalLink size={13} className="text-[#22D3EE]" />
                    </a>
                    {isAdminOrDev && (
                      <button
                        onClick={() => { navigate('/admin'); setMoreOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-[#34D399] flex items-center justify-between"
                      >
                        <span>Панель Админа / Dev</span>
                        <Shield size={13} />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* ПРАВАЯ ЗОНА: STREAK, КОЛОКОЛЬЧИК УВЕДОМЛЕНИЙ, ПРОФИЛЬ */}
          <div className="flex items-center gap-3">
            {profile && (
              <>
                {/* Огонёк Streak */}
                <div
                  title="Ежедневная серия входов (Streak)"
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#FFAA00]/10 border border-[#FFAA00]/30 font-mono text-xs text-[#FFAA00]"
                >
                  <Flame size={14} className="fill-[#FFAA00]" />
                  <span>{profile.streak_days || 1} дн.</span>
                </div>

                {/* Колокольчик In-App уведомлений */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen(!notifOpen);
                      if (!notifOpen && unreadNotifsCount > 0) markNotificationsRead();
                    }}
                    className="p-2 border border-white/10 hover:border-[#FFAA00] text-[#8A93A6] hover:text-white relative"
                  >
                    <Bell size={16} />
                    {unreadNotifsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00C853] text-[#050810] font-mono text-[9px] font-bold flex items-center justify-center">
                        {unreadNotifsCount}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {notifOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute right-0 mt-2 w-80 bg-[#070b14] border border-white/15 shadow-2xl p-4 z-50 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]">
                            Уведомления Realtime
                          </span>
                          <button onClick={() => setNotifOpen(false)} className="text-xs text-[#8A93A6]">✕</button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {notifications.length === 0 ? (
                            <div className="text-xs text-[#8A93A6] py-4 text-center font-mono">
                              Новых уведомлений нет
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <div key={n.id} className="p-2.5 border border-white/5 bg-[#050810] text-xs space-y-1">
                                <div className="flex justify-between font-mono text-[9px] text-[#34D399] uppercase">
                                  <span>{n.type}</span>
                                  <span>{new Date(n.created_at).toLocaleTimeString().slice(0, 5)}</span>
                                </div>
                                <div className="text-zinc-300">
                                  {n.payload?.preview || n.payload?.title || 'Новое событие в экосистеме'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Мини-профиль */}
                <div
                  onClick={() => navigate(`/profile/${profile.username.replace('@', '')}`)}
                  className="flex items-center gap-2.5 cursor-pointer pl-2 border-l border-white/10"
                >
                  <Avatar src={profile.avatar_url} username={profile.username} status={profile.status} size="sm" />
                  <div className="hidden md:block text-left">
                    <div className="font-mono text-[11px] text-[#FFAA00] leading-none">{profile.username}</div>
                    <div className="font-mono text-[9px] text-[#34D399] mt-1">{profile.xp || 0} XP</div>
                  </div>
                </div>

                <button onClick={signOut} title="Выйти" className="p-2 text-[#8A93A6] hover:text-red-400">
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ОСНОВНОЙ КОНТЕНТ С ПЛАВНЫМ ПЕРЕХОДОМ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {children}
        </motion.div>
      </main>

      {/* МОБИЛЬНЫЙ BOTTOM-NAV (5 иконок max) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#050810]/95 backdrop-blur-xl border-t border-white/10 grid grid-cols-5 h-16">
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 font-mono text-[9px] uppercase relative ${
                  isActive ? 'text-[#FFAA00]' : 'text-[#8A93A6]'
                }`
              }
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute top-1.5 right-5 w-4 h-4 rounded-full bg-[#00C853] text-[#050810] font-bold text-[9px] flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}