import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, checkRateLimit, uploadFileToStorage } from '../lib/supabaseClient';
import { Button, Input, Card, useToast } from '../components/ui/DesignSystem';

const loginSchema = z.object({
  email: z.string().email('Введите корректный Email'),
  password: z.string().min(6, 'Минимум 6 символов')
});

const registerSchema = z.object({
  email: z.string().email('Введите корректный Email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .regex(/^@?[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
  full_name: z.string().min(3, 'Укажите имя и фамилию'),
  org_id: z.string().min(1, 'Выберите организацию из списка'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Необходимо согласие с правилами экосистемы' }) })
});

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'magic'
  const [orgs, setOrgs] = useState([]);
  const [orgTypeFilter, setOrgTypeFilter] = useState('all');
  const [orgSearch, setOrgSearch] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const fromPath = location.state?.from?.pathname || '/';

  const loginForm = useForm({ resolver: zodResolver(loginSchema) });
  const regForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { org_id: '11111111-1111-1111-1111-111111111111', consent: false }
  });

  useEffect(() => {
    supabase
      .from('organizations')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data && data.length) setOrgs(data);
        else {
          setOrgs([
            { id: '11111111-1111-1111-1111-111111111111', name: 'МБОУ «СОШ № 1» (Роснефть-класс)', type: 'school', city: 'пгт. Пойковский' },
            { id: '44444444-4444-4444-4444-444444444444', name: 'Югорский государственный университет', type: 'university', city: 'г. Ханты-Мансийск' },
            { id: '55555555-5555-5555-5555-555555555555', name: 'ООО «РН-Юганскнефтегаз»', type: 'company', city: 'г. Нефтеюганск' },
            { id: '66666666-6666-6666-6666-666666666666', name: 'Экспертное жюри «Шаг в будущее»', type: 'jury', city: 'ХМАО — Югра' }
          ]);
        }
      });
  }, []);

  const filteredOrgs = orgs.filter((o) => {
    const matchType = orgTypeFilter === 'all' || o.type === orgTypeFilter;
    const matchSearch = o.name.toLowerCase().includes(orgSearch.toLowerCase()) || o.city.toLowerCase().includes(orgSearch.toLowerCase());
    return matchType && matchSearch;
  });

  const onLogin = async (values) => {
    try {
      checkRateLimit('auth_login', 2000);
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      if (error) throw error;
      toast('Авторизация успешна!', 'success');
      navigate(fromPath, { replace: true });
    } catch (e) {
      toast(e.message || 'Ошибка входа', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onMagicLink = async (e) => {
    e.preventDefault();
    const email = loginForm.getValues('email');
    if (!email) return toast('Укажите Email для отправки Magic Link', 'error');
    try {
      checkRateLimit('auth_magic', 5000);
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      toast('Ссылка для входа отправлена на вашу почту!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onRegister = async (values) => {
    try {
      checkRateLimit('auth_register', 3000);
      setSubmitting(true);
      const formattedUsername = values.username.startsWith('@') ? values.username.toLowerCase() : `@${values.username.toLowerCase()}`;

      // Проверка уникальности @username
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', formattedUsername)
        .maybeSingle();

      if (existing) {
        throw new Error(`Никнейм ${formattedUsername} уже занят другим участником`);
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            username: formattedUsername,
            full_name: values.full_name,
            org_id: values.org_id
          }
        }
      });
      if (error) throw error;

      // Если выбран файл аватара и пользователь сразу авторизован
      if (avatarFile && signUpData?.user?.id) {
        try {
          const avatarUrl = await uploadFileToStorage('avatars', signUpData.user.id, avatarFile);
          await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', signUpData.user.id);
        } catch (uploadErr) {
          console.warn('Avatar upload warning:', uploadErr.message);
        }
      }

      toast('Аккаунт создан! Добро пожаловать в «Зелёную Югру».', 'success');
      navigate(fromPath, { replace: true });
    } catch (e) {
      toast(e.message || 'Ошибка регистрации', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 border-white/15">
        <div className="eyebrow mb-2">Единый контур авторизации Supabase Auth</div>
        <h1 className="text-3xl font-extralight text-white mb-6">
          Цифровая экосистема <strong className="font-semibold text-[#00C853]">«Зелёная Югра»</strong>
        </h1>

        <div className="flex gap-4 border-b border-white/10 pb-3 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`font-mono text-xs uppercase tracking-widest pb-1 border-b-2 ${
              mode === 'login' ? 'border-[#FFAA00] text-[#FFAA00]' : 'border-transparent text-[#8A93A6]'
            }`}
          >
            01 / Вход
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`font-mono text-xs uppercase tracking-widest pb-1 border-b-2 ${
              mode === 'register' ? 'border-[#00C853] text-[#34D399]' : 'border-transparent text-[#8A93A6]'
            }`}
          >
            02 / Регистрация исследователя
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <Input
              label="Email участника"
              type="email"
              placeholder="student@ugra-oil.ru"
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />
            <Input
              label="Пароль"
              type="password"
              placeholder="••••••••"
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Синхронизация...' : 'Войти по паролю'}
              </Button>
              <Button type="button" variant="outline" onClick={onMagicLink} disabled={submitting}>
                Войти по Magic Link
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={regForm.handleSubmit(onRegister)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Уникальный @username"
                placeholder="@pestrikov_kv"
                error={regForm.formState.errors.username?.message}
                {...regForm.register('username')}
              />
              <Input
                label="ФИО полностью"
                placeholder="Пестриков Кирилл Валерьевич"
                error={regForm.formState.errors.full_name?.message}
                {...regForm.register('full_name')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="student@ugra-oil.ru"
                error={regForm.formState.errors.email?.message}
                {...regForm.register('email')}
              />
              <Input
                label="Пароль (мин. 6 символов)"
                type="password"
                placeholder="••••••••"
                error={regForm.formState.errors.password?.message}
                {...regForm.register('password')}
              />
            </div>

            {/* Выбор организации с категориями и поиском */}
            <div className="p-4 border border-white/10 bg-[#050810] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#FFAA00]">
                  Организация ХМАО-Югры
                </span>
                <div className="flex gap-1">
                  {[
                    { id: 'all', label: 'Все' },
                    { id: 'school', label: 'Школа' },
                    { id: 'university', label: 'ВУЗ' },
                    { id: 'company', label: 'Компания' },
                    { id: 'jury', label: 'Жюри' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setOrgTypeFilter(cat.id)}
                      className={`px-2 py-0.5 font-mono text-[9px] uppercase border ${
                        orgTypeFilter === cat.id ? 'border-[#00C853] text-[#34D399]' : 'border-white/10 text-[#8A93A6]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="Поиск организации по названию или городу..."
                className="w-full bg-[#070b14] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none"
              />

              <select
                {...regForm.register('org_id')}
                className="w-full bg-[#070b14] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none"
              >
                {filteredOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Загрузка аватара */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
                Аватар профиля (JPG/PNG до 5 МБ — опционально)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                className="text-xs text-[#8A93A6] file:mr-3 file:py-1.5 file:px-3 file:border file:border-white/15 file:bg-[#070b14] file:text-xs file:font-mono file:text-white"
              />
            </div>

            {/* Согласие с правилами */}
            <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" {...regForm.register('consent')} className="accent-[#00C853]" />
              <span>Принимаю правила цифровой образовательной среды «ЮГРА.НЕФТЬ» и политику обработки данных</span>
            </label>
            {regForm.formState.errors.consent && (
              <p className="font-mono text-[10px] text-red-400">{regForm.formState.errors.consent.message}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Создание профиля...' : 'Зарегистрироваться в экосистеме'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}