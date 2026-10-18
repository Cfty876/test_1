import React, { useState } from 'react';
import { ArrowLeftIcon, LightbulbIcon } from './Icons.tsx';

export type HelpArea = 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство';

export interface ApplicationFormData {
  name: string;
  category: string;
  customCategoryText?: string;
  helpArea?: HelpArea;
  description: string;
  phone: string;
  email: string;
  isInitiative: boolean;
}

interface ApplicationFormViewProps {
  onGoHome: () => void;
  onSubmitSuccess: (data: ApplicationFormData) => void;
  initialHelpArea: HelpArea;
}

// «Есть своя инициатива» is FIRST per user request!
const CATEGORY_OPTIONS = [
  'Есть своя инициатива',
  'Хочу быть ведущим',
  'Медиа, фото, видео',
  'IT и техническая поддержка',
  'Мастер-класс',
  'Волонтёр',
  'Я — организация-партнёр',
  'Свой вариант (указать область)',
];

const HELP_AREAS: { id: HelpArea; label: string; desc: string }[] = [
  { id: 'Мероприятия', label: 'Мероприятия', desc: 'Сцена, организация, ведение, логистика' },
  { id: 'Медиа', label: 'Медиа', desc: 'Фото, видео, репортажи, соцсети, дизайн' },
  { id: 'IT', label: 'IT', desc: 'Разработка, боты, звук, свет, презентации' },
  { id: 'Волонтёрство', label: 'Волонтёрство', desc: 'Навигация, регистрация, сопровождение' },
];

export const ApplicationFormView: React.FC<ApplicationFormViewProps> = ({
  onGoHome,
  onSubmitSuccess,
  initialHelpArea,
}) => {
  const [formData, setFormData] = useState<ApplicationFormData>({
    name: '',
    category: CATEGORY_OPTIONS[0], // 'Есть своя инициатива' by default
    customCategoryText: '',
    helpArea: initialHelpArea,
    description: '',
    phone: '',
    email: '',
    isInitiative: true,
  });

  const isCustomOption = formData.category === 'Свой вариант (указать область)';
  const isInitiativeOption = formData.category === 'Есть своя инициатива';
  const showAreaSelector = isCustomOption || isInitiativeOption;

  const handleCategoryChange = (val: string) => {
    const isInit = val === 'Есть своя инициатива';
    setFormData({
      ...formData,
      category: val,
      isInitiative: isInit,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.name.trim() ||
      !formData.phone.trim() ||
      !formData.email.trim() ||
      !formData.description.trim()
    ) {
      return;
    }
    if (isCustomOption && !formData.customCategoryText?.trim()) {
      return;
    }

    onSubmitSuccess(formData);
  };

  return (
    <div className="platform-form-wrap flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <main className="platform-form-card w-full max-w-[560px] bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] p-6 sm:p-8 shadow-sm text-left">
        {/* Back Link */}
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#0F1115] mb-5 transition-colors cursor-pointer group"
        >
          <ArrowLeftIcon
            size={14}
            strokeWidth={2.2}
            className="transition-transform group-hover:-translate-x-0.5"
          />
          <span>На главную</span>
        </button>

        {/* Heading */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[24px] font-bold text-[#0F1115] tracking-tight leading-tight">
            Заявка
          </h2>
          {isInitiativeOption && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDE8EC] text-[#E60023] text-[12px] font-semibold">
              <LightbulbIcon size={13} strokeWidth={2.4} />
              <span>Инициатива</span>
            </span>
          )}
        </div>
        <p className="text-[14px] text-[#6B7280] mb-6">
          Заполни форму — мы получим её и свяжемся с тобой в Екатеринбурге
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Имя */}
          <div>
            <label htmlFor="form-name" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
              ФИО или имя
            </label>
            <input
              id="form-name"
              type="text"
              required
              placeholder="Как тебя зовут"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="pervik-input"
            />
          </div>

          {/* Чем можешь помочь? (первым вариантом: «Есть своя инициатива») */}
          <div>
            <label htmlFor="form-category" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
              Чем можешь помочь?
            </label>
            <select
              id="form-category"
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="pervik-input pervik-select cursor-pointer font-medium"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Свой текст, если выбран «Свой вариант» */}
          {isCustomOption && (
            <div className="p-3.5 bg-[#F7F8FA] rounded-[12px] border border-[#E8EAEE] space-y-2">
              <label htmlFor="custom-category-text" className="block text-[12px] font-semibold text-[#0F1115]">
                Опиши свой формат помощи
              </label>
              <input
                id="custom-category-text"
                type="text"
                required
                placeholder="Например: Звукорежиссура, проведение квиза, графический дизайн"
                value={formData.customCategoryText || ''}
                onChange={(e) => setFormData({ ...formData, customCategoryText: e.target.value })}
                className="pervik-input bg-white"
              />
            </div>
          )}

          {/* Обязательный выбор из 4 областей (Мероприятия, Медиа, IT, Волонтёрство) */}
          {showAreaSelector && (
            <div className="p-3.5 bg-[#F7F8FA] rounded-[12px] border border-[#E8EAEE] space-y-2.5">
              <label className="block text-[12px] font-semibold text-[#0F1115]">
                В какой области это поможет? <span className="text-[#E60023]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {HELP_AREAS.map((area) => {
                  const isSelected = formData.helpArea === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, helpArea: area.id })}
                      className={`px-3 py-2.5 rounded-[10px] text-left text-[13px] font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-[#E60023] text-[#E60023] shadow-xs'
                          : 'bg-[#FFFFFF] border-[#E8EAEE] text-[#0F1115] hover:border-[#D1D5DB]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{area.label}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#E60023]" />
                        )}
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-0.5 leading-tight truncate">
                        {area.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Описание */}
          <div>
            <label htmlFor="form-description" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
              {isInitiativeOption ? 'Суть инициативы или идеи' : 'Коротко опиши'}
            </label>
            <textarea
              id="form-description"
              required
              rows={3}
              placeholder={
                isInitiativeOption
                  ? 'Опиши идею: для кого она, что требуется для реализации, какую пользу принесёт отделению или городу'
                  : 'Расскажи об опыте, теме мастер-класса или готовности помочь'
              }
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="pervik-input resize-y min-h-[90px]"
            />
          </div>

          {/* Телефон и Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="form-phone" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
                Телефон
              </label>
              <input
                id="form-phone"
                type="tel"
                required
                placeholder="+7 999 000-00-00"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="pervik-input"
              />
            </div>

            <div>
              <label htmlFor="form-email" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
                Email
              </label>
              <input
                id="form-email"
                type="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pervik-input"
              />
            </div>
          </div>

          {/* Кнопка отправки */}
          <button
            type="submit"
            className="w-full h-12 rounded-[10px] bg-[#E60023] hover:bg-[#CC001F] text-white font-semibold text-[15px] transition-all shadow-sm active:scale-[0.99] cursor-pointer mt-2"
          >
            {isInitiativeOption ? 'Предложить инициативу' : 'Отправить'}
          </button>

          {/* Примечание */}
          <p className="text-center text-[12px] text-[#6B7280] pt-1">
            Куратор отделения свяжется с тобой в течение 3 дней
          </p>
        </form>
      </main>
    </div>
  );
};
