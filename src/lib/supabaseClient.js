import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLiveSupabase = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

const STORAGE_KEYS = {
  ACTIVE_USER: 'zelenaya_yugra_active_user_v5',
  USERS_TABLE: 'zelenaya_yugra_users_v5',
  PROJECTS_TABLE: 'zelenaya_yugra_projects_v5',
  VOTES_TABLE: 'zelenaya_yugra_votes_v5',
  CHAT_TABLE: 'zelenaya_yugra_chat_v5',
  QA_TABLE: 'zelenaya_yugra_qa_v5',
  CO2_TABLE: 'zelenaya_yugra_co2_v5',
  TESTS_TABLE: 'zelenaya_yugra_tests_v5'
};

const getStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setStore = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(e);
  }
};

export const AVATAR_PRESETS = [
  { id: 'cyber-drop', name: 'Капля Югры', color: '#FFAA00', bg: '#191204', icon: '💧' },
  { id: 'cedar-guard', name: 'Кедр Севера', color: '#00C853', bg: '#04190e', icon: '🌲' },
  { id: 'iot-sensor', name: 'Сенсор ПДК', color: '#22D3EE', bg: '#04161c', icon: '📡' },
  { id: 'bio-moss', name: 'Био-Сфагнум', color: '#34D399', bg: '#051b14', icon: '🌿' },
  { id: 'arctic-owl', name: 'Полярная сова', color: '#A78BFA', bg: '#110b22', icon: '🦉' },
  { id: 'jury-star', name: 'Эксперт комиссии', color: '#FFC857', bg: '#1c1506', icon: '★' }
];

const INITIAL_USERS = [
  {
    id: 'eco-usr-1',
    username: '@pestrikov_kv',
    email: 'pestrikov@eco-ugra.ru',
    password: '123',
    full_name: 'Пестриков Кирилл Валерьевич',
    avatar_preset: 'cyber-drop',
    avatar_url: '',
    role: 'Автор проекта · 11А РН-класс',
    school: 'МБОУ «СОШ № 1» пгт. Пойковский',
    bio: 'Разработчик экологического модуля «Зелёная Югра», ГИС-карты ХМАО и системы телеметрии датчиков MQ-4 / MQ-7.',
    green_points: 360,
    tree_level: 4,
    votes_quota: 3,
    votes_used: 1,
    online_status: true,
    badges: ['Страж Тайги', 'Эксперт ПНГ', 'Архитектор Эко-БД']
  },
  {
    id: 'eco-usr-2',
    username: '@morozov_ap',
    email: 'morozov@eco-ugra.ru',
    password: '123',
    full_name: 'Морозов Антон Павлович',
    avatar_preset: 'cedar-guard',
    avatar_url: '',
    role: 'Автор проекта · 11А РН-класс',
    school: 'МБОУ «СОШ № 1» пгт. Пойковский',
    bio: 'Разработчик математической модели калькулятора CO₂, симулятора рекультивации почв и базы эко-квестов.',
    green_points: 340,
    tree_level: 4,
    votes_quota: 3,
    votes_used: 1,
    online_status: true,
    badges: ['Аудитор CO₂', 'Инженер рекультивации', 'Спикер защиты']
  },
  {
    id: 'eco-usr-3',
    username: '@rahmanov_av',
    email: 'raxmanov@cktex.ru',
    password: '123',
    full_name: 'Рахманов Александр Валерьевич',
    avatar_preset: 'jury-star',
    avatar_url: '',
    role: 'Научный руководитель · Председатель жюри',
    school: 'МБОУ «СОШ № 1» пгт. Пойковский',
    bio: 'Педагог дополнительного образования, научный руководитель проекта на форуме «Шаг в будущее».',
    green_points: 500,
    tree_level: 5,
    votes_quota: 3,
    votes_used: 0,
    online_status: true,
    badges: ['Научный руководитель', 'Председатель жюри', 'Эксперт ХМАО']
  },
  {
    id: 'eco-usr-4',
    username: '@eco_surgut',
    email: 'ecolicey@surgut.ru',
    password: '123',
    full_name: 'Соколова Анна (Лицей г. Сургут)',
    avatar_preset: 'bio-moss',
    avatar_url: '',
    role: 'Координатор волонтёров Югры',
    school: 'Сургутский естественно-научный лицей',
    bio: 'Участник полевых экспедиций по высадке кедра и мониторингу верховых болот.',
    green_points: 220,
    tree_level: 3,
    votes_quota: 3,
    votes_used: 1,
    online_status: true,
    badges: ['Эко-волонтёр Югры']
  }
];

