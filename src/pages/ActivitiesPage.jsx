import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import HmaoEcoMap from '../components/Map/HmaoEcoMap';
import { Card, Button, Input, Badge, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import { EyeOff, Calendar, Video, FastForward, Award, Shield, FileCheck, FolderPlus } from 'lucide-react';

const STATUS_RU = {
  draft: { label: 'Черновик', color: 'zinc' },
  submitted: { label: 'На рассмотрении комиссии', color: 'gold' },
  scheduled: { label: 'Назначена дата защиты', color: 'cyan' },
  defended: { label: 'Защищён перед комиссией', color: 'emerald' },
  approved: { label: 'Одобрен и внедрён', color: 'emerald' },
  revision: { label: 'Требуется доработка', color: 'red' },
  rejected: { label: 'Отклонён', color: 'red' },
  active: { label: 'Активный', color: 'cyan' },
  completed: { label: 'Завершён', color: 'emerald' }
};

const PITCH_SIM_STEPS = [
  {
    step: 1,
    title: 'Шаг 1 из 4: Формулировка проблемы',
    hint: 'О чём рассказать экспертной комиссии в первую минуту выступления?',
    fact: 'Экспертная комиссия жюри оценивает актуальность проблемы с весом 25% от итогового балла.',
    options: [
      { label: '🎯 Назвать конкретную экологическую проблему региона и подкрепить цифрами потерь', ok: true, msg: '✅ Верно! Конкретные метрики сразу привлекают внимание экспертов.' },
      { label: '📜 Читать длинную историческую справку о месторождении на 10 минут', ok: false, msg: '❌ Неверно. Регламент защиты строгий — сразу переходите к сути.' }
    ]
  },
  {
    step: 2,
    title: 'Шаг 2 из 4: Инженерно-технологическое решение',
    hint: 'Как именно ваша разработка устраняет проблему?',
    fact: 'Научная новизна и технологическая реализуемость приносят до 30% суммарного балла.',
    options: [
      { label: '⚙️ Показать схему установки/биопрепарата и пошаговый принцип работы', ok: true, msg: '✅ Верно! Наглядная инженерная схема доказывает зрелость проекта.' },
      { label: '🤷 Ограничиться общими словами «нужно беречь природу» без чертежей', ok: false, msg: '❌ Неверно. Жюри ждёт инженерное или цифровое решение.' }
    ]
  },
  {
    step: 3,
    title: 'Шаг 3 из 4: Измеримый эффект (Целевые показатели)',
    hint: 'Какую измеримую пользу получит недропользователь или округ?',
    fact: 'Экономическая обоснованность — ключевой фактор для получения гранта и внедрения.',
    options: [
      { label: '📉 Привести точный эффект: снижение выбросов CO₂ на 35% и окупаемость за 2 года', ok: true, msg: '✅ Верно! Измеримые показатели убеждают представителей нефтяных компаний.' },
      { label: '💭 Сказать, что расчёты будут выполнены когда-нибудь позже', ok: false, msg: '❌ Неверно. Без доказанного эффекта проект отправляется на доработку.' }
    ]
  },
  {
    step: 4,
    title: 'Шаг 4 из 4: Ответы на вопросы экспертов',
    hint: 'Как грамотно аргументировать свою позицию при каверзном вопросе жюри?',
    fact: 'Уверенная защита и владение ГОСТами добавляют +120 баллов опыта (XP).',
    options: [
      { label: '🤝 Поблагодарить эксперта и ответить, опираясь на свои расчёты и нормативную базу', ok: true, msg: '✅ Превосходно! Вы полностью готовы к реальной защите проекта!' },
      { label: '😠 Вступить в агрессивный спор с членами комиссии', ok: false, msg: '❌ Неверно. Аргументированный научный диалог ценится гораздо выше.' }
    ]
  }
];

export default function ActivitiesPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('projects');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProj, setSelectedProj] = useState(null);

  const [projForm, setProjForm] = useState({
    title: '',
    description: '',
    impact_metric: 'Снижение выбросов CO₂ на 30%',
    status: 'submitted',
    blind_mode: false,
    pitch_at: '',
    call_link: ''
  });

  const [scores, setScores] = useState({ science: 9, relevance: 9, feasibility: 8, pitch: 9, comment: '' });
  const [simStep, setSimStep] = useState(0);
  const [simFeedback, setSimFeedback] = useState(null);

  const isJuryOrAdmin = hasRole(['jury', 'admin', 'dev']);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects_defense_v5'],
    queryFn: async () => {
      const { data: projs } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      const { data: revs } = await supabase.from('project_reviews').select('*');
      const { data: profs } = await supabase.from('profiles').select('id, username, full_name');

      const profMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      return (projs || []).map((pr) => {
        const prReviews = (revs || []).filter((r) => r.project_id === pr.id);
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
          reviews: prReviews,
          avgWeighted
        };
      });
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: async (e) => {
      e.preventDefault();
      if (!user?.id) throw new Error('Пожалуйста, выполните вход');

      const payload = {
        title: projForm.title.trim(),
        description: projForm.description.trim(),
        impact_metric: projForm.impact_metric,
        status: 'submitted',
        author_id: user.id,
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
      queryClient.invalidateQueries({ queryKey: ['projects_defense_v5'] });
      setCreateOpen(false);
      setProjForm({
        title: '',
        description: '',
        impact_metric: 'Снижение выбросов CO₂ на 30%',
        status: 'submitted',
        blind_mode: false,
        pitch_at: '',
        call_link: ''
      });
      toast('Проект успешно подан на рассмотрение комиссии! (+75 XP)', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

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
          decision: 'approved'
        }
      ]);
      if (error) throw error;

      await supabase.from('projects').update({ status: 'defended' }).eq('id', proj.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects_defense_v5'] });
      setSelectedProj(null);
      toast('Оценка жюри утверждена!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-8">
      {/* Шапка раздела */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="eyebrow">Мастерская инженерных инициатив «Зелёный след»</div>
          <h1 className="text-3xl font-light text-white mt-1">
            Защита проектов и <strong className="font-semibold text-[#00C853]">Геокарта ХМАО</strong>
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'projects'
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399] font-bold shadow-[0_0_12px_rgba(0,200,83,0.2)]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            01 / Витрина проектов ({projects.length})
          </button>
          <button
            onClick={() => setTab('pitch_sim')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'pitch_sim'
                ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            02 / Тренажёр защиты (4 шага)
          </button>
          <button
            onClick={() => setTab('map')}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              tab === 'map'
                ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] font-bold'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            03 / Яндекс.Карта ХМАО
          </button>
        </div>
      </div>

      {/* ТАБ 1: ПРОЕКТЫ */}
      {tab === 'projects' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-white/10 bg-[#060a14]/60">
            <div className="text-xs text-zinc-300">
              Статусы регламента: <span className="text-[#FFAA00] font-mono">На рассмотрении комиссии → Назначена дата защиты → Защищён успешно → Одобрен</span>
            </div>
            <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
              <FolderPlus size={14} /> Подать проект на защиту
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map((p) => {
              const hideAuthor = p.blind_mode && p.status !== 'approved' && p.status !== 'defended';
              const st = STATUS_RU[p.status] || { label: p.status, color: 'zinc' };

              return (
                <Card key={p.id} className="p-6 flex flex-col justify-between space-y-4 border-white/10 bg-[#060a14]/90 hover:border-[#00C853]/50 transition-all shadow-xl">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge color={st.color}>
                        Статус: {st.label}
                      </Badge>
                      {p.blind_mode && (
                        <Badge color="purple">
                          <EyeOff size={11} className="mr-1" /> Режим «Слепой защиты»
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-lg font-medium text-white">{p.title}</h3>
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{p.description}</p>

                    <div className="p-3 bg-[#050810] border border-white/10 space-y-1.5">
                      <div className="text-[11px] font-mono text-[#34D399]">
                        Целевой эффект разработки: <strong>{p.impact_metric}</strong>
                      </div>
                      {p.pitch_at && (
                        <div className="font-mono text-[11px] text-[#22D3EE] flex items-center justify-between pt-1 border-t border-white/5">
                          <span>
                            <Calendar size={12} className="inline mr-1" />
                            Защита: {new Date(p.pitch_at).toLocaleString()}
                          </span>
                          {p.call_link && (
                            <a href={p.call_link} target="_blank" rel="noreferrer" className="underline flex items-center gap-1 hover:text-white">
                              <Video size={12} /> Созвон
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8A93A6]">
                      Автор: <strong className="text-white">{hideAuthor ? '🔒 Скрыт до оглашения оценки' : p.authorProfile?.username || '@исследователь'}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      {p.avgWeighted && <Badge color="emerald">Балл жюри: {p.avgWeighted} / 100</Badge>}
                      {isJuryOrAdmin && (
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

      {/* ТАБ 2: ТРЕНАЖЁР */}
      {tab === 'pitch_sim' && (
        <Card className="p-8 max-w-2xl mx-auto space-y-6 border-[#FFAA00]/40 bg-[#060a14]/90 shadow-2xl">
          <div className="flex items-center justify-between">
            <Badge color="gold">{PITCH_SIM_STEPS[simStep].title}</Badge>
            <button
              onClick={() => {
                setSimStep(0);
                setSimFeedback(null);
                toast('Тренажёр пройден! +120 XP', 'success');
              }}
              className="font-mono text-[10px] uppercase text-[#8A93A6] hover:text-white flex items-center gap-1"
            >
              <FastForward size={12} /> Пропустить
            </button>
          </div>

          <h2 className="text-xl font-medium text-white">{PITCH_SIM_STEPS[simStep].hint}</h2>

          <div className="space-y-3">
            {PITCH_SIM_STEPS[simStep].options.map((o, i) => (
              <button
                key={i}
                onClick={() => setSimFeedback(o)}
                className="w-full min-h-[56px] p-4 border border-white/15 bg-[#050810] hover:border-[#FFAA00] text-left text-sm text-white transition-all"
              >
                {o.label}
              </button>
            ))}
          </div>

          {simFeedback && (
            <div className="space-y-4">
              <div className={`p-4 border text-sm ${simFeedback.ok ? 'border-[#00C853] text-[#34D399] bg-[#00C853]/10' : 'border-red-500 text-red-300 bg-red-500/10'}`}>
                {simFeedback.msg}
              </div>
              <div className="p-3 bg-[#FFAA00]/10 border border-[#FFAA00]/30 text-xs text-zinc-200">
                💡 <strong className="text-[#FFAA00]">Знаете ли вы?</strong> {PITCH_SIM_STEPS[simStep].fact}
              </div>
              {simFeedback.ok && (
                <Button
                  variant="gold"
                  className="w-full"
                  onClick={() => {
                    if (simStep < PITCH_SIM_STEPS.length - 1) {
                      setSimStep((s) => s + 1);
                      setSimFeedback(null);
                    } else {
                      setSimStep(0);
                      setSimFeedback(null);
                      toast('Вы успешно прошли тренажёр защиты перед виртуальным жюри! +120 XP', 'success');
                    }
                  }}
                >
                  {simStep < PITCH_SIM_STEPS.length - 1 ? 'Следующий шаг выступления →' : 'Завершить защиту проекта (+120 XP)'}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === 'map' && <HmaoEcoMap />}

      {/* Модальное окно подачи проекта */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Подать проект на защиту">
        <form onSubmit={(e) => createProjectMutation.mutate(e)} className="space-y-4">
          <Input
            label="Название проекта / разработки"
            placeholder="Например: Цифровая экосистема «Югра.Нефть»"
            value={projForm.title}
            onChange={(e) => setProjForm({ ...projForm, title: e.target.value })}
            required
          />
          <Input
            label="Целевой измеримый эффект"
            placeholder="Например: Снижение выбросов парниковых газов на 30%"
            value={projForm.impact_metric}
            onChange={(e) => setProjForm({ ...projForm, impact_metric: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Желаемая дата защиты"
              type="datetime-local"
              value={projForm.pitch_at}
              onChange={(e) => setProjForm({ ...projForm, pitch_at: e.target.value })}
            />
            <Input
              label="Ссылка на видеоконференцию (созвон)"
              placeholder="https://telemost.yandex.ru/..."
              value={projForm.call_link}
              onChange={(e) => setProjForm({ ...projForm, call_link: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#8A93A6] mb-1">
              Краткое описание разработки и план реализации
            </label>
            <textarea
              rows={4}
              value={projForm.description}
              onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
              placeholder="Опишите суть инновации, проблему в ХМАО и ожидаемые результаты..."
              className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={projForm.blind_mode}
              onChange={(e) => setProjForm({ ...projForm, blind_mode: e.target.checked })}
              className="accent-[#FFAA00]"
            />
            <span>🕶️ Включить режим «Слепой защиты» (жюри не видит автора проекта до оглашения баллов)</span>
          </label>
          <Button type="submit" variant="gold" className="w-full">Отправить проект на рассмотрение (+75 XP)</Button>
        </form>
      </Modal>

      {/* Оценка эксперта жюри */}
      <Modal isOpen={Boolean(selectedProj)} onClose={() => setSelectedProj(null)} title={`Экспертная оценка: ${selectedProj?.title}`}>
        <div className="space-y-4 text-xs">
          {[
            { key: 'science', label: 'Научность и обоснованность (Вес 30%) — от 1 до 10' },
            { key: 'relevance', label: 'Актуальность для региона ХМАО (Вес 25%) — от 1 до 10' },
            { key: 'feasibility', label: 'Практическая реализуемость (Вес 25%) — от 1 до 10' },
            { key: 'pitch', label: 'Качество доклада и защиты (Вес 20%) — от 1 до 10' }
          ].map((crit) => (
            <div key={crit.key} className="flex items-center justify-between">
              <span className="text-zinc-300">{crit.label}</span>
              <input
                type="number"
                min="1"
                max="10"
                value={scores[crit.key]}
                onChange={(e) => setScores({ ...scores, [crit.key]: e.target.value })}
                className="w-16 bg-[#050810] border border-white/15 px-2 py-1 text-center font-mono text-white"
              />
            </div>
          ))}
          <textarea
            rows={3}
            value={scores.comment}
            onChange={(e) => setScores({ ...scores, comment: e.target.value })}
            placeholder="Заключение комиссии и рекомендации участнику..."
            className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white"
          />
          <Button onClick={() => submitJuryReviewMutation.mutate(selectedProj)} className="w-full">
            Утвердить оценку комиссии
          </Button>
        </div>
      </Modal>
    </div>
  );
}