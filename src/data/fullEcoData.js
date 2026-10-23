export const fullEcoData = {
  // Рейтинг школ ХМАО-Югры
  schoolRatings: [
    { rank: 1, school: 'МБОУ «СОШ № 1» пгт. Пойковский (11А Роснефть-класс)', city: 'пгт. Пойковский', points: 16450, projects: 14, apgAudit: '98.4%', badge: 'Абсолютный лидер Югры' },
    { rank: 2, school: 'МБОУ «Лицей им. Г. Ф. Атякшева»', city: 'г. Югорск', points: 13820, projects: 10, apgAudit: '96.9%', badge: 'Эко-партнёр' },
    { rank: 3, school: 'МАОУ «СОШ № 4» (Роснефть-класс)', city: 'г. Нефтеюганск', points: 12940, projects: 9, apgAudit: '96.2%', badge: 'Топ-3 региона' },
    { rank: 4, school: 'МБОУ «Гимназия № 1»', city: 'г. Ханты-Мансийск', points: 11500, projects: 8, apgAudit: '95.8%', badge: 'Карбоновый полигон' },
    { rank: 5, school: 'МБОУ «Сургутский естественно-научный лицей»', city: 'г. Сургут', points: 10890, projects: 7, apgAudit: '95.4%', badge: 'Зелёный резерв' },
    { rank: 6, school: 'МБОУ «Лицей № 1 им. А. С. Пушкина»', city: 'г. Нижневартовск', points: 9940, projects: 6, apgAudit: '95.1%', badge: 'Активист Самотлора' }
  ],

  // Эко-календарь и волонтёрский корпус Югры
  volunteerEvents: [
    {
      id: 'ev-1',
      date: '15 Мая 2026',
      category: 'Лесовосстановление',
      title: 'Международная акция «Спасти и сохранить» · Высадка сибирского кедра',
      location: 'пгт. Пойковский · Опытный полигон СОШ №1 и Музея нефти им. Р. И. Кузоваткина',
      participants: 84,
      rewardXp: 100,
      rewardCoins: 200,
      badge: 'Хранитель кедра'
    },
    {
      id: 'ev-2',
      date: '05 Июня 2026',
      category: 'Водный патруль',
      title: 'Экологический десант «Чистый берег Юганской Оби»',
      location: 'Нефтеюганский район · Буферная пойма Приобского месторождения',
      participants: 62,
      rewardXp: 80,
      rewardCoins: 150,
      badge: 'Патруль Оби'
    },
    {
      id: 'ev-3',
      date: '18 Сентября 2026',
      category: 'Инженерный хакатон',
      title: 'Проектная сессия «Декарбонизация и переработка ПНГ — 2030»',
      location: 'г. Ханты-Мансийск / Цифровая платформа ЮГРА.НЕФТЬ',
      participants: 120,
      rewardXp: 150,
      rewardCoins: 300,
      badge: 'Архитектор ESG'
    },
    {
      id: 'ev-4',
      date: '12 Октября 2026',
      category: 'Полевой мониторинг',
      title: 'Отбор проб снежного покрова и торфяных горизонтов с датчиками IoT',
      location: 'Граница Юганского заповедника · Кустовой сектор №18',
      participants: 35,
      rewardXp: 120,
      rewardCoins: 250,
      badge: 'Лаборант Югры'
    }
  ],

  // Спутниковый мониторинг NDVI и контроль разливов
  satelliteSectors: [
    {
      id: 'sat-1',
      name: 'Сектор Sentinel-2A · Мамонтовское (пгт. Пойковский)',
      coords: '61.233° N, 72.583° E',
      ndvi: 0.78,
      thermalAnomalies: 0,
      methanePlume: 'Не обнаружено (< 1.8 ppm)',
      reclamationArea: '18.5 га (Приживаемость 96%)',
      status: 'Эталон биоценоза'
    },
    {
      id: 'sat-2',
      name: 'Сектор Sentinel-2B · Приобская пойма (Куст №14)',
      coords: '61.120° N, 69.800° E',
      ndvi: 0.74,
      thermalAnomalies: 0,
      methanePlume: 'Норма (ГТЭС когенерация 98.1%)',
      reclamationArea: '24.0 га (Гидропосев завершён)',
      status: 'В пределах нормы'
    },
    {
      id: 'sat-3',
      name: 'Сектор Landsat-9 · Самотлорский полигон биоремедиации',
      coords: '61.150° N, 76.700° E',
      ndvi: 0.69,
      thermalAnomalies: 1,
      methanePlume: 'Локальный фон (идёт рекультивация)',
      reclamationArea: '42.0 га (Работают биодеструкторы)',
      status: 'Активный мониторинг'
    }
  ],

  // Данные педагогического эксперимента (из научной работы «Шаг в будущее»)
  pedagogicalResults: [
    { group: 'Контрольная группа (КГ)', method: 'Традиционный (лекции, плакаты)', before: 5.8, after: 10.2, delta: '+4.4', clarity: '65%', motivation: '35%' },
    { group: 'Экспериментальная 1 (ЭГ1)', method: 'Только VR/AR-тренажёры (1 поколение)', before: 6.0, after: 13.0, delta: '+7.0 (+17%)', clarity: '95%', motivation: '65%' },
    { group: 'Экспериментальная 2 (ЭГ2)', method: 'Комплексная экосистема «ЮГРА.НЕФТЬ»', before: 5.9, after: 14.6, delta: '+8.7 (+22%)', clarity: '100%', motivation: '85%' }
  ]
};