const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    author_id: 'eco-usr-1',
    author_username: '@pestrikov_kv',
    author_name: 'Пестриков Кирилл · СОШ №1 пгт. Пойковский',
    author_avatar: 'cyber-drop',
    title: 'Сфагновый биосорбент с иммобилизованными бактериями Rhodococcus',
    category: 'reclamation',
    problem_statement: 'Медленное разложение углеводородов в таёжных почвах при низких температурах Севера (+4...+8 °C).',
    description: 'Биоразлагаемые маты из верхового мха ХМАО с психротолерантными бактериями-нефтедеструкторами. Впитывают до 9 кг нефти на 1 кг сорбента и ускоряют рекультивацию в 4 раза.',
    impact_metric: '-85% времени распада УВ',
    votes_count: 14,
    voter_usernames: ['@morozov_ap', '@eco_surgut'],
    defense_status: 'live',
    jury_novelty: 10,
    jury_eco: 10,
    jury_tech: 9,
    jury_economy: 9,
    jury_pitch: 10,
    slides: [
      { title: 'Слайд 1: Проблема нефтезагрязнений в ХМАО', content: 'При низких температурах обычные биопрепараты теряют активность. Требуется носитель из местного торфяного мха Sphagnum.' },
      { title: 'Слайд 2: Технология иммобилизации штаммов', content: 'Клетки бактерий Rhodococcus закрепляются в порах сфагнума. Сорбент удерживает нефть на плаву и не тонет в болотной воде.' },
      { title: 'Слайд 3: Результаты полевых испытаний', content: 'Через 45 суток степень биодеструкции достигает 96.4%, после чего биомат сам превращается в питательный торф для саженцев кедра.' }
    ]
  },
  {
    id: 'proj-2',
    author_id: 'eco-usr-2',
    author_username: '@morozov_ap',
    author_name: 'Морозов Антон · СОШ №1 пгт. Пойковский',
    author_avatar: 'cedar-guard',
    title: 'Интеллектуальный диспетчер утилизации ПНГ с микротурбинной когенерацией',
    category: 'apg_processing',
    problem_statement: 'Сверхлимитное сжигание попутного нефтяного газа на факелах при пиковых нагрузках сепарации.',
    description: 'Система автоматического перенаправления избытков ПНГ на модульные газотурбинные установки (ГТУ) и контур закачки в пласт, удерживающая полезное использование газа выше 98.5%.',
    impact_metric: '98.5% утилизации ПНГ',
    votes_count: 11,
    voter_usernames: ['@pestrikov_kv'],
    defense_status: 'waiting',
    jury_novelty: 9,
    jury_eco: 10,
    jury_tech: 10,
    jury_economy: 10,
    jury_pitch: 9,
    slides: [
      { title: 'Слайд 1: Целевой норматив 95% ПНГ', content: 'Факельное сжигание ведёт к потере ценного химического сырья и кратным штрафам за выбросы парниковых газов Scope 1.' },
      { title: 'Слайд 2: Схема когенерации на кусте', content: 'Выработка собственной электроэнергии и тепла для подогрева нефтесборных коллекторов зимой без дизельных котельных.' }
    ]
  },
  {
    id: 'proj-3',
    author_id: 'eco-usr-4',
    author_username: '@eco_surgut',
    author_name: 'Соколова Анна · Естественно-научный лицей',
    author_avatar: 'bio-moss',
    title: 'Автономная сеть фито-мониторинга приживаемости саженцев сибирского кедра',
    category: 'biodiversity',
    problem_statement: 'Отсутствие контроля влажности и кислотности pH торфосмесей в первые 2 года после посадки леса.',
    description: 'Датчики влажности и кислотности почвы на солнечном питании, передающие индекс здоровья высаженных сеянцев кедра через LoRa-ретрансляторы.',
    impact_metric: '96% приживаемость кедра',
    votes_count: 9,
    voter_usernames: [],
    defense_status: 'completed',
    jury_novelty: 9,
    jury_eco: 10,
    jury_tech: 8,
    jury_economy: 9,
    jury_pitch: 9,
    slides: [
      { title: 'Слайд 1: Принцип гектар за гектар', content: 'Мониторинг лесокультурных площадей ХМАО с помощью наземных IoT-щупов и мультиспектральных снимков Sentinel-2 (NDVI).' }
    ]
  }
];

