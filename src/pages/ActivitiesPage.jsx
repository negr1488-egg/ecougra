import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import HmaoEcoMap from '../components/Map/HmaoEcoMap';
import { Card, Button, Input, Badge, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import {
  EyeOff,
  Calendar,
  Video,
  FastForward,
  Award,
  FolderPlus,
  Users,
  Sliders,
  ShieldCheck,
  RotateCcw,
  UserCheck,
  BookOpen,
  Link as LinkIcon
} from 'lucide-react';

const STATUS_RU = {
  draft: { label: 'Черновик', color: 'zinc' },
  submitted: { label: 'На рассмотрении', color: 'gold' },
  scheduled: { label: 'Допущен наставником к защите', color: 'cyan' },
  defended: { label: 'Защищён перед жюри', color: 'emerald' },
  approved: { label: 'Одобрен к внедрению', color: 'emerald' },
  revision: { label: 'Отправлен на доработку', color: 'red' },
  rejected: { label: 'Отклонён комиссией', color: 'red' },
  active: { label: 'В разработке', color: 'cyan' },
  completed: { label: 'Завершён', color: 'emerald' }
};

const PITCH_SIM_STEPS = [
  {
    step: 1,
    title: 'Шаг 1 из 4: Формулировка проблемы месторождения',
    hint: 'С чего начать доклад перед экспертной комиссией «Зелёная Югра»?',
    fact: 'Комиссия жюри оценивает актуальность экологической проблемы для ХМАО с весом 25% от общей оценки.',
    options: [
      {
        label: '🎯 Озвучить конкретную экологическую проблему промысла и привести точные цифры потерь',
        ok: true,
        msg: '✅ Отлично! Точные цифры сразу фокусируют внимание экспертов.'
      },
      {
        label: '📜 Рассказывать общую теорию возникновения нефти на протяжении 7 минут',
        ok: false,
        msg: '❌ Неверно. Время питча строго ограничено — переходите сразу к проблематике.'
      }
    ]
  },
  {
    step: 2,
    title: 'Шаг 2 из 4: Инженерно-технологическое решение',
    hint: 'Как убедительно представить разработанную технологию?',
    fact: 'Научная новизна и инженерная проработка приносят 30% итогового балла защиты.',
    options: [
      {
        label: '⚙️ Показать технологическую схему установки или биопрепарата и объяснить принцип действия',
        ok: true,
        msg: '✅ Верно! Инженерная схема доказывает практическую реализуемость.'
      },
      {
        label: '🤷 Сказать, что нужно просто бережнее относиться к тайге без технических решений',
        ok: false,
        msg: '❌ Неверно. На защите требуется конкретное инженерное или IT-решение.'
      }
    ]
  },
  {
    step: 3,
    title: 'Шаг 3 из 4: Измеримый экологический эффект',
    hint: 'Какой главный показатель ждёт комиссия от вашего проекта?',
    fact: 'Расчёт сокращения углеродного следа CO₂ и окупаемости даёт ещё 25% успеха.',
    options: [
      {
        label: '📉 Привести расчёт: снижение выбросов CO₂ на 32% и срок окупаемости внедрения 1,5 года',
        ok: true,
        msg: '✅ Блестяще! Язык цифр и экологического эффекта убеждает промышленников.'
      },
      {
        label: '💭 Ответить, что экономику и экологический эффект вы не считали',
        ok: false,
        msg: '❌ Неверно. Без измеримого эффекта проект вернут на доработку.'
      }
    ]
  },
  {
    step: 4,
    title: 'Шаг 4 из 4: Сессия вопросов и ответов жюри',
    hint: 'Эксперт жюри задаёт сложный вопрос по зимней эксплуатации в условиях Югры. Ваши действия?',
    fact: 'Грамотная аргументация и знание региональной специфики приносят +120 XP.',
    options: [
      {
        label: '🤝 Поблагодарить за вопрос и привести данные по морозостойкости материалов до -50 °C',
        ok: true,
        msg: '✅ Превосходно! Вы полностью готовы к реальной защите перед жюри!'
      },
      {
        label: '😠 Начать спорить с экспертом и говорить, что вопрос не по теме',
        ok: false,
        msg: '❌ Неверно. Культура научной дискуссии — важный критерий оценки.'
      }
    ]
  }
];

export default function ActivitiesPage() {
  const { user, profile, hasRole, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isTeacher = hasRole(['teacher', 'admin', 'dev']);
  const isJury = hasRole(['jury', 'admin', 'dev']);

  const [tab, setTab] = useState('projects');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProj, setSelectedProj] = useState(null);

  // Привязка наставника по @username
  const [mentorInput, setMentorInput] = useState('');

  // Форма создания проекта
  const [projForm, setProjForm] = useState({
    title: '',
    description: '',
    impact_metric: 'Снижение выбросов CO₂ на 30%',
    blind_mode: false,
    pitch_at: '',
    call_link: '',
    mentor_username: ''
  });

  // Состояния для кабинета Наставника
  const [mentorNotes, setMentorNotes] = useState({});

  // Состояния для пульта Жюри
  const [scores, setScores] = useState({
    science: 9,
    relevance: 9,
    feasibility: 8,
    pitch: 9,
    comment: '',
    decision: 'approved'
  });

  // Тренажёр
  const [simStep, setSimStep] = useState(0);
  const [simFeedback, setSimFeedback] = useState(null);

  // Загрузка проектов и профилей
  const { data: bundle, isLoading } = useQuery({
    queryKey: ['activities_full_v9', user?.id],
    queryFn: async () => {
      const [projsRes, revsRes, profsRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('project_reviews').select('*'),
        supabase.from('profiles').select('id, username, full_name, xp, mentor_id, avatar_url')
      ]);

      const profs = profsRes.data || [];
      const profMap = Object.fromEntries(profs.map((p) => [p.id, p]));
      const revs = revsRes.data || [];

      const enrichedProjects = (projsRes.data || []).map((pr) => {
        const prReviews = revs.filter((r) => r.project_id === pr.id);
        const avgWeighted =
          prReviews.length > 0
            ? (
                prReviews.reduce(
                  (acc, r) =>
                    acc +
                    ((r.score_science || 8) * 0.3 +
                      (r.score_relevance || 8) * 0.25 +
                      (r.score_feasibility || 8) * 0.25 +
                      (r.score_pitch || 8) * 0.2) *
                      10,
                  0
                ) / prReviews.length
              ).toFixed(1)
            : null;

        return {
          ...pr,
          authorProfile: profMap[pr.author_id],
          mentorProfile: pr.mentor_id ? profMap[pr.mentor_id] : null,
          reviews: prReviews,
          avgWeighted
        };
      });

      const myMentees = profs.filter((p) => p.mentor_id === user?.id);

      return {
        projects: enrichedProjects,
        myMentees,
        profMap
      };
    }
  });

  // Приватная привязка к наставнику по его личному @username
  const bindMentorMutation = useMutation({
    mutationFn: async (e) => {
      e?.preventDefault();
      const raw = mentorInput.trim();
      if (!raw) throw new Error('Введите никнейм наставника');
      const clean = raw.startsWith('@') ? raw : `@${raw}`;

      const { data: foundMentor, error: findErr } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .ilike('username', clean)
        .maybeSingle();

      if (findErr || !foundMentor) {
        throw new Error(`Пользователь ${clean} не найден в системе`);
      }

      if (foundMentor.id === user.id) {
        throw new Error('Нельзя указать себя своим же наставником');
      }

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', foundMentor.id);

      const roleIds = (rolesData || []).map((r) => r.role_id);
      const isEligible = roleIds.includes(2) || roleIds.includes(4) || roleIds.includes(5);

      if (!isEligible) {
        throw new Error(`Пользователь ${clean} не обладает статусом Наставника`);
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ mentor_id: foundMentor.id })
        .eq('id', user.id);

      if (updErr) throw updErr;
      return foundMentor;
    },
    onSuccess: (mentor) => {
      queryClient.invalidateQueries({ queryKey: ['activities_full_v9'] });
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v9'] });
      if (refreshProfile) refreshProfile();
      setMentorInput('');
      toast(`Куратор ${mentor.username} (${mentor.full_name}) привязан!`, 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  const unbindMentorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({ mentor_id: null }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities_full_v9'] });
      queryClient.invalidateQueries({ queryKey: ['profile_bundle_v9'] });
      if (refreshProfile) refreshProfile();
      toast('Наставник отвязан', 'info');
    }
  });

  // Создание проекта с валидацией куратора по username
  const createProjectMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!user?.id) throw new Error('Необходима авторизация');

      let resolvedMentorId = profile?.mentor_id || null;

      // Если в модалке ввели никнейм наставника вручную
      if (projForm.mentor_username.trim()) {
        const raw = projForm.mentor_username.trim();
        const clean = raw.startsWith('@') ? raw : `@${raw}`;

        const { data: foundMentor } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', clean)
          .maybeSingle();

        if (!foundMentor) {
          throw new Error(`Указанный наставник ${clean} не найден`);
        }
        resolvedMentorId = foundMentor.id;
      }

      const payload = {
        title: projForm.title.trim(),
        description: projForm.description.trim(),
        impact_metric: projForm.impact_metric.trim(),
        status: 'submitted',
        author_id: user.id,
        mentor_id: resolvedMentorId,
        blind_mode: Boolean(projForm.blind_mode)
      };

      if (projForm.pitch_at) payload.pitch_at = projForm.pitch_at;
      if (projForm.call_link) payload.call_link = projForm.call_link.trim();

      const { error } = await supabase.from('projects').insert([payload]);
      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'project_created',
        p_entity: 'project',
        p_xp_delta: 75,
        p_badge: 'Автор инженерного проекта'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities_full_v9'] });
      setCreateOpen(false);
      setProjForm({
        title: '',
        description: '',
        impact_metric: 'Снижение выбросов CO₂ на 30%',
        blind_mode: false,
        pitch_at: '',
        call_link: '',
        mentor_username: ''
      });
      toast('Проект подан на рассмотрение! (+75 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Курирование Наставника
  const mentorCurateMutation = useMutation({
    mutationFn: async ({ proj, newStatus }) => {
      const note = mentorNotes[proj.id] || '';
      const updatedDesc = note
        ? `${proj.description}\n\n[Рекомендация наставника ${profile?.username || ''}]: ${note}`
        : proj.description;

      const { error } = await supabase
        .from('projects')
        .update({
          status: newStatus,
          mentor_id: user.id,
          description: updatedDesc
        })
        .eq('id', proj.id);

      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'mentor_curated_project',
        p_entity: 'project',
        p_xp_delta: 50,
        p_badge: 'Наставник проектной смены'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities_full_v9'] });
      toast('Решение наставника зафиксировано! (+50 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  // Оценка Жюри
  const submitJuryReviewMutation = useMutation({
    mutationFn: async (proj) => {
      const { error } = await supabase.from('project_reviews').upsert([
        {
          project_id: proj.id,
          jury_id: user.id,
          score_science: Number(scores.science),
          score_relevance: Number(scores.relevance),
          score_feasibility: Number(scores.feasibility),
          score_pitch: Number(scores.pitch),
          comment: scores.comment,
          decision: scores.decision
        }
      ]);
      if (error) throw error;

      const nextStatus = scores.decision === 'approved' ? 'defended' : 'revision';
      await supabase.from('projects').update({ status: nextStatus }).eq('id', proj.id);

      await supabase.rpc('award_xp_secure', {
        p_action: 'jury_audit_completed',
        p_entity: 'project_review',
        p_xp_delta: 75,
        p_badge: 'Аудитор Зелёной Югры'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities_full_v9'] });
      setSelectedProj(null);
      toast('Оценка жюри сохранена! (+75 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const projects = bundle?.projects || [];
  const myMentees = bundle?.myMentees || [];
  const currentMentorObj = profile?.mentor_id ? bundle?.profMap?.[profile.mentor_id] : null;

  return (
    <div className="space-y-8">
      {/* ШАПКА РАЗДЕЛА */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="eyebrow">Ролевая экосистема проектов «Зелёный след»</div>
          <h1 className="text-3xl font-light text-white mt-1">
            Проекты, Наставничество и <strong className="font-semibold text-[#00C853]">Экспертиза ХМАО</strong>
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'projects'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_12px_rgba(0,200,83,0.2)]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            01 / Проекты ({projects.length})
          </button>

          {isTeacher && (
            <button
              onClick={() => setTab('mentor_lab')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                tab === 'mentor_lab'
                  ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <Users size={13} /> Мастерская Наставника
            </button>
          )}

          {isJury && (
            <button
              onClick={() => setTab('jury_audit')}
              className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all flex items-center gap-1.5 ${
                tab === 'jury_audit'
                  ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold shadow-[0_0_12px_rgba(255,170,0,0.2)]'
                  : 'border-white/10 text-[#8A93A6] hover:text-white'
              }`}
            >
              <Award size={13} /> Аудит Жюри
            </button>
          )}

          <button
            onClick={() => setTab('pitch_sim')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'pitch_sim'
                ? 'border-purple-400 bg-purple-500/15 text-purple-300 font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            Тренажёр защиты
          </button>

          <button
            onClick={() => setTab('map')}
            className={`px-4 py-2 font-mono text-xs uppercase rounded border transition-all ${
              tab === 'map'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            Яндекс.Карта ХМАО
          </button>
        </div>
      </div>

      {/* ВКЛАДКА 1: ПРОЕКТЫ И ЗАКРЫТАЯ ПРИВЯЗКА КУРАТОРА */}
      {tab === 'projects' && (
        <div className="space-y-6">
          {/* Блок привязки куратора по личному @username */}
          <Card className="p-5 border-[#22D3EE]/30 bg-gradient-to-r from-[#060a14] via-[#071923] to-[#060a14]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1 max-w-xl">
                <div className="font-mono text-xs uppercase tracking-widest text-[#22D3EE] flex items-center gap-2">
                  <UserCheck size={15} /> Персональное научное кураторство
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {currentMentorObj ? (
                    <span>
                      Ваш текущий наставник:{' '}
                      <strong className="text-white">
                        {currentMentorObj.full_name} ({currentMentorObj.username})
                      </strong>
                      . Он курирует ваши проекты и допускает к защите.
                    </span>
                  ) : (
                    'Наставник передаёт вам свой личный @username для привязки. Общедоступный выбор отключён во избежание ошибок.'
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {currentMentorObj ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unbindMentorMutation.mutate()}
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                  >
                    Отвязать наставника
                  </Button>
                ) : (
                  <form onSubmit={(e) => bindMentorMutation.mutate(e)} className="flex items-center gap-2">
                    <Input
                      placeholder="@username_наставника"
                      value={mentorInput}
                      onChange={(e) => setMentorInput(e.target.value)}
                      className="w-48"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={bindMentorMutation.isPending}
                    >
                      <LinkIcon size={13} /> Привязать
                    </Button>
                  </form>
                )}

                <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
                  <FolderPlus size={14} /> Подать проект на защиту
                </Button>
              </div>
            </div>
          </Card>

          {/* Карточки проектов */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map((p) => {
              const hideAuthor = p.blind_mode && p.status !== 'approved' && p.status !== 'defended';
              const st = STATUS_RU[p.status] || { label: p.status, color: 'zinc' };

              return (
                <Card
                  key={p.id}
                  className="p-6 flex flex-col justify-between space-y-4 border-white/10 bg-[#060a14]/90 hover:border-[#00C853]/50 transition-all shadow-xl"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge color={st.color}>{st.label}</Badge>
                      {p.blind_mode && (
                        <Badge color="purple">
                          <EyeOff size={11} className="mr-1" /> Слепая защита
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-lg font-medium text-white">{p.title}</h3>
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{p.description}</p>

                    <div className="p-3 rounded-lg bg-[#050810] border border-white/10 space-y-1.5">
                      <div className="text-xs font-mono text-[#34D399]">
                        Целевой эффект: <strong>{p.impact_metric}</strong>
                      </div>
                      {p.mentorProfile && (
                        <div className="text-[11px] font-mono text-[#22D3EE]">
                          Куратор проекта: <strong>{p.mentorProfile.full_name} ({p.mentorProfile.username})</strong>
                        </div>
                      )}
                      {p.pitch_at && (
                        <div className="font-mono text-[11px] text-[#FFAA00] flex items-center justify-between pt-1 border-t border-white/5">
                          <span>
                            <Calendar size={12} className="inline mr-1" />
                            Защита: {new Date(p.pitch_at).toLocaleString()}
                          </span>
                          {p.call_link && (
                            <a
                              href={p.call_link}
                              target="_blank"
                              rel="noreferrer"
                              className="underline flex items-center gap-1 hover:text-white"
                            >
                              <Video size={12} /> Видеозвонок
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[#8A93A6]">
                      Автор:{' '}
                      <strong className="text-white">
                        {hideAuthor ? '🔒 Скрыт до вердикта жюри' : p.authorProfile?.username || '@исследователь'}
                      </strong>
                    </span>

                    <div className="flex items-center gap-2">
                      {p.avgWeighted && <Badge color="emerald">Рейтинг жюри: {p.avgWeighted} / 100</Badge>}
                      {isJury && (
                        <Button size="sm" variant="outline" onClick={() => setSelectedProj(p)}>
                          Оценить (Жюри)
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 2: ИНЖЕНЕРНАЯ МАСТЕРСКАЯ НАСТАВНИКА */}
      {tab === 'mentor_lab' && isTeacher && (
        <div className="space-y-6">
          <Card className="p-6 border-[#22D3EE]/40 bg-gradient-to-r from-[#060a14] via-[#092230] to-[#050810]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge color="cyan">Ролевая активность Наставника (+50 XP за рецензию)</Badge>
                <h2 className="text-xl font-medium text-white mt-1">
                  Инженерная мастерская и кураторство проектов
                </h2>
                <p className="text-xs text-zinc-300">
                  Ученики привязываются по вашему личному логину <strong className="text-[#FFAA00]">{profile?.username}</strong>. Вы проверяете черновики и допускаете их к защите перед жюри.
                </p>
              </div>
              <div className="font-mono text-xs text-[#22D3EE] border border-[#22D3EE]/30 bg-[#050810] px-4 py-2.5 rounded">
                Привязанных учеников: <strong>{myMentees.length}</strong>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-4 p-5 space-y-4 border-white/10 bg-[#060a14]">
              <div className="font-mono text-xs uppercase tracking-widest text-[#22D3EE] flex items-center gap-2">
                <Users size={15} /> Мои подопечные ({myMentees.length})
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {myMentees.length === 0 ? (
                  <div className="text-xs text-[#8A93A6] py-6 text-center font-mono leading-relaxed">
                    Пока никто не привязался по вашему логину. Передайте ученикам никнейм {profile?.username}.
                  </div>
                ) : (
                  myMentees.map((st) => (
                    <div key={st.id} className="p-3 rounded border border-white/10 bg-[#050810] flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-white">{st.full_name}</div>
                        <div className="font-mono text-[11px] text-[#FFAA00]">{st.username}</div>
                      </div>
                      <Badge color="emerald">{st.xp || 100} XP</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="lg:col-span-8 p-5 space-y-4 border-white/10 bg-[#060a14]">
              <div className="font-mono text-xs uppercase tracking-widest text-[#34D399] flex items-center gap-2">
                <BookOpen size={15} /> Проекты, ожидающие кураторского допуска
              </div>

              <div className="space-y-4">
                {projects.map((pr) => (
                  <div key={pr.id} className="p-4 rounded-lg border border-white/10 bg-[#050810] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-medium text-white">{pr.title}</h3>
                        <div className="text-[11px] font-mono text-[#8A93A6]">
                          Автор: <span className="text-[#FFAA00]">{pr.authorProfile?.username}</span> • Статус:{' '}
                          <span className="text-[#34D399]">{STATUS_RU[pr.status]?.label || pr.status}</span>
                        </div>
                      </div>
                      {pr.mentor_id === user?.id && <Badge color="cyan">Вы куратор</Badge>}
                    </div>

                    <p className="text-xs text-zinc-300">{pr.description}</p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        type="text"
                        value={mentorNotes[pr.id] || ''}
                        onChange={(e) => setMentorNotes({ ...mentorNotes, [pr.id]: e.target.value })}
                        placeholder="Методическая рекомендация ученику (необязательно)..."
                        className="flex-1 bg-[#030509] border border-white/15 rounded px-3 py-2 text-xs text-white"
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => mentorCurateMutation.mutate({ proj: pr, newStatus: 'scheduled' })}
                      >
                        <ShieldCheck size={14} /> Допустить к защите (+50 XP)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mentorCurateMutation.mutate({ proj: pr, newStatus: 'revision' })}
                      >
                        <RotateCcw size={14} /> На доработку
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ВКЛАДКА 3: АУДИТ ЖЮРИ */}
      {tab === 'jury_audit' && isJury && (
        <div className="space-y-6">
          <Card className="p-6 border-[#FFAA00]/40 bg-gradient-to-r from-[#060a14] via-[#211705] to-[#050810]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge color="gold">Ролевая активность Эксперта Жюри (+75 XP за вердикт)</Badge>
                <h2 className="text-xl font-medium text-white mt-1">
                  Пульт Жюри: Закрытый нефтяной аудит и слепая экспертиза
                </h2>
                <p className="text-xs text-zinc-300">
                  Оценивайте инженерные проекты по 4 критериям ХМАО-Югры. Ваш вердикт формирует официальный рейтинг разработки.
                </p>
              </div>
              <Badge color="purple">
                <EyeOff size={12} className="mr-1" /> Протокол объективности активен
              </Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map((p) => (
              <Card key={p.id} className="p-5 border-white/10 bg-[#060a14] flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge color={STATUS_RU[p.status]?.color || 'gold'}>
                      {STATUS_RU[p.status]?.label || p.status}
                    </Badge>
                    <span className="font-mono text-xs text-[#34D399]">
                      Эффект: {p.impact_metric}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-white">{p.title}</h3>
                  <p className="text-xs text-zinc-300">{p.description}</p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8A93A6]">
                    Рецензий жюри: <strong className="text-white">{p.reviews?.length || 0}</strong>
                  </span>
                  <Button size="sm" variant="gold" onClick={() => setSelectedProj(p)}>
                    <Sliders size={13} /> Выставить баллы аудита
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА 4: ТРЕНАЖЁР ЗАЩИТЫ */}
      {tab === 'pitch_sim' && (
        <Card className="p-8 max-w-2xl mx-auto space-y-6 border-[#FFAA00]/40 bg-[#060a14]/95 shadow-2xl">
          <div className="flex items-center justify-between">
            <Badge color="gold">{PITCH_SIM_STEPS[simStep].title}</Badge>
            <button
              onClick={() => {
                setSimStep(0);
                setSimFeedback(null);
                toast('Тренажёр защиты пройден! +120 XP', 'success');
              }}
              className="font-mono text-[10px] uppercase text-[#8A93A6] hover:text-white flex items-center gap-1"
            >
              <FastForward size={12} /> Завершить досрочно
            </button>
          </div>

          <h2 className="text-xl font-medium text-white">{PITCH_SIM_STEPS[simStep].hint}</h2>

          <div className="space-y-3">
            {PITCH_SIM_STEPS[simStep].options.map((o, i) => (
              <button
                key={i}
                onClick={() => setSimFeedback(o)}
                className="w-full min-h-[56px] p-4 rounded-lg border border-white/15 bg-[#050810] hover:border-[#FFAA00] text-left text-sm text-white transition-all"
              >
                {o.label}
              </button>
            ))}
          </div>

          {simFeedback && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg border text-sm ${
                  simFeedback.ok
                    ? 'border-[#00C853] text-[#34D399] bg-[#00C853]/10'
                    : 'border-red-500 text-red-300 bg-red-500/10'
                }`}
              >
                {simFeedback.msg}
              </div>
              <div className="p-3 rounded-lg bg-[#FFAA00]/10 border border-[#FFAA00]/30 text-xs text-zinc-200">
                💡 <strong className="text-[#FFAA00]">Факт регламента:</strong> {PITCH_SIM_STEPS[simStep].fact}
              </div>
              {simFeedback.ok && (
                <Button
                  variant="gold"
                  className="w-full justify-center"
                  onClick={() => {
                    if (simStep < PITCH_SIM_STEPS.length - 1) {
                      setSimStep((s) => s + 1);
                      setSimFeedback(null);
                    } else {
                      setSimStep(0);
                      setSimFeedback(null);
                      toast('Вы блестяще прошли тренажёр защиты! +120 XP', 'success');
                    }
                  }}
                >
                  {simStep < PITCH_SIM_STEPS.length - 1
                    ? 'Следующий этап питча →'
                    : 'Получить сертификат готовности (+120 XP)'}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ВКЛАДКА 5: КАРТА ХМАО */}
      {tab === 'map' && <HmaoEcoMap />}

      {/* МОДАЛКА СОЗДАНИЯ ПРОЕКТА: С ПЕРСОНАЛЬНЫМ ВВОДОМ КУРАТОРА */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Подать инженерный проект на защиту">
        <form onSubmit={(e) => createProjectMutation.mutate(e)} className="space-y-4">
          <Input
            label="Название проекта / разработки"
            placeholder="Например: Биоремедиация нефтезагрязнённых торфяников Югры"
            value={projForm.title}
            onChange={(e) => setProjForm({ ...projForm, title: e.target.value })}
            required
          />
          <Input
            label="Целевой измеримый эффект"
            placeholder="Например: Снижение выбросов CO₂ на 35%"
            value={projForm.impact_metric}
            onChange={(e) => setProjForm({ ...projForm, impact_metric: e.target.value })}
            required
          />

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
              Куратор проекта (логин наставника)
            </label>
            <Input
              placeholder={
                currentMentorObj
                  ? `По умолчанию: ${currentMentorObj.username}`
                  : 'Введите @username куратора (необязательно)'
              }
              value={projForm.mentor_username}
              onChange={(e) => setProjForm({ ...projForm, mentor_username: e.target.value })}
            />
            <span className="text-[10px] text-[#8A93A6] mt-1 block">
              Если оставить пустым, проект закрепится за вашим текущим привязанным наставником.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Желаемая дата защиты"
              type="datetime-local"
              value={projForm.pitch_at}
              onChange={(e) => setProjForm({ ...projForm, pitch_at: e.target.value })}
            />
            <Input
              label="Ссылка на видеозвонок"
              placeholder="https://telemost.yandex.ru/..."
              value={projForm.call_link}
              onChange={(e) => setProjForm({ ...projForm, call_link: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
              Описание проблемы и предлагаемого решения
            </label>
            <textarea
              rows={4}
              value={projForm.description}
              onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
              placeholder="Опишите суть разработки, этапы внедрения и пользу для ХМАО..."
              className="w-full bg-[#050810] border border-white/15 p-3 text-xs text-white rounded focus:outline-none focus:border-[#00C853]"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={projForm.blind_mode}
              onChange={(e) => setProjForm({ ...projForm, blind_mode: e.target.checked })}
              className="accent-[#FFAA00]"
            />
            <span>🕶️ Включить режим «Слепой защиты» (жюри не видит автора до выставления оценок)</span>
          </label>

          <Button type="submit" variant="gold" className="w-full justify-center">
            Отправить проект на рассмотрение (+75 XP)
          </Button>
        </form>
      </Modal>

      {/* МОДАЛКА ОЦЕНКИ ПРОЕКТА ДЛЯ ЖЮРИ */}
      <Modal
        isOpen={Boolean(selectedProj)}
        onClose={() => setSelectedProj(null)}
        title={`Экспертный лист Жюри: ${selectedProj?.title || ''}`}
      >
        <div className="space-y-4 text-xs">
          {[
            { key: 'science', label: '1. Научно-техническая новизна (Вес 30%) — от 1 до 10' },
            { key: 'relevance', label: '2. Актуальность для промыслов ХМАО (Вес 25%) — от 1 до 10' },
            { key: 'feasibility', label: '3. Экономическая и инженерная реализуемость (Вес 25%) — от 1 до 10' },
            { key: 'pitch', label: '4. Качество презентации и ответов (Вес 20%) — от 1 до 10' }
          ].map((crit) => (
            <div key={crit.key} className="flex items-center justify-between gap-2">
              <span className="text-zinc-300">{crit.label}</span>
              <input
                type="number"
                min="1"
                max="10"
                value={scores[crit.key]}
                onChange={(e) => setScores({ ...scores, [crit.key]: e.target.value })}
                className="w-16 bg-[#050810] border border-white/20 rounded px-2 py-1 text-center font-mono text-white"
              />
            </div>
          ))}

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
              Итоговое решение эксперта
            </label>
            <select
              value={scores.decision}
              onChange={(e) => setScores({ ...scores, decision: e.target.value })}
              className="w-full bg-[#050810] border border-white/20 rounded p-2 text-xs text-white"
            >
              <option value="approved">✅ Поддержать и рекомендовать к внедрению</option>
              <option value="revision">🔄 Отправить на доработку с замечаниями</option>
            </select>
          </div>

          <textarea
            rows={3}
            value={scores.comment}
            onChange={(e) => setScores({ ...scores, comment: e.target.value })}
            placeholder="Экспертное заключение и рекомендации автору проекта..."
            className="w-full bg-[#050810] border border-white/15 rounded p-3 text-xs text-white"
          />

          <Button
            variant="gold"
            onClick={() => submitJuryReviewMutation.mutate(selectedProj)}
            className="w-full justify-center"
          >
            Утвердить экспертный протокол (+75 XP)
          </Button>
        </div>
      </Modal>
    </div>
  );
}