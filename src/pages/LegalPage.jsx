import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Badge } from '../components/ui/DesignSystem';
import { ShieldCheck, FileText, Users, Database } from 'lucide-react';

const DOCS = {
  privacy: {
    title: 'Политика конфиденциальности',
    icon: ShieldCheck,
    items: [
      'Платформа «Зелёная Югра» собирает только минимально необходимые учётные данные: адрес электронной почты, никнейм (@username), ФИО и привязку к образовательной организации.',
      'Пароли пользователей хранятся исключительно в зашифрованном виде (bcrypt) в контуре Supabase Auth и недоступны администрации.',
      'Пользователь может в любой момент перевести свой профиль в режим «Приватный» или удалить свои публикации.'
    ]
  },
  terms: {
    title: 'Пользовательское соглашение (Условия пользования)',
    icon: FileText,
    items: [
      'Платформа предназначена для образовательных, научно-исследовательских и проектных целей обучающихся и наставников ХМАО-Югры.',
      'Материалы проектов, опубликованные в мастерской «Зелёный след», остаются интеллектуальной собственностью их авторов.',
      'Запрещается искусственная накрутка баллов опыта (XP), использование автоматизированных скриптов и публикация недостоверных расчётов.'
    ]
  },
  rules: {
    title: 'Правила сообщества',
    icon: Users,
    items: [
      'В чатах, комментариях и на личных стенах действует принцип уважительного научного и делового общения.',
      'За спам, оскорбления или нецензурную лексику модераторы и система автоматически применяют штраф (-50 XP) и скрывают публикацию.',
      'Любой участник может отправить жалобу на некорректный пост с помощью кнопки «Пожаловаться» на стене.'
    ]
  },
  pdn: {
    title: 'Согласие на обработку персональных данных (152-ФЗ)',
    icon: Database,
    items: [
      'В соответствии с Федеральным законом № 152-ФЗ «О персональных данных» пользователь даёт согласие на обработку своих учётных данных для формирования рейтинга и портфолио.',
      'Данные используются исключительно внутри цифровой образовательной среды «ЮГРА.НЕФТЬ — Зелёная Югра» и не передаются третьим лицам в коммерческих целях.'
    ]
  }
};

export default function LegalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = searchParams.get('doc') || 'privacy';
  const currentDoc = DOCS[activeKey] || DOCS.privacy;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {Object.entries(DOCS).map(([key, d]) => (
          <button
            key={key}
            onClick={() => setSearchParams({ doc: key })}
            className={`px-4 py-2 font-mono text-xs uppercase border transition-all ${
              activeKey === key
                ? 'border-[#00C853] bg-[#00C853]/15 text-[#34D399]'
                : 'border-white/10 text-[#8A93A6] hover:text-white'
            }`}
          >
            {d.title}
          </button>
        ))}
      </div>

      <Card className="p-8 space-y-5">
        <Badge color="emerald">Официальный регламент платформы · 2026</Badge>
        <h1 className="text-2xl font-light text-white">{currentDoc.title}</h1>
        <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          {currentDoc.items.map((p, i) => (
            <p key={i} className="p-4 border-l-2 border-[#00C853] bg-[#050810]">
              {i + 1}. {p}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}