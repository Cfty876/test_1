import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { CrossIcon } from './Icons.tsx';
import { authenticate, type UserSession } from '../utils/auth.ts';
import { clearRememberedPassword, loadRememberedPassword, saveRememberedPassword } from '../utils/rememberedCredentials.ts';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: UserSession) => void;
  showToast: (text: string) => void;
}

const SAVED_LOGIN_KEY = 'pervik:saved-login';

function getSavedLogin(): string {
  try {
    return window.localStorage.getItem(SAVED_LOGIN_KEY) ?? '';
  } catch {
    return '';
  }
}

async function saveBrowserCredential(username: string, password: string): Promise<void> {
  type PasswordCredentialConstructor = new (data: { id: string; password: string; name?: string }) => Credential;
  const credentialWindow = window as Window & { PasswordCredential?: PasswordCredentialConstructor };
  if (!window.isSecureContext || !credentialWindow.PasswordCredential || !navigator.credentials?.store) return;

  try {
    const credential = new credentialWindow.PasswordCredential({ id: username, password, name: username });
    await navigator.credentials.store(credential);
  } catch {
    // Older browsers may not support saving credentials through the Credential Management API.
  }
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [login, setLogin] = useState(getSavedLogin);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void loadRememberedPassword().then((savedPassword) => {
      if (!active || !savedPassword) return;
      setPassword(savedPassword);
      const passwordField = formRef.current?.elements.namedItem('password') as HTMLInputElement | null;
      if (passwordField && !passwordField.value) passwordField.value = savedPassword;
    }).catch(() => {
      // The form remains usable when the browser blocks local credential storage.
    });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const loginValue = String(formData.get('username') ?? login).trim();
    const passwordValue = String(formData.get('password') ?? password);
    setIsSubmitting(true);
    try {
      const session = await authenticate(loginValue, passwordValue);
      if (session) {
        if (rememberMe) {
          try {
            window.localStorage.setItem(SAVED_LOGIN_KEY, loginValue);
          } catch {
            // Login can still proceed when browser storage is unavailable.
          }
          await saveRememberedPassword(passwordValue).catch(() => undefined);
          void saveBrowserCredential(loginValue, passwordValue);
        } else {
          try {
            window.localStorage.removeItem(SAVED_LOGIN_KEY);
          } catch {
            // Login can still proceed when browser storage is unavailable.
          }
          void clearRememberedPassword().catch(() => undefined);
        }
        onSuccess(session);
        setLogin(rememberMe ? loginValue : '');
        setPassword('');
        const loginField = formRef.current?.elements.namedItem('username') as HTMLInputElement | null;
        const passwordField = formRef.current?.elements.namedItem('password') as HTMLInputElement | null;
        if (loginField) loginField.value = rememberMe ? loginValue : '';
        if (passwordField) passwordField.value = '';
        onClose();
      } else {
        showToast('Неверный логин или пароль');
      }
    } catch {
      showToast('Сервер авторизации недоступен');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="login-screen fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="login-screen-inner">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть окно входа"
          className="login-close"
        >
          <CrossIcon size={18} strokeWidth={2} />
          <span>Закрыть</span>
        </button>

        <div className="login-brand">
          <img src="/brand/ekb-council-logo.svg" alt="Логотип Совета Первых Екатеринбурга" />
        </div>

        <main className="login-main">
          <div className="login-card modal-animate">
            <span className="login-card-eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
            <h1 id="login-modal-title">Вход в кабинет</h1>
            <p className="login-card-caption">Для председателей, кураторов и партнёров Совета Первых Екатеринбурга</p>

            <form ref={formRef} onSubmit={handleSubmit} className="login-form" autoComplete="on" name="platform-login">
          <div>
            <label
              htmlFor="login-input"
              className="login-label"
            >
              Логин или почта
            </label>
            <input
              id="login-input"
              name="username"
              type="text"
              autoComplete="username"
              required
              autoFocus
              defaultValue={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Введите логин или почту"
              className="pervik-input login-input"
            />
          </div>

          <div>
            <label
              htmlFor="password-input"
              className="login-label"
            >
              Пароль
            </label>
            <div className="login-password-field">
              <input
                id="password-input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                defaultValue={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="pervik-input login-input"
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => {
                const shouldRemember = event.target.checked;
                setRememberMe(shouldRemember);
                if (!shouldRemember) {
                  try {
                    window.localStorage.removeItem(SAVED_LOGIN_KEY);
                  } catch {
                    // Keep the form usable when browser storage is unavailable.
                  }
                  void clearRememberedPassword().catch(() => undefined);
                  setLogin('');
                  setPassword('');
                  const loginField = formRef.current?.elements.namedItem('username') as HTMLInputElement | null;
                  const passwordField = formRef.current?.elements.namedItem('password') as HTMLInputElement | null;
                  if (loginField) loginField.value = '';
                  if (passwordField) passwordField.value = '';
                }
              }}
            />
            <span>
              Запомнить меня на этом устройстве
              <small>При следующем успешном входе новые данные заменят сохранённые.</small>
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="login-submit"
          >
            {isSubmitting ? 'Проверяем…' : 'Войти'}
          </button>
            </form>

            <div className="login-help">
              <span className="login-help-dot" />
              <p>Доступ выдаёт администратор платформы. Если не получается войти, обратитесь к нему за проверкой учётной записи.</p>
            </div>
          </div>
        </main>

        <footer className="login-footer"><span>СОВЕТ ПЕРВЫХ · ЕКАТЕРИНБУРГ</span></footer>
      </div>
    </div>
  );
};