const INITIAL_VOTES = [
  { id: 'v-1', user_id: 'eco-usr-1', username: '@pestrikov_kv', project_id: 'proj-2' },
  { id: 'v-2', user_id: 'eco-usr-2', username: '@morozov_ap', project_id: 'proj-1' }
];

const INITIAL_CHAT = [
  {
    id: 'm-1',
    sender_username: '@rahmanov_av',
    sender_name: 'Рахманов Александр Валерьевич',
    sender_avatar: 'jury-star',
    sender_role: 'Научный руководитель',
    channel: 'general',
    recipient_username: null,
    message_text: 'Приветствую в автономной базе «Зелёная Югра»! Обратите внимание: у каждого участника ровно 3 голоса для поддержки лучших эко-проектов.',
    created_at: '14:10'
  },
  {
    id: 'm-2',
    sender_username: '@pestrikov_kv',
    sender_name: 'Пестриков Кирилл',
    sender_avatar: 'cyber-drop',
    sender_role: 'Автор проекта · 11А РН',
    channel: 'general',
    recipient_username: null,
    message_text: '@morozov_ap я отдал один из своих 3 голосов за твой проект по когенерации ПНГ! Сейчас загружаю слайды в Платформу защиты.',
    created_at: '14:14'
  },
  {
    id: 'm-3',
    sender_username: '@morozov_ap',
    sender_name: 'Морозов Антон',
    sender_avatar: 'cedar-guard',
    sender_role: 'Автор проекта · 11А РН',
    channel: 'general',
    recipient_username: null,
    message_text: 'Принято, @pestrikov_kv! Графики в калькуляторе CO₂ и телеметрии MQ-4/MQ-7 теперь зафиксированы по высоте и работают идеально.',
    created_at: '14:17'
  }
];

export const supabase = isLiveSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      channel: () => ({ on: function () { return this; }, subscribe: function () { return this; } }),
      removeChannel: () => {}
    };

