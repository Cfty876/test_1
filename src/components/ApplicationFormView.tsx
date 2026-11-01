import type { InitiativeDirection } from '../utils/initiativeDirections.ts';
import { INITIATIVE_DIRECTIONS, isInitiativeDirection } from '../utils/initiativeDirections.ts';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, LightbulbIcon } from './Icons.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { PARTICIPATION_OPTIONS } from './ParticipationSelect.tsx';
import { createTrackingCode } from '../utils/applicationJourney.ts';
import type { ParticipationRole, PublicImplementation } from '../utils/implementations.ts';
import { PrivacyAcknowledgement } from './PrivacyAcknowledgement.tsx';
import { PRIVACY_VERSION, PRIVACY_ACKNOWLEDGEMENT_ERROR } from '../utils/legal.ts';
import { PhoneInput } from './PhoneInput.tsx';
import { formatRussianPhone, normalizeVkUrl } from '../utils/contactFields.ts';

import type { HelpArea } from '../utils/auth.ts';
export type { HelpArea } from '../utils/auth.ts';

export interface ApplicationFormData {
  direction?: InitiativeDirection;
  name: string;
  category: string;
  customCategoryText?: string;
  helpArea?: HelpArea;
  helpAreas?: HelpArea[];
  description: string;
  phone: string;
  email: string;
  vkUrl?: string;
  isInitiative: boolean;
  supportInitiativeId?: string;
  submissionId?: string;
  trackingCode?: string;
  supportImplementationId?: string;
  participationRole?: ParticipationRole;
  privacyAcknowledged?: boolean;
  privacyVersion?: string;
}

interface ApplicationFormViewProps {
  mode?: 'initiative' | 'activist';
  initialDirection?: InitiativeDirection;
  onGoHome: () => void;
  backLabel?: string;
  onSubmitSuccess: (data: ApplicationFormData) => Promise<void>;
  initialHelpArea: HelpArea;
  initialInitiative: PublicInitiative | null;
  initialImplementation?: PublicImplementation | null;
}

const HELP_AREAS: { id: HelpArea; label: string; desc: string }[] = [
  { id: 'Мероприятия', label: 'Мероприятия', desc: 'Сцена, организация, ведение, логистика' },
  { id: 'Медиа', label: 'Медиа', desc: 'Фото, видео, репортажи, соцсети, дизайн' },
  { id: 'IT', label: 'IT', desc: 'Разработка, боты, звук, свет, презентации' },
  { id: 'Волонтёрство', label: 'Волонтёрство', desc: 'Навигация, регистрация, сопровождение' },
];

const DRAFT_KEY = 'pervik.application-draft.v1';
interface FormDraft { context: string; data: ApplicationFormData; submission: { fingerprint: string; id: string; code: string } }
function readDraft(context: string): FormDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(`${DRAFT_KEY}:${context}`) || 'null') as FormDraft | null;
    if (draft?.context !== context || !draft.data || !['name', 'phone', 'email', 'description', 'category'].every((key) => typeof draft.data[key as keyof ApplicationFormData] === 'string')) return null;
    if (![...PARTICIPATION_OPTIONS.map((item) => item.value), 'Хочу помочь инициативе', 'Хочу быть активистом'].includes(draft.data.category)) return null;
    if (!HELP_AREAS.some((area) => area.id === draft.data.helpArea)) return null;
    return draft;
  } catch { return null; }
}

