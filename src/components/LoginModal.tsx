import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { CrossIcon } from './Icons.tsx';
import { authenticate, type UserSession } from '../utils/auth.ts';
import { clearRememberedPassword, loadRememberedPassword, saveRememberedPassword } from '../utils/rememberedCredentials.ts';
import { ModalDialog } from './ModalDialog.tsx';

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
  const [error, setError] = useState('');
  const passwordEdited = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    passwordEdited.current = false;
    setError('');
    setShowPassword(false);
    let active = true;
    void loadRememberedPassword().then((savedPassword) => {
      if (!active || !savedPassword || passwordEdited.current) return;
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
    setError('');
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
        setError('Неверный логин или пароль. Проверьте введённые данные.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Сервер авторизации недоступен');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <ModalDialog labelledBy="login-modal-title" onClose={onClose} busy={isSubmitting} fullScreen>
      <div className="login-screen-inner">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
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
              disabled={isSubmitting}
              maxLength={80}
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
                disabled={isSubmitting}
                defaultValue={password}
                onChange={(e) => { passwordEdited.current = true; setPassword(e.target.value); }}
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
              disabled={isSubmitting}
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
                }
              }}
            />
            <span>
              Запомнить меня на этом устройстве
              <small>При следующем успешном входе новые данные заменят сохранённые.</small>
            </span>
          </label>

          {error && <p className="inline-error login-error" role="alert">{error}</p>}
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
    </ModalDialog>
  );
};
