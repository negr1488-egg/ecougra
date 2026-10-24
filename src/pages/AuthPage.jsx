import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, checkRateLimit } from '../lib/supabaseClient';
import { Button, Input, Card, useToast } from '../components/ui/DesignSystem';

const loginSchema = z.object({
  email: z.string().email('Введите корректный Email'),
  password: z.string().min(6, 'Пароль должен содержать от 6 символов')
});

const registerSchema = z.object({
  email: z.string().email('Введите корректный Email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .regex(/^@?[a-zA-Z0-9_]+$/, 'Разрешены латиница, цифры и знак _'),
  full_name: z.string().min(2, 'Укажите ваше имя'),
  org_id: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Необходимо подтвердить согласие с правилами' }) })
});

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [orgs, setOrgs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const fromPath = location.state?.from?.pathname || '/';

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const regForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      username: '',
      full_name: '',
      org_id: '',
      consent: false
    }
  });

  useEffect(() => {
    supabase
      .from('organizations')
      .select('id, name, city')
      .order('name')
      .then(({ data }) => {
        if (data && data.length) setOrgs(data);
      });
  }, []);

  const onLogin = async (values) => {
    try {
      checkRateLimit('auth_login', 1500);
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Неверный Email или пароль. Если вы ещё не регистрировались, перейдите на вкладку «Регистрация».');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Email не подтверждён! Отключите Confirm Email в настройках Supabase Dashboard.');
        }
        throw error;
      }

      toast('Авторизация успешна!', 'success');
      navigate(fromPath, { replace: true });
    } catch (e) {
      toast(e.message || 'Ошибка входа', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onRegister = async (values) => {
    try {
      checkRateLimit('auth_register', 2000);
      setSubmitting(true);
      const formattedUsername = values.username.startsWith('@')
        ? values.username.toLowerCase().trim()
        : `@${values.username.toLowerCase().trim()}`;

      // Проверка доступности никнейма в таблице profiles
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', formattedUsername)
        .maybeSingle();

      if (existing) {
        throw new Error(`Никнейм ${formattedUsername} уже занят. Выберите другой.`);
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            username: formattedUsername,
            full_name: values.full_name.trim(),
            org_id: values.org_id || null
          }
        }
      });

      if (error) throw error;

      // Создание записи профиля
      if (signUpData?.user?.id) {
        await supabase.from('profiles').upsert([
          {
            id: signUpData.user.id,
            username: formattedUsername,
            full_name: values.full_name.trim(),
            org_id: values.org_id || null,
            xp: 100,
            streak_days: 1
          }
        ]);
      }

      toast('Регистрация прошла успешно!', 'success');
      navigate(fromPath, { replace: true });
    } catch (e) {
      toast(e.message || 'Ошибка регистрации', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 border-white/15">
        <div className="eyebrow mb-2">Авторизация</div>
        <h1 className="text-2xl font-light text-white mb-6">
          Экосистема <strong className="font-semibold text-[#00C853]">«Зелёная Югра»</strong>
        </h1>

        <div className="flex gap-4 border-b border-white/10 pb-3 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`font-mono text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${
              mode === 'login'
                ? 'border-[#FFAA00] text-[#FFAA00]'
                : 'border-transparent text-[#8A93A6]'
            }`}
          >
            01 / Вход
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`font-mono text-xs uppercase tracking-widest pb-1 border-b-2 transition-all ${
              mode === 'register'
                ? 'border-[#00C853] text-[#34D399]'
                : 'border-transparent text-[#8A93A6]'
            }`}
          >
            02 / Регистрация
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="example@mail.ru"
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />
            <Input
              label="Пароль"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />
            <Button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? 'Проверка данных...' : 'Войти в систему'}
            </Button>
          </form>
        ) : (
          <form onSubmit={regForm.handleSubmit(onRegister)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Никнейм (@username)"
                autoComplete="username"
                placeholder="@ivanov"
                error={regForm.formState.errors.username?.message}
                {...regForm.register('username')}
              />
              <Input
                label="Имя и фамилия"
                autoComplete="name"
                placeholder="Иван Иванов"
                error={regForm.formState.errors.full_name?.message}
                {...regForm.register('full_name')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="example@mail.ru"
                error={regForm.formState.errors.email?.message}
                {...regForm.register('email')}
              />
              <Input
                label="Пароль"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={regForm.formState.errors.password?.message}
                {...regForm.register('password')}
              />
            </div>

            {orgs.length > 0 && (
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8A93A6] mb-1">
                  Организация
                </label>
                <select
                  {...regForm.register('org_id')}
                  className="w-full bg-[#050810] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C853]"
                >
                  <option value="">Не указывать</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer pt-1">
              <input type="checkbox" {...regForm.register('consent')} className="accent-[#00C853]" />
              <span>Согласен с правилами платформы</span>
            </label>
            {regForm.formState.errors.consent && (
              <p className="font-mono text-[10px] text-red-400">{regForm.formState.errors.consent.message}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? 'Создание профиля...' : 'Зарегистрироваться'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}