export const api = {
  isMock: !isLiveSupabase,

  getAllUsers: () => getStore(STORAGE_KEYS.USERS_TABLE, INITIAL_USERS),

  auth: {
    getUser: async () => {
      let current = getStore(STORAGE_KEYS.ACTIVE_USER, null);
      const users = getStore(STORAGE_KEYS.USERS_TABLE, INITIAL_USERS);
      if (!current) {
        current = users[0];
        setStore(STORAGE_KEYS.ACTIVE_USER, current);
      } else {
        const fresh = users.find((u) => u.id === current.id || u.username === current.username);
        if (fresh) current = fresh;
      }
      return { user: current };
    },

    signIn: async (identifier, password) => {
      const users = getStore(STORAGE_KEYS.USERS_TABLE, INITIAL_USERS);
      const clean = identifier.trim().toLowerCase();
      const found = users.find(
        (u) =>
          u.email.toLowerCase() === clean ||
          u.username.toLowerCase() === clean ||
          u.username.toLowerCase() === '@' + clean
      );
      if (found) {
        setStore(STORAGE_KEYS.ACTIVE_USER, found);
        return { user: found };
      }
      throw new Error('Пользователь с таким Email или @username не найден в базе «Зелёная Югра»');
    },

    signUp: async ({ username, email, password, fullName, school, role, avatarPreset, bio }) => {
      const users = getStore(STORAGE_KEYS.USERS_TABLE, INITIAL_USERS);
      const formattedUsername = username.startsWith('@')
        ? username.toLowerCase().replace(/\s+/g, '_')
        : '@' + username.toLowerCase().replace(/\s+/g, '_');

      if (users.some((u) => u.username.toLowerCase() === formattedUsername)) {
        throw new Error(`Никнейм ${formattedUsername} уже занят в базе данных`);
      }

      const newUser = {
        id: 'eco-usr-' + Date.now(),
        username: formattedUsername,
        email,
        password,
        full_name: fullName || 'Исследователь Югры',
        avatar_preset: avatarPreset || 'cyber-drop',
        avatar_url: '',
        role: role || 'Ученик Роснефть-класса',
        school: school || 'МБОУ «СОШ № 1» пгт. Пойковский',
        bio: bio || 'Исследователь экологии нефтедобычи ХМАО-Югры.',
        green_points: 100,
        tree_level: 2,
        votes_quota: 3,
        votes_used: 0,
        online_status: true,
        badges: ['Участник Зелёной Югры']
      };

      users.push(newUser);
      setStore(STORAGE_KEYS.USERS_TABLE, users);
      setStore(STORAGE_KEYS.ACTIVE_USER, newUser);
      return { user: newUser };
    },

    updateProfile: async (patch) => {
      const current = getStore(STORAGE_KEYS.ACTIVE_USER, INITIAL_USERS[0]);
      if (patch.username && !patch.username.startsWith('@')) {
        patch.username = '@' + patch.username.replace(/\s+/g, '_');
      }
      const updated = { ...current, ...patch };
      setStore(STORAGE_KEYS.ACTIVE_USER, updated);
      const users = getStore(STORAGE_KEYS.USERS_TABLE, INITIAL_USERS).map((u) =>
        u.id === updated.id ? updated : u
      );
      setStore(STORAGE_KEYS.USERS_TABLE, users);
      return updated;
    },

    signOut: async () => {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    }
  },

  addRewards: async (xp = 0, badge = null) => {
    const current = getStore(STORAGE_KEYS.ACTIVE_USER, INITIAL_USERS[0]);
    if (!current) return null;
    const green_points = (current.green_points || 0) + xp;
    const tree_level = Math.min(5, 1 + Math.floor(green_points / 100));
    const badges = [...(current.badges || [])];
    if (badge && !badges.includes(badge)) badges.push(badge);

    return api.auth.updateProfile({ green_points, tree_level, badges });
  },

  // ПРОЕКТЫ И СТРОГАЯ КВОТА ГОЛОСОВ (3 ГОЛОСА НА АККАУНТ)
  getProjects: async () => getStore(STORAGE_KEYS.PROJECTS_TABLE, INITIAL_PROJECTS),

  getUserVotedProjectIds: (userId) => {
    const votes = getStore(STORAGE_KEYS.VOTES_TABLE, INITIAL_VOTES);
    return votes.filter((v) => v.user_id === userId).map((v) => v.project_id);
  },

  toggleProjectVote: async (projectId) => {
    const { user } = await api.auth.getUser();
    if (!user) throw new Error('Авторизуйтесь для голосования');

    const votes = getStore(STORAGE_KEYS.VOTES_TABLE, INITIAL_VOTES);
    const projects = getStore(STORAGE_KEYS.PROJECTS_TABLE, INITIAL_PROJECTS);
    const existingVoteIdx = votes.findIndex((v) => v.user_id === user.id && v.project_id === projectId);

    // Если голос уже стоит — отзываем голос и возвращаем 1 слот в квоту
    if (existingVoteIdx !== -1) {
      votes.splice(existingVoteIdx, 1);
      setStore(STORAGE_KEYS.VOTES_TABLE, votes);

      const updatedProjects = projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          votes_count: Math.max(0, (p.votes_count || 1) - 1),
          voter_usernames: (p.voter_usernames || []).filter((u) => u !== user.username)
        };
      });
      setStore(STORAGE_KEYS.PROJECTS_TABLE, updatedProjects);

      const userVotesCount = votes.filter((v) => v.user_id === user.id).length;
      const updatedUser = await api.auth.updateProfile({ votes_used: userVotesCount });
      return { projects: updatedProjects, user: updatedUser, action: 'removed' };
    }

    // Проверка лимита (максимум 3 голоса!)
    const userVotesCount = votes.filter((v) => v.user_id === user.id).length;
    const quota = user.votes_quota || 3;
    if (userVotesCount >= quota) {
      throw new Error(`Лимит исчерпан: вы уже использовали все ${quota} из ${quota} голосов! Отзовите голос с другого проекта, чтобы переголосовать.`);
    }

    // Записываем новый голос в БД
    votes.push({
      id: 'v-' + Date.now(),
      user_id: user.id,
      username: user.username,
      project_id: projectId,
      created_at: new Date().toISOString()
    });
    setStore(STORAGE_KEYS.VOTES_TABLE, votes);

    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      const voters = new Set(p.voter_usernames || []);
      voters.add(user.username);
      return {
        ...p,
        votes_count: (p.votes_count || 0) + 1,
        voter_usernames: Array.from(voters)
      };
    });
    setStore(STORAGE_KEYS.PROJECTS_TABLE, updatedProjects);

    const updatedUser = await api.auth.updateProfile({
      votes_used: userVotesCount + 1,
      green_points: (user.green_points || 0) + 15
    });

    return { projects: updatedProjects, user: updatedUser, action: 'added' };
  },

  createProject: async (payload) => {
    const { user } = await api.auth.getUser();
    const list = await api.getProjects();
    const newProj = {
      id: 'proj-' + Date.now(),
      author_id: user?.id || 'eco-usr-1',
      author_username: user?.username || '@pestrikov_kv',
      author_name: payload.author_name || user?.full_name,
      author_avatar: user?.avatar_preset || 'cyber-drop',
      title: payload.title,
      category: payload.category || 'reclamation',
      problem_statement: payload.problem_statement || 'Снижение техногенной нагрузки на биоценозы ХМАО.',
      description: payload.description,
      impact_metric: payload.impact_metric || '-25% CO₂',
      votes_count: 1,
      voter_usernames: [user?.username || '@pestrikov_kv'],
      defense_status: 'waiting',
      jury_novelty: 9,
      jury_eco: 10,
      jury_tech: 9,
      jury_economy: 9,
      jury_pitch: 9,
      slides: [
        { title: 'Слайд 1: Постановка проблемы', content: payload.problem_statement || payload.description },
        { title: 'Слайд 2: Инженерное решение и эффект', content: `Целевой показатель эффективности: ${payload.impact_metric || '-25% CO₂'}` }
      ],
      created_at: new Date().toISOString()
    };
    list.unshift(newProj);
    setStore(STORAGE_KEYS.PROJECTS_TABLE, list);
    await api.addRewards(75, 'Автор эко-инициативы');
    return list;
  },

  scoreProjectDefense: async (projectId, scores) => {
    const list = await api.getProjects();
    const updated = list.map((p) =>
      p.id === projectId ? { ...p, ...scores, defense_status: 'completed' } : p
    );
    setStore(STORAGE_KEYS.PROJECTS_TABLE, updated);
    await api.addRewards(50, 'Эксперт защиты проектов');
    return updated;
  },

  getDefenseQA: (projectId) => {
    const all = getStore(STORAGE_KEYS.QA_TABLE, [
      {
        id: 'qa-1',
        project_id: 'proj-1',
        asker_username: '@rahmanov_av',
        asker_name: 'Рахманов А. В.',
        question_text: 'Какова предельная нефтеёмкость сфагнового биомата при температуре +4 °C?',
        answer_text: 'До 9 кг углеводородов на 1 кг сухого мха без впитывания болотной воды.'
      }
    ]);
    return all.filter((q) => q.project_id === projectId);
  },

  addDefenseQA: async (projectId, questionText, answerText = '') => {
    const { user } = await api.auth.getUser();
    const all = getStore(STORAGE_KEYS.QA_TABLE, []);
    all.unshift({
      id: 'qa-' + Date.now(),
      project_id: projectId,
      asker_username: user?.username || '@guest',
      asker_name: user?.full_name || 'Участник комиссии',
      question_text: questionText,
      answer_text: answerText
    });
    setStore(STORAGE_KEYS.QA_TABLE, all);
    return all.filter((q) => q.project_id === projectId);
  },

  // ЧАТ ПО @USERNAME (ПУБЛИЧНЫЕ КАНАЛЫ И ЛИЧНЫЕ СООБЩЕНИЯ)
  getChatMessages: (channel = 'general', currentUsername = null, peerUsername = null) => {
    const all = getStore(STORAGE_KEYS.CHAT_TABLE, INITIAL_CHAT);
    if (channel === 'dm' && currentUsername && peerUsername) {
      return all.filter(
        (m) =>
          m.channel === 'dm' &&
          ((m.sender_username === currentUsername && m.recipient_username === peerUsername) ||
            (m.sender_username === peerUsername && m.recipient_username === currentUsername))
      );
    }
    return all.filter((m) => m.channel === channel);
  },

  sendChatMessage: async ({ channel = 'general', recipientUsername = null, text }) => {
    const { user } = await api.auth.getUser();
    const all = getStore(STORAGE_KEYS.CHAT_TABLE, INITIAL_CHAT);
    const msg = {
      id: 'm-' + Date.now(),
      sender_id: user?.id,
      sender_username: user?.username || '@researcher',
      sender_name: user?.full_name || 'Исследователь',
      sender_avatar: user?.avatar_preset || 'cyber-drop',
      sender_role: user?.role || 'Участник',
      channel,
      recipient_username: recipientUsername,
      message_text: text,
      created_at: new Date().toLocaleTimeString().slice(0, 5)
    };
    all.push(msg);
    setStore(STORAGE_KEYS.CHAT_TABLE, all);
    return msg;
  },

  // CO2 И ТЕСТЫ
  saveCo2Calculation: async (payload) => {
    const { user } = await api.auth.getUser();
    const list = api.getCo2History();
    const item = {
      ...payload,
      id: 'co2-' + Date.now(),
      username: user?.username || '@pestrikov_kv',
      created_at: new Date().toISOString()
    };
    list.unshift(item);
    setStore(STORAGE_KEYS.CO2_TABLE, list);
    await api.addRewards(50, 'Аудитор CO₂');
    return list;
  },

  getCo2History: () =>
    getStore(STORAGE_KEYS.CO2_TABLE, [
      {
        id: 'co2-1',
        username: '@pestrikov_kv',
        field_name: 'Мамонтовский куст (Стандарт)',
        oil_production_tons: 14000,
        apg_utilization_rate: 96.5,
        calculated_emissions_tons: 1940,
        saved_emissions_tons: 1620
      }
    ]),

  saveTestResult: async (payload) => {
    const { user } = await api.auth.getUser();
    const list = getStore(STORAGE_KEYS.TESTS_TABLE, []);
    list.unshift({
      ...payload,
      id: 't-' + Date.now(),
      username: user?.username || '@pestrikov_kv',
      completed_at: new Date().toISOString()
    });
    setStore(STORAGE_KEYS.TESTS_TABLE, list);
    return api.addRewards(payload.score || 50, payload.badge);
  }
};

export default supabase;