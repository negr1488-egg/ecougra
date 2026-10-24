import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import HmaoEcoMap from '../components/Map/HmaoEcoMap';
import { Card, Button, Input, Badge, Modal, Skeleton, useToast } from '../components/ui/DesignSystem';
import { EyeOff, Calendar, Video, FastForward } from 'lucide-react';

const PITCH_SIM_STEPS = [
  {
    step: 1,
    title: 'Шаг 1 из 4: Назовите проблему',
    hint: 'О чём расскажешь жюри в первую минуту?',
    fact: 'Члены жюри оценивают актуальность проблемы с весом 25% от общего балла.',
    options: [
      { label: '🎯 Чётко назвать экологическую проблему Югры и привести цифры потерь', ok: true, msg: '✅ Верно! Конкретные цифры сразу привлекают внимание комиссии.' },
      { label: '📜 Читать длинную историческую справку 10 минут', ok: false, msg: '❌ Неверно. Время защиты ограничено — сразу переходите к сути.' }
    ]
  },
  {
    step: 2,
    title: 'Шаг 2 из 4: Предложите инженерное решение',
    hint: 'Как именно ваш проект решает проблему?',
    fact: 'Научность и технологическая новизна дают до 30% итоговой оценки.',
    options: [
      { label: '⚙️ Показать схему установки / биопрепарата и принцип его работы', ok: true, msg: '✅ Верно! Наглядная схема доказывает, что проект реален.' },
      { label: '🤷 Сказать «нужно просто беречь природу» без конкретики', ok: false, msg: '❌ Неверно. Жюри ждёт конкретное техническое или цифровое решение.' }
    ]
  },
  {
    step: 3,
    title: 'Шаг 3 из 4: Покажите измеримый результат (KPI)',
    hint: 'Какую пользу получит месторождение или регион?',
    fact: 'Реализуемость и экономический эффект — ключевой критерий для внедрения.',
    options: [
      { label: '📉 Назвать точный эффект: например, -35% выбросов CO₂ и окупаемость за 2 года', ok: true, msg: '✅ Верно! Измеримый результат убеждает экспертов нефтяных компаний.' },
      { label: '💭 Сказать, что результат посчитаем когда-нибудь потом', ok: false, msg: '❌ Неверно. Без расчёта эффекта проект не получит высокий балл.' }
    ]
  },
  {
    step: 4,
    title: 'Шаг 4 из 4: Ответы на вопросы комиссии',
    hint: 'Как отвечать на сложный вопрос эксперта жюри?',
    fact: 'Уверенная защита добавляет +120 XP в ваш профиль.',
    options: [
      { label: '🤝 Поблагодарить за вопрос и опереться на данные своих расчётов и ГОСТ', ok: true, msg: '✅ Блестяще! Вы полностью готовы к реальной защите проекта!' },
      { label: '😠 Начать спорить с экспертом жюри', ok: false, msg: '❌ Неверно. Аргументированный диалог ценится гораздо выше.' }
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
    impact_metric: '-30% CO₂',
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
    queryKey: ['projects_defense_v4'],
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
      if (!user?.id) throw new Error('Пожалуйста, авторизуйтесь заново');

      const payload = {
        title: projForm.title.trim(),
        description: projForm.description.trim(),
        impact_metric: projForm.impact_metric,
        status: projForm.status,
        author_id: user.id
      };

      if (projForm.blind_mode !== undefined) payload.blind_mode = projForm.blind_mode;
      if (projForm.pitch_at) payload.pitch_at = projForm.pitch_at;
      if (projForm.call_link) payload.call_link = projForm.call_link.trim();

      const { error } = await supabase.from('projects').insert([payload]);
      if (error) throw error;

      await supabase.rpc('award_xp_secure', {
        p_action: 'project_created',
        p_entity: 'project',
        p_xp_delta: 75,
        p_badge: 'Автор эко-проекта'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects_defense_v4'] });
      setCreateOpen(false);
      setProjForm({
        title: '',
        description: '',
        impact_metric: '-30% CO₂',
        status: 'submitted',
        blind_mode: false,
        pitch_at: '',
        call_link: ''
      });
      toast('Проект успешно подан на защиту! (+75 XP)', 'success');
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
      queryClient.invalidateQueries({ queryKey: ['projects_defense_v4'] });
      setSelectedProj(null);
      toast('Экспертная оценка сохранена!', 'success');
    },
    onError: (err) => toast(err.message, 'error')
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="eyebrow">Проектный контур и ГИС ХМАО</div>
          <h1 className="text-3xl font-extralight text-white">
            Защита проектов и <strong className="font-semibold text-[#00C853]">Карта Югры</strong>
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-2 font-mono text-xs uppercase border ${
              tab === 'projects' ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399]' : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            01 / Защита проектов ({projects.length})
          </button>
          <button
            onClick={() => setTab('pitch_sim')}
            className={`px-4 py-2 font-mono text-xs uppercase border ${
              tab === 'pitch_sim' ? 'border-[#FFAA00] bg-[#FFAA00]/15 text-[#FFAA00]' : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            02 / Симулятор защиты (4 шага)
          </button>
          <button
            onClick={() => setTab('map')}
            className={`px-4 py-2 font-mono text-xs uppercase border ${
              tab === 'map' ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]' : 'border-white/10 text-[#8A93A6]'
            }`}
          >
            03 / Яндекс.Карта ХМАО
          </button>
        </div>
      </div>

      {tab === 'projects' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-xs text-[#8A93A6]">
              Этапы: <span className="font-mono text-white">draft → submitted → scheduled → defended → approved</span>
            </p>
            <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)}>
              + Подать проект на защиту
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => {
              const hideAuthor = p.blind_mode && p.status !== 'approved' && p.status !== 'defended';
              return (
                <Card key={p.id} className="p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge color="gold">Статус: {p.status.toUpperCase()}</Badge>
                      {p.blind_mode && (
                        <Badge color="purple">
                          <EyeOff size={11} /> Слепая защита
                        </Badge>
                      )}
                      <Badge color="emerald">KPI: {p.impact_metric}</Badge>
                    </div>

                    <h3 className="text-lg font-medium text-white">{p.title}</h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">{p.description}</p>

                    {p.pitch_at && (
                      <div className="p-2.5 bg-[#050810] border border-white/10 font-mono text-[11px] text-[#22D3EE] flex items-center justify-between">
                        <span>
                          <Calendar size={12} className="inline mr-1" />
                          Защита: {new Date(p.pitch_at).toLocaleString()}
                        </span>
                        {p.call_link && (
                          <a href={p.call_link} target="_blank" rel="noreferrer" className="underline flex items-center gap-1">
                            <Video size={12} /> Созвон
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8A93A6]">
                      Автор: <strong className="text-white">{hideAuthor ? '🔒 Скрыт (Слепая защита)' : p.authorProfile?.username || '@researcher'}</strong>
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

      {tab === 'pitch_sim' && (
        <Card className="p-8 max-w-2xl mx-auto space-y-6">
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
              <FastForward size={12} /> Пропустить
            </button>
          </div>

          <h2 className="text-xl font-medium text-white">{PITCH_SIM_STEPS[simStep].hint}</h2>

          <div className="space-y-3">
            {PITCH_SIM_STEPS[simStep].options.map((o, i) => (
              <button
                key={i}
                onClick={() => setSimFeedback(o)}
                className="w-full min-h-[56px] p-4 border border-white/15 bg-[#050810] hover:border-[#FFAA00] text-left text-sm text-white"
              >
                {o.label}
              </button>
            ))}
          </div>

          {simFeedback && (
            <div className="space-y-4">
              <div className={`p-4 border text-sm ${simFeedback.ok ? 'border-[#00C853] text-[#34D399]' : 'border-red-500 text-red-300'}`}>
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
                      toast('Вы успешно защитили проект перед виртуальным жюри! +120 XP', 'success');
                    }
                  }}
                >
                  {simStep < PITCH_SIM_STEPS.length - 1 ? 'Следующий шаг →' : 'Завершить защиту (+120 XP)'}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === 'map' && <HmaoEcoMap />}

      {/* Модалка подачи проекта */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Подать проект на защиту">
        <form onSubmit={(e) => createProjectMutation.mutate(e)} className="space-y-4">
          <Input label="Название проекта" value={projForm.title} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} required />
          <Input label="Целевой эффект (KPI)" value={projForm.impact_metric} onChange={(e) => setProjForm({ ...projForm, impact_metric: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Дата и время защиты"
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
          <textarea
            rows={3}
            value={projForm.description}
            onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
            placeholder="Описание проблемы, решения и расчётов..."
            className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white"
            required
          />
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={projForm.blind_mode}
              onChange={(e) => setProjForm({ ...projForm, blind_mode: e.target.checked })}
              className="accent-[#FFAA00]"
            />
            <span>🕶️ Включить режим «Слепой защиты» (жюри не видит автора до оглашения)</span>
          </label>
          <Button type="submit" variant="gold" className="w-full">Отправить проект (+75 XP)</Button>
        </form>
      </Modal>

      {/* Модалка оценки жюри */}
      <Modal isOpen={Boolean(selectedProj)} onClose={() => setSelectedProj(null)} title={`Оценка жюри: ${selectedProj?.title}`}>
        <div className="space-y-4 text-xs">
          {[
            { key: 'science', label: 'Научность (Вес 30%) — от 1 до 10' },
            { key: 'relevance', label: 'Актуальность для ХМАО (Вес 25%) — от 1 до 10' },
            { key: 'feasibility', label: 'Реализуемость (Вес 25%) — от 1 до 10' },
            { key: 'pitch', label: 'Качество защиты (Вес 20%) — от 1 до 10' }
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
            placeholder="Экспертное заключение и рекомендации..."
            className="w-full bg-[#050810] border border-white/10 p-3 text-xs text-white"
          />
          <Button onClick={() => submitJuryReviewMutation.mutate(selectedProj)} className="w-full">
            Утвердить оценку и перевести в статус Defended
          </Button>
        </div>
      </Modal>
    </div>
  );
}