export const ApplicationFormView: React.FC<ApplicationFormViewProps> = ({
  onGoHome,
  mode = 'initiative',
  initialDirection = 'education',
  backLabel = 'На главную',
  onSubmitSuccess,
  initialHelpArea,
  initialInitiative,
  initialImplementation = null,
}) => {
  const context = `${mode}:${initialInitiative?.id || 'general'}:${initialImplementation?.id || 'general'}`;
  const [savedDraft] = useState(() => readDraft(context));
  const defaultData: ApplicationFormData = {
    name: '',
    direction: initialDirection,
    category: initialInitiative ? 'Хочу помочь инициативе' : mode === 'initiative' ? 'Есть своя инициатива' : 'Хочу быть активистом',
    customCategoryText: '',
    helpArea: initialHelpArea,
    helpAreas: [initialHelpArea],
    description: '',
    phone: '',
    email: '',
    vkUrl: '',
    isInitiative: !initialInitiative && mode === 'initiative',
    participationRole: initialImplementation && initialImplementation.volunteerSlots > initialImplementation.volunteersAccepted ? 'volunteer' : 'activist',
  };
  const [formData, setFormData] = useState<ApplicationFormData>(() => savedDraft ? { ...savedDraft.data, direction: isInitiativeDirection(new URLSearchParams(location.search).get('direction')) ? initialDirection : isInitiativeDirection(savedDraft.data.direction) ? savedDraft.data.direction : initialDirection, phone: savedDraft.data.phone ? formatRussianPhone(savedDraft.data.phone) : '' } : defaultData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  useEffect(() => { setPrivacyAcknowledged(false); }, [context]);
  const submission = useRef(savedDraft?.submission || { fingerprint: '', id: '', code: '' });
  const submitted = useRef(false);
  const [draftCleared, setDraftCleared] = useState(false);
  useEffect(() => {
    if (submitted.current) return;
    if (![formData.name, formData.description, formData.phone, formData.email, formData.customCategoryText || ''].some((value) => value.trim())) {
      try { sessionStorage.removeItem(`${DRAFT_KEY}:${context}`); } catch { /* Storage may be unavailable. */ }
      return;
    }
    try { sessionStorage.setItem(`${DRAFT_KEY}:${context}`, JSON.stringify({ context, data: formData, submission: submission.current })); } catch { /* Form remains usable with storage disabled. */ }
  }, [formData, context]);
  const isSupport = Boolean(initialInitiative && formData.category === 'Хочу помочь инициативе');

  const isCustomOption = formData.category === 'Свой вариант (указать область)';
  const isInitiativeOption = formData.category === 'Есть своя инициатива';
  const showAreaSelector = !isSupport && !isInitiativeOption;
  const isActivist = !isInitiativeOption && !isSupport;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const invalidText = !formData.name.trim() ? 'form-name' : !formData.description.trim() ? 'form-description' : '';
    if (invalidText) {
      const field = document.getElementById(invalidText) as HTMLInputElement | HTMLTextAreaElement | null;
      field?.setCustomValidity('Заполни это поле.'); field?.reportValidity(); return;
    }
    if (normalizeVkUrl(formData.vkUrl || '') === null) {
      const field = document.getElementById('form-vk') as HTMLInputElement | null;
      field?.setCustomValidity('Добавь ссылку на ВКонтакте: https://vk.com/твой_профиль.'); field?.reportValidity(); return;
    }
    if (!privacyAcknowledged) { setSubmitError(PRIVACY_ACKNOWLEDGEMENT_ERROR); return; }
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

    setSubmitError('');
    setIsSubmitting(true);
    try {
      const payload = { ...formData, direction: isInitiativeOption ? formData.direction : undefined, helpAreas: isActivist ? (formData.helpAreas?.length ? formData.helpAreas : [formData.helpArea!]) : [formData.helpArea!], customCategoryText: isCustomOption ? formData.customCategoryText : undefined, participationRole: isSupport && initialImplementation ? formData.participationRole : undefined, ...(isSupport ? { supportInitiativeId: initialInitiative!.id, ...(initialImplementation ? { supportImplementationId: initialImplementation.id } : {}) } : {}) };
      const fingerprint = JSON.stringify(payload);
      if (submission.current.fingerprint !== fingerprint) submission.current = { fingerprint, id: crypto.randomUUID(), code: createTrackingCode() };
      try { sessionStorage.setItem(`${DRAFT_KEY}:${context}`, JSON.stringify({ context, data: formData, submission: submission.current })); } catch { /* In-memory retry remains available. */ }
      await onSubmitSuccess({ ...payload, vkUrl: normalizeVkUrl(formData.vkUrl || '') || '', submissionId: submission.current.id, trackingCode: submission.current.code, privacyAcknowledged, privacyVersion: PRIVACY_VERSION });
      submitted.current = true;
      try { sessionStorage.removeItem(`${DRAFT_KEY}:${context}`); } catch { /* Storage may be unavailable. */ }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="platform-form-wrap flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <main data-validation-scope className="platform-form-card w-full max-w-[560px] bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] p-6 sm:p-8 shadow-sm text-left">
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
          <span>{backLabel}</span>
        </button>

        {/* Heading */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[24px] font-bold text-[#0F1115] tracking-tight leading-tight">
            {isInitiativeOption ? 'Предложить инициативу' : isSupport ? 'Помочь проекту' : 'Стать активистом'}
          </h1>
          {isInitiativeOption && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDE8EC] text-[#E60023] text-[12px] font-semibold">
              <LightbulbIcon size={13} strokeWidth={2.4} />
              <span>Инициатива</span>
            </span>
          )}
        </div>
        <p className="text-[14px] text-[#6B7280] mb-6">
          {isInitiativeOption ? 'Есть идея для города? Расскажи, что хочешь изменить и какая поддержка нужна.' : isSupport ? 'Расскажи о себе и о том, чем можешь помочь команде проекта.' : 'Выбери направления, в которых хочешь помогать. Расскажи о своих навыках — команда свяжется с тобой.'}
        </p>
        <div className="application-draft-note"><p><span className="mobile-copy">Черновик в этой вкладке</span><span className="desktop-copy">{savedDraft && !draftCleared ? 'Черновик восстановлен. ' : ''}Текст и контакты сохраняются в этой вкладке, чтобы не потерять их при обновлении страницы.</span></p><button type="button" disabled={isSubmitting} data-clear-validation onClick={() => { setFormData(defaultData); setPrivacyAcknowledged(false); submission.current = { fingerprint: '', id: '', code: '' }; setSubmitError(''); setDraftCleared(true); try { sessionStorage.removeItem(`${DRAFT_KEY}:${context}`); } catch { /* Storage may be unavailable. */ } }}><span className="desktop-copy">Очистить черновик</span><span className="mobile-copy">Очистить</span></button></div>

        {!isSupport && <nav className="submission-switch" aria-label="Выбор формы"><a href="/?view=form&kind=initiative" aria-current={isInitiativeOption ? 'page' : undefined}>Своя инициатива</a><a href="/?view=form&kind=activist" aria-current={isActivist ? 'page' : undefined}>Я — активист</a></nav>}
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSupport && <div className="application-support-context"><span>ПРИСОЕДИНИТЬСЯ К ПРОЕКТУ</span><strong>{initialInitiative!.title}</strong><p>{initialImplementation ? `${initialImplementation.organization} · ответственный ${initialImplementation.ownerName}` : 'Расскажи, чем готов помочь. Команда Совета получит отклик вместе со ссылкой на эту инициативу.'}</p></div>}
          <fieldset disabled={isSubmitting} className="space-y-4">
          <legend className="sr-only">Данные заявки</legend>
          {/* Имя */}
          <div>
            <label htmlFor="form-name" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
              ФИО
            </label>
            <input
              id="form-name"
              type="text"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Фамилия Имя Отчество"
              value={formData.name}
              onChange={(e) => { e.target.setCustomValidity(''); setFormData({ ...formData, name: e.target.value }); }}
              className="pervik-input"
            />
          </div>


          {isSupport && initialImplementation && <div><label htmlFor="event-participation-role" className="block text-[13px] font-medium mb-1.5">В какой роли хочешь участвовать?</label><select id="event-participation-role" className="pervik-input" required value={formData.participationRole} onChange={(event) => setFormData({ ...formData, participationRole: event.target.value as ParticipationRole })}><option value="activist" disabled={initialImplementation.activistSlots <= initialImplementation.activistsAccepted}>Активист · свободно {Math.max(0, initialImplementation.activistSlots - initialImplementation.activistsAccepted)}</option><option value="volunteer" disabled={initialImplementation.volunteerSlots <= initialImplementation.volunteersAccepted}>Волонтёр · свободно {Math.max(0, initialImplementation.volunteerSlots - initialImplementation.volunteersAccepted)}</option></select><p className="journey-hint">Команда подтвердит участие после рассмотрения отклика.</p></div>}

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
                maxLength={120}
                placeholder="Например: Звукорежиссура, проведение квиза, графический дизайн"
                value={formData.customCategoryText || ''}
                onChange={(e) => setFormData({ ...formData, customCategoryText: e.target.value })}
                className="pervik-input bg-white"
              />
            </div>
          )}

          {/* Темы проектов отделены от навыков активистов. */}
          {isInitiativeOption && <fieldset className="initiative-direction-field"><legend>Направление инициативы <span aria-hidden="true">*</span></legend><p>Выбери одну тему проекта.</p><div className="initiative-direction-options">{INITIATIVE_DIRECTIONS.map(direction => <label key={direction.id} className={formData.direction === direction.id ? 'is-selected' : ''}><span><input type="radio" required name="initiative-direction" value={direction.id} checked={formData.direction === direction.id} onChange={() => setFormData(data => ({ ...data, direction: direction.id }))} /><strong>{direction.label}</strong></span><small>{direction.description}</small><p>{direction.hint}</p></label>)}</div></fieldset>}
          {showAreaSelector && (
            <div className="p-3.5 bg-[#F7F8FA] rounded-[12px] border border-[#E8EAEE] space-y-2.5">
              <span id="help-area-label" className="block text-[12px] font-semibold text-[#0F1115]">
                В каких направлениях готов помогать? <span className="text-[#E60023]">*</span>
              </span>
              {isActivist && <p className="journey-hint">Выбери хотя бы одно направление. Можно несколько; опыт не обязателен.</p>}
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="help-area-label">
                {HELP_AREAS.map((area) => {
                  const isSelected = formData.helpAreas?.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => setFormData(data => {
                        const current = data.helpAreas || [data.helpArea!];
                        const next = current.includes(area.id) ? current.filter(value => value !== area.id) : [...current, area.id];
                        return next.length ? { ...data, helpAreas: next, helpArea: next[0] } : data;
                      })}
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
                      <div className="help-area-description text-[11px] text-[#6B7280] mt-0.5 leading-tight truncate">
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
              {isInitiativeOption ? 'Суть инициативы или идеи' : isSupport ? 'Чем ты готов помочь проекту?' : 'Твои навыки и готовность помогать'}
            </label>
            <textarea
              id="form-description"
              required
              maxLength={5000}
              rows={3}
              placeholder={
                isInitiativeOption
                  ? 'Опиши идею: для кого она, что требуется для реализации, какую пользу принесёт отделению или городу'
                  : 'Что тебе нравится делать? Есть ли опыт? Когда и как часто можешь помогать? Можно начать без опыта.'
              }
              value={formData.description}
              onChange={(e) => { e.target.setCustomValidity(''); setFormData({ ...formData, description: e.target.value }); }}
              className="pervik-input resize-y min-h-[90px]"
            />
          </div>

          {/* Телефон и Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="form-phone" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
                Телефон
              </label>
              <PhoneInput
                id="form-phone"
                required
                value={formData.phone}
                onChange={(phone) => setFormData({ ...formData, phone })}
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
                pattern={'[^\\s@]+@[^\\s@]+\\.[^\\s@]+'}
                data-validation-pattern="Проверь почту: например, name@example.com."
                required
                autoComplete="email"
                maxLength={160}
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pervik-input"
              />
            </div>
          </div>

          {/* Кнопка отправки */}
          <div className="optional-contact-field">
            <label htmlFor="form-vk">Страница ВКонтакте <span>Необязательно</span></label>
            <input id="form-vk" type="url" maxLength={500} autoComplete="url" className="pervik-input" placeholder="https://vk.com/твой_профиль" value={formData.vkUrl || ''}
              onChange={event => { event.target.setCustomValidity(''); setFormData({ ...formData, vkUrl: event.target.value }); }}
              onBlur={event => { const normalized = normalizeVkUrl(event.target.value); if (normalized !== null) setFormData(previous => ({ ...previous, vkUrl: normalized })); }}
              aria-describedby="form-vk-hint" />
            <p id="form-vk-hint">Команде будет проще связаться с тобой. Ссылка не появится на публичной доске.</p>
          </div>
          <PrivacyAcknowledgement checked={privacyAcknowledged} onChange={setPrivacyAcknowledged} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-[10px] bg-[#E60023] hover:bg-[#CC001F] text-white font-semibold text-[15px] transition-all shadow-sm active:scale-[0.99] cursor-pointer mt-2"
          >
            {isSubmitting ? 'Отправляем…' : isInitiativeOption ? 'Отправить инициативу' : isSupport ? 'Отправить отклик' : 'Отправить анкету активиста'}
          </button>
          </fieldset>
          {submitError && <p className="inline-error" role="alert">{submitError}</p>}

          {/* Примечание */}
          <p className="text-center text-[12px] text-[#6B7280] pt-1">
            После отправки получишь личный код для проверки статуса и доработки заявки
          </p>
          {isActivist && <p className="journey-hint">Анкета и контакты доступны команде Совета. Анкета активиста не публикуется в каталоге инициатив.</p>}
          {isInitiativeOption && <p className="text-[12px] text-[#6B7280] leading-relaxed">Имя автора и описание одобренной инициативы появятся в открытом каталоге. Телефон и почта на главной странице не публикуются.</p>}
        </form>
      </main>
    </div>
  );
};
