import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Badge, Button } from '../ui/DesignSystem';
import LogoIcon from '../ui/LogoIcon';
import {
  Home,
  BookOpen,
  Compass,
  MessageSquare,
  Trophy,
  User,
  ShieldAlert,
  Bell,
  LogOut,
  Flame,
  X,
  Trash2,
  Cookie,
  Radio,
  Cpu,
  Menu
} from 'lucide-react';

export default function AppShell() {
  const { profile, notifications = [], unreadChatCount, markNotificationsRead, hasRole, signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all');
  const [deletedNotifIds, setDeletedNotifIds] = useState([]);
  const [cookieAccepted, setCookieAccepted] = useState(() => localStorage.getItem('ugra_cookie_ok') === '1');
  const navigate = useNavigate();

  const visibleNotifs = notifications
    .filter((n) => !n.deleted_at && !deletedNotifIds.includes(n.id))
    .filter((n) => (notifFilter === 'unread' ? !n.read_at : true));

  const unreadNotifCount = visibleNotifs.filter((n) => !n.read_at).length;

  const handleDeleteOneNotif = async (id) => {
    setDeletedNotifIds((prev) => [...prev, id]);
    await supabase.from('notifications').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  };

  const handleClearAllNotifs = async () => {
    const allIds = visibleNotifs.map((n) => n.id);
    setDeletedNotifIds((prev) => [...prev, ...allIds]);
    if (profile?.id) {
      await supabase
        .from('notifications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', profile.id);
    }
  };

  const navItems = [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/learn', label: 'Обучение', icon: BookOpen },
    { to: '/activities', label: 'Активности', icon: Compass },
    { to: '/chat', label: 'Чат', icon: MessageSquare, badge: unreadChatCount },
    { to: '/gamification', label: 'Лидерборд', icon: Trophy },
    { to: '/profile', label: 'Профиль', icon: User }
  ];

  if (hasRole(['admin', 'dev'])) {
    navItems.push({ to: '/admin', label: 'Админ', icon: ShieldAlert });
  }

  return (
    <div className="min-h-screen bg-[#030509] text-zinc-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-[#00C853]/30 selection:text-white pb-16 lg:pb-0">
      {/* ДЕКОРАТИВНЫЙ ФОН ГЛУБИНЫ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[650px] h-[650px] bg-gradient-to-br from-[#00C853]/15 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-1/4 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-[#FFAA00]/10 to-transparent rounded-full blur-[160px]" />
        <div className="absolute -bottom-32 left-1/4 w-[700px] h-[700px] bg-gradient-to-tr from-[#0077b6]/12 to-transparent rounded-full blur-[170px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <div className="hidden xl:block absolute top-24 left-8 font-mono text-[9px] text-white/20 uppercase tracking-widest space-y-1">
          <div>LOC // 61.2333° N, 71.9333° E</div>
          <div className="flex items-center gap-1.5 text-[#34D399]/40">
            <Radio size={10} className="animate-ping" /> SECTOR // KHMAO-OILFIELD-01
          </div>
        </div>

        <div className="hidden xl:block absolute top-24 right-8 font-mono text-[9px] text-white/20 uppercase tracking-widest text-right space-y-1">
          <div>SYS // ECO_TELEMETRY_V2.6</div>
          <div className="flex items-center justify-end gap-1.5 text-[#FFAA00]/40">
            <Cpu size={10} /> PROMETHEUS PROTOCOL ACTIVE
          </div>
        </div>
      </div>

      {/* ШАПКА */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#04060c]/85 backdrop-blur-2xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Кнопка-гамбургер для мобильных */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 border border-white/10 bg-white/[0.02] text-[#8A93A6] hover:text-white"
              title="Открыть меню"
            >
              <Menu size={18} />
            </button>

            <div onClick={() => navigate('/')} className="flex items-center gap-2.5 cursor-pointer">
              <LogoIcon className="w-9 h-9 shrink-0" />
              <div>
                <div className="text-xs font-bold tracking-widest uppercase text-white">
                  ЮГРА.<span className="text-[#FFAA00]">НЕФТЬ</span>
                </div>
                <div className="font-mono text-[9px] text-[#34D399] uppercase tracking-widest">Зелёная Югра</div>
              </div>
            </div>
          </div>

          {/* НАВИГАЦИЯ ДЛЯ КОМПЬЮТЕРОВ (БЕЗ ИЗМЕНЕНИЙ) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                      isActive ? 'border-[#00C853] text-white bg-white/[0.04]' : 'border-transparent text-[#8A93A6] hover:text-white'
                    }`
                  }
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.2 bg-[#FFAA00] text-[#050810] font-bold rounded-full text-[9px]">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* ПРАВАЯ ЧАСТЬ ШАПКИ */}
          <div className="flex items-center gap-2 sm:gap-3 relative">
            <Badge color="gold" className="hidden sm:inline-flex">
              <Flame size={12} /> {profile?.streak_days || 1} дн.
            </Badge>

            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                if (!notifOpen && unreadNotifCount > 0) markNotificationsRead();
              }}
              className="relative p-2 border border-white/10 bg-white/[0.02] hover:border-white/30 text-[#8A93A6] hover:text-white transition-colors"
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00C853] text-[#050810] font-mono text-[9px] font-bold flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* ВЫПАДАЮЩИЙ ЦЕНТР УВЕДОМЛЕНИЙ */}
            {notifOpen && (
              <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-[#080d1a]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-4 z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]">
                    Уведомления ({visibleNotifs.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearAllNotifs}
                      className="font-mono text-[10px] text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Очистить
                    </button>
                    <button onClick={() => setNotifOpen(false)} className="text-[#8A93A6] hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setNotifFilter('all')}
                    className={`px-2.5 py-1 font-mono text-[10px] uppercase border ${
                      notifFilter === 'all' ? 'border-[#00C853] text-[#34D399]' : 'border-white/10 text-[#8A93A6]'
                    }`}
                  >
                    Все
                  </button>
                  <button
                    onClick={() => setNotifFilter('unread')}
                    className={`px-2.5 py-1 font-mono text-[10px] uppercase border ${
                      notifFilter === 'unread' ? 'border-[#FFAA00] text-[#FFAA00]' : 'border-white/10 text-[#8A93A6]'
                    }`}
                  >
                    Непрочитанные
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {visibleNotifs.length === 0 ? (
                    <div className="text-xs text-[#8A93A6] py-6 text-center font-mono">Нет уведомлений</div>
                  ) : (
                    visibleNotifs.map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 border border-white/10 bg-[#050810]/70 text-xs flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] text-[#34D399] uppercase">{n.type}</div>
                          <div className="text-zinc-300 mt-0.5 break-words">{n.payload?.preview || 'Событие платформы'}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteOneNotif(n.id)}
                          className="text-[#8A93A6] hover:text-red-400 p-1 shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div onClick={() => navigate('/profile')} className="flex items-center gap-2 cursor-pointer pl-1 sm:pl-2 border-l border-white/10">
              <Avatar src={profile?.avatar_url} username={profile?.username} status={profile?.status} size="sm" />
              <div className="hidden sm:block text-left">
                <div className="font-mono text-xs text-[#FFAA00] font-medium">{profile?.username || '@user'}</div>
                <div className="font-mono text-[10px] text-[#34D399]">{profile?.xp || 100} XP</div>
              </div>
            </div>

            <button onClick={signOut} className="p-2 text-[#8A93A6] hover:text-red-400" title="Выйти">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* МОБИЛЬНАЯ ВЫЕЗДНАЯ ШТОРКА (БОКОВОЕ МЕНЮ) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-[#060a14] border-r border-white/15 p-6 shadow-2xl flex flex-col justify-between z-10 animate-slideRight">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 font-mono text-xs text-white">
                  <LogoIcon className="w-6 h-6" /> МЕНЮ НАВИГАЦИИ
                </div>
                <button onClick={() => setMobileDrawerOpen(false)} className="text-[#8A93A6] hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between p-3 border font-mono text-xs uppercase tracking-wider transition-all ${
                          isActive
                            ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold'
                            : 'border-white/5 bg-[#050810] text-[#8A93A6] hover:text-white hover:border-white/20'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge > 0 && (
                        <span className="px-2 py-0.5 bg-[#FFAA00] text-[#050810] font-bold text-[10px] rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#8A93A6]">
                <span>Серия активности:</span>
                <span className="text-[#FFAA00]">🔥 {profile?.streak_days || 1} дн.</span>
              </div>
              <div className="flex items-center justify-between text-[#8A93A6]">
                <span>Баланс:</span>
                <span className="text-[#34D399] font-bold">{profile?.xp || 100} XP</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 relative z-10">
        <Outlet />
      </main>

      {/* НИЖНИЙ ПЛАВАЮЩИЙ НАВБАР ДЛЯ ТЕЛЕФОНОВ (BOTTOM NAVIGATION) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060a14]/95 backdrop-blur-2xl border-t border-white/15 px-2 py-1.5 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.7)]">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 rounded relative transition-colors ${
                  isActive ? 'text-[#34D399]' : 'text-[#8A93A6] hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span className="font-mono text-[9px] uppercase tracking-wider mt-0.5">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-[#FFAA00] rounded-full" />
              )}
            </NavLink>
          );
        })}
        {/* Кнопка Профиль в нижнем баре */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded transition-colors ${
              isActive ? 'text-[#34D399]' : 'text-[#8A93A6] hover:text-white'
            }`
          }
        >
          <User size={18} />
          <span className="font-mono text-[9px] uppercase tracking-wider mt-0.5">Профиль</span>
        </NavLink>
      </nav>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#020307]/90 backdrop-blur-md py-8 px-4 sm:px-8 mt-12 relative z-10 print:hidden hidden lg:block">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-[#8A93A6]">
          <div className="space-y-2">
            <div className="font-mono text-sm font-bold text-white">
              ЮГРА.<span className="text-[#FFAA00]">НЕФТЬ</span> — Зелёная Югра
            </div>
            <p className="text-[11px] leading-relaxed">
              Цифровая образовательная и инженерно-экологическая платформа ХМАО-Югры.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white mb-2">Разделы</div>
            <div><Link to="/learn" className="hover:text-[#34D399]">Калькулятор CO₂ и Симуляторы</Link></div>
            <div><Link to="/activities" className="hover:text-[#34D399]">Защита проектов и Яндекс.Карта</Link></div>
            <div><Link to="/gamification" className="hover:text-[#34D399]">Лидерборд Топ-100 школ</Link></div>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white mb-2">Правовая информация</div>
            <div><Link to="/legal?doc=privacy" className="hover:text-[#FFAA00]">Политика конфиденциальности</Link></div>
            <div><Link to="/legal?doc=terms" className="hover:text-[#FFAA00]">Условия пользования</Link></div>
            <div><Link to="/legal?doc=rules" className="hover:text-[#FFAA00]">Правила сообщества</Link></div>
            <div><Link to="/legal?doc=pdn" className="hover:text-[#FFAA00]">Обработка персональных данных (152-ФЗ)</Link></div>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white mb-2">Авторы</div>
            <div>Команда «Зелёная Югра» (МБОУ «СОШ № 1» пгт. Пойковский)</div>
            <div className="font-mono text-[11px] text-[#34D399] pt-1">© 2026 Все права защищены</div>
          </div>
        </div>
      </footer>

      {!cookieAccepted && (
        <div className="fixed bottom-16 lg:bottom-4 right-4 left-4 sm:left-auto sm:max-w-md bg-[#0a0f1c]/95 border border-[#00C853]/50 p-4 shadow-2xl z-50 flex items-center justify-between gap-4 backdrop-blur-lg">
          <div className="flex items-center gap-3 text-xs text-zinc-200">
            <Cookie size={22} className="text-[#FFAA00] shrink-0" />
            <span>Мы используем файлы Cookie для сохранения сессии платформы.</span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              localStorage.setItem('ugra_cookie_ok', '1');
              setCookieAccepted(true);
            }}
          >
            Принять
          </Button>
        </div>
      )}
    </div>
  );
}