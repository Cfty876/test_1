import {
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Heart,
  Home,
  LayoutDashboard,
  LogIn,
  MapPin,
  Menu,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  areas,
  initialRequests,
  projects as seedProjects,
  type Area,
  type Project,
  type Role,
} from "./data";
import { ExpandableRow, MotionNav } from "./Interactions";
import "./style.css";
import logoUrl from "./assets/logo.svg";
import communityUrl from "./assets/community.webp";

type View = "home" | "board" | "project" | "cabinet" | "login" | "submit";
const viewTitles: Record<View, string> = {
  home: "Первик · Город делают люди",
  board: "Инициативы · Первик",
  project: "Инициатива · Первик",
  cabinet: "Рабочее пространство · Первик",
  login: "Вход в команду · Первик",
  submit: "Предложить идею · Первик",
};
const getRoute = () => {
  const [name, id] = location.hash.slice(1).split("/");
  return {
    view: (["board", "project", "cabinet", "login", "submit"].includes(name)
      ? name
      : "home") as View,
    id: id || "green",
  };
};
const Arrow = () => <ArrowUpRight size={19} aria-hidden="true" />;
function Action({
  children,
  onClick,
  kind = "primary",
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "text";
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`action ${kind} ${className}`}
    >
      {children}
    </button>
  );
}
function Mark({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="brand"
      onClick={onClick}
      aria-label="Первик — на главную"
    >
      <img src={logoUrl} width="54" height="40" alt="" />
      <span className="brand-word">
        первик<span className="brand-dot">.</span>
      </span>
      <span className="brand-city">
        Совет Первых
        <br />
        Екатеринбург
      </span>
    </button>
  );
}

function ProjectArt({
  type,
  large = false,
}: {
  type: Project["art"];
  large?: boolean;
}) {
  return (
    <div
      className={`project-art art-${type}${large ? " art-large" : ""}`}
      aria-hidden="true"
    >
      {type === "plant" ? (
        <svg viewBox="0 0 420 230">
          <path
            d="M211 200V110M210 145C137 149 112 116 113 72C175 72 213 95 210 145ZM212 111C217 50 249 27 300 32C302 81 272 115 212 111Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M149 202h125M116 216h192"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="338" cy="167" r="21" fill="currentColor" />
          <path d="M77 45v25M65 58h25" stroke="currentColor" strokeWidth="2" />
        </svg>
      ) : type === "media" ? (
        <svg viewBox="0 0 420 230">
          <rect
            x="81"
            y="43"
            width="257"
            height="148"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="m191 87 46 29-46 29Z" fill="currentColor" />
          <path
            d="M102 172h174m-174-6v12m185-6h29"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M67 63V29h42M313 29h39v35M67 170v36h41M314 206h38v-36"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : type === "code" ? (
        <svg viewBox="0 0 420 230">
          <path
            d="m140 71-55 44 55 44m140-88 55 44-55 44m-44-111-52 135"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="345" cy="45" r="16" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 420 230">
          <path
            d="M210 184c-35-24-75-28-120-18V45c43-8 84-2 120 22 36-24 77-30 120-22v121c-45-10-85-6-120 18Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M210 67v117M111 77c26-2 48 2 74 14m-74 14c26-2 48 2 74 14m49-28c25-12 48-16 74-14m-74 42c25-12 48-16 74-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onLike,
  liked,
}: {
  project: Project;
  onOpen: () => void;
  onLike: () => void;
  liked: boolean;
}) {
  return (
    <article className="project-card">
      <button
        type="button"
        className="art-link"
        onClick={onOpen}
        aria-label={"Открыть: " + project.title}
      >
        <ProjectArt type={project.art} />
        <span className="art-open">
          <Arrow />
        </span>
      </button>
      <div className="project-card-content">
        <div className="project-meta">
          <span>{project.area}</span>
          <button
            className="like"
            type="button"
            aria-pressed={liked}
            aria-label={"Поддержать: " + project.title}
            onClick={onLike}
          >
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
            <span>{project.likes}</span>
          </button>
        </div>
        <h3>
          <button onClick={onOpen} type="button">
            {project.title}
          </button>
        </h3>
        <p>{project.summary}</p>
        <div className="project-need">
          <Users size={15} />
          <span>{project.need}</span>
        </div>
        <div className="project-author">
          <span className="tiny-avatar">
            {project.author
              .split(" ")
              .map((v) => v[0])
              .join("")}
          </span>
          {project.author}
        </div>
      </div>
    </article>
  );
}

function Prototype() {
  const [route, setRoute] = useState(getRoute);
  const [showPhoneNav, setShowPhoneNav] = useState(window.scrollY > 120);
  const [role, setRole] = useState<Role>("Администратор");
  const [projectList, setProjectList] = useState(seedProjects);
  const [likes, setLikes] = useState<string[]>([]);
  const [requests, setRequests] = useState(initialRequests);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<Area>("Все");
  const [tab, setTab] = useState("Заявки");
  const [notice, setNotice] = useState("");
  const [sheet, setSheet] = useState<"join" | "implement" | "tracking" | null>(
    null,
  );
  const [sent, setSent] = useState(false);
  const [joined, setJoined] = useState<string[]>([]);
  const [implemented, setImplemented] = useState(false);
  const [level, setLevel] = useState("Школа");
  const reduce = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const go = (view: View, id?: string) => {
    const hash = "#" + view + (id ? "/" + id : "");
    setMenu(false);
    if (location.hash === hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    location.hash = hash;
  };
  useEffect(() => {
    const change = () => {
      if (location.hash === "#content") {
        document.getElementById("content")?.focus();
        return;
      }
      setRoute(getRoute());
      setMenu(false);
      setSheet(null);
      setNotice("");
      const anchor = location.hash.slice(1);
      if (anchor === "content" || anchor === "opportunities") {
        requestAnimationFrame(() => {
          const target = document.getElementById(anchor);
          target?.scrollIntoView({ behavior: "instant" });
          target?.focus({ preventScroll: true });
        });
        return;
      }
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>("main h1")
          ?.focus({ preventScroll: true }),
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = viewTitles[route.view];
  }, [route.view]);
  useEffect(() => {
    if (sent && route.view === "submit")
      document.querySelector<HTMLElement>(".submitted h2")?.focus();
  }, [sent, route.view]);
  useEffect(() => {
    const scroll = () => setShowPhoneNav(window.scrollY > 120);
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => window.removeEventListener("scroll", scroll);
  }, [route.view]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3800);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (sheet && !dialog.current?.open) dialog.current?.showModal();
    else if (!sheet && dialog.current?.open) dialog.current.close();
  }, [sheet]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const ranked = useMemo(
    () => [...projectList].sort((a, b) => b.likes - a.likes),
    [projectList],
  );
  const filtered = ranked.filter(
    (p) =>
      (area === "Все" || p.area === area) &&
      [p.title, p.summary, p.author].some((v) =>
        v
          .toLocaleLowerCase("ru")
          .includes(query.toLocaleLowerCase("ru").trim()),
      ),
  );
  const project = projectList.find((p) => p.id === route.id) || projectList[0];
  const like = (id: string) => {
    const selected = likes.includes(id);
    setLikes((current) =>
      selected ? current.filter((v) => v !== id) : [...current, id],
    );
    setProjectList((current) =>
      current.map((p) =>
        p.id === id ? { ...p, likes: p.likes + (selected ? -1 : 1) } : p,
      ),
    );
  };
  const open = (p: Project) => go("project", p.id);
  const permissions =
    role === "Партнёр"
      ? ["Переданные инициативы"]
      : role === "Председатель"
        ? ["База отделения", "Реализации"]
        : [
            "Заявки",
            "База отделения",
            "Реализации",
            ...(role === "Администратор"
              ? ["Пользователи", "Главная страница"]
              : []),
          ];
  const currentTab = permissions.includes(tab) ? tab : permissions[0];
  const showBoard = () => {
    setQuery("");
    setArea("Все");
    go("board");
  };
  const changeRole = (value: Role) => {
    setRole(value);
    setTab(
      value === "Партнёр"
        ? "Переданные инициативы"
        : value === "Председатель"
          ? "База отделения"
          : "Заявки",
    );
  };
  const navItems = [
    { id: "home", label: "Главная" },
    { id: "board", label: "Инициативы" },
    { id: "submit", label: "Предложить идею" },
  ];
  const card = (p: Project) => (
    <ProjectCard
      key={p.id}
      project={p}
      onOpen={() => open(p)}
      onLike={() => like(p.id)}
      liked={likes.includes(p.id)}
    />
  );
  const formSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRequests((current) => [
      {
        id: "demo-" + Date.now(),
        name: String(form.get("author")),
        title: String(form.get("title")),
        area: String(form.get("area")) as Area,
        state: "Новая",
        when: "Только что",
      },
      ...current,
    ]);
    setSent(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="prototype-note">
        <span>Новый взгляд на Первик</span>
        <span>Интерактивный прототип · демо-данные</span>
      </div>
      <a className="skip-link" href="#content">
        Перейти к содержимому
      </a>
      <header className="site-header">
        <Mark onClick={() => go("home")} />
        <MotionNav
          items={navItems}
          active={route.view === "project" ? "board" : route.view}
          onChange={(id) => (id === "board" ? showBoard() : go(id as View))}
          label="Главная навигация"
        />
        <div className="header-actions">
          <button
            className="cabinet-link"
            onClick={() => go("login")}
            type="button"
          >
            Личный кабинет <LogIn size={18} />
          </button>
          <button
            className="menu-button"
            type="button"
            aria-label={menu ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <AnimatePresence>
        {menu && (
          <motion.nav
            id="mobile-menu"
            className="mobile-menu"
            aria-label="Меню телефона"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {[...navItems, { id: "login", label: "Личный кабинет" }].map(
              (item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id as View)}
                  type="button"
                >
                  {item.label}
                  <Arrow />
                </button>
              ),
            )}
          </motion.nav>
        )}
      </AnimatePresence>

      <main id="content" tabIndex={-1}>
        {route.view === "home" && (
          <>
            <section className="hero">
              <div className="hero-location">
                <span>Совет Первых Екатеринбурга</span>
                <span>Идеи ребят. Общее дело.</span>
              </div>
              <h1 tabIndex={-1}>
                <motion.span
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  Твой город.
                </motion.span>
                <motion.span
                  className="red"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  Твои идеи.
                </motion.span>
              </h1>
              <div className="hero-bottom">
                <p>
                  Место, где «а что, если»
                  <br />
                  становится «мы сделали».
                </p>
                <div>
                  <Action
                    onClick={() => {
                      setSent(false);
                      go("submit");
                    }}
                  >
                    Предложить идею <Arrow />
                  </Action>
                  <button
                    type="button"
                    className="plain-link"
                    onClick={showBoard}
                  >
                    Найти своё дело <ArrowRight size={18} />
                  </button>
                </div>
              </div>
              <a
                className="scroll-cue"
                href="#opportunities"
                aria-label="Узнать о возможностях"
              >
                <ArrowDown size={19} /> Листай, чтобы найти своё
              </a>
            </section>
            <section
              id="opportunities"
              className="editorial-intro"
              tabIndex={-1}
            >
              <div className="intro-heading">
                <h2>
                  Начинается с одного.
                  <br />
                  <span>Получается вместе.</span>
                </h2>
                <p>
                  Ты предлагаешь идею. Совет помогает найти команду и поддержку.
                  Вместе вы делаете то, что важно для школы и города.
                </p>
              </div>
              <div className="community-photo">
                <img
                  src={communityUrl}
                  alt="Участники Движения Первых вместе"
                  width="1600"
                  height="900"
                  loading="lazy"
                />
                <span>Есть место каждому.</span>
              </div>
              <div className="intro-links">
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    go("submit");
                  }}
                >
                  <strong>У меня есть идея</strong>
                  <span>Расскажи, что хочется изменить</span>
                  <Arrow />
                </button>
                <button type="button" onClick={showBoard}>
                  <strong>Хочу быть полезным</strong>
                  <span>Найди команду по интересам</span>
                  <Arrow />
                </button>
                <button type="button" onClick={() => setSheet("tracking")}>
                  <strong>Уже сделал первый шаг</strong>
                  <span>Посмотри, что с твоей заявкой</span>
                  <Arrow />
                </button>
              </div>
            </section>
            <section className="home-projects">
              <div className="section-head">
                <h2>
                  Дела, к которым
                  <br />
                  хочется присоединиться.
                </h2>
                <button
                  type="button"
                  className="plain-link"
                  onClick={showBoard}
                >
                  Все инициативы <Arrow />
                </button>
              </div>
              <div className="project-grid">{ranked.slice(0, 3).map(card)}</div>
            </section>
            <section className="journey">
              <div>
                <h2>
                  От идеи
                  <br />
                  до общего дела.
                </h2>
                <p>
                  Не нужен готовый проект.
                  <br />
                  Достаточно того, что тебе не всё равно.
                </p>
                <Action
                  kind="secondary"
                  onClick={() => {
                    setSent(false);
                    go("submit");
                  }}
                >
                  Начать с идеи <Arrow />
                </Action>
              </div>
              <ol>
                {[
                  ["Расскажи", "Коротко опиши идею и кому она поможет."],
                  [
                    "Получи ответ",
                    "Совет рассмотрит предложение и подскажет следующий шаг.",
                  ],
                  ["Найди своих", "Собери команду и договорись о поддержке."],
                  ["Сделай", "Реализуй задуманное и поделись результатом."],
                ].map(([title, text]) => (
                  <li key={title}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <ArrowRight size={22} />
                  </li>
                ))}
              </ol>
            </section>
            <section className="questions">
              <h2>Прежде чем начать.</h2>
              <div>
                {[
                  [
                    "Можно без аккаунта?",
                    "Да. Предложить идею и откликнуться можно без регистрации. После отправки заявки сохрани личный код для просмотра ответа.",
                  ],
                  [
                    "Идея должна быть готовым проектом?",
                    "Нет. Начни с того, что хочется изменить и кому это поможет. Детали можно доработать вместе с командой.",
                  ],
                  [
                    "Кто увидит мои контакты?",
                    "Контакты нужны команде для связи. На публичной доске показываются автор и описание инициативы.",
                  ],
                  [
                    "Можно провести проект в своей школе?",
                    "Председатель может предложить школьную реализацию. Руководство Совета и активисты с соответствующим статусом могут также предложить городскую.",
                  ],
                ].map(([q, a]) => (
                  <details key={q}>
                    <summary>
                      {q}
                      <Plus size={19} />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}

        {route.view === "board" && (
          <section className="catalog page-pad">
            <div className="page-heading">
              <div>
                <p className="context-label">Инициативы Екатеринбурга</p>
                <h1 tabIndex={-1}>
                  Идеи для <span>города.</span>
                </h1>
              </div>
              <p>
                Поддержи идею сердцем
                <br />
                или стань частью команды.
              </p>
            </div>
            <div className="catalog-tools">
              <label className="search-box">
                <Search size={20} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Идея, автор или интерес"
                  aria-label="Поиск инициатив"
                />
              </label>
              <span className="result-count">Найдено: {filtered.length}</span>
            </div>
            <div className="filter-row" aria-label="Направления">
              {areas.map((a) => (
                <button
                  type="button"
                  key={a}
                  aria-pressed={area === a}
                  onClick={() => setArea(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="board-explainer">
              <span>Выше — идеи с большей поддержкой</span>
              <Heart size={15} />
            </div>
            <LayoutGroup>
              <motion.div className="project-grid catalog-grid">
                {filtered.map((p) => (
                  <motion.div
                    key={p.id}
                    layout={reduce ? false : "position"}
                    transition={{ type: "spring", stiffness: 340, damping: 34 }}
                  >
                    {card(p)}
                  </motion.div>
                ))}
              </motion.div>
            </LayoutGroup>
            {!filtered.length && (
              <div className="empty-state">
                <Search size={30} />
                <h2>Пока ничего не нашлось</h2>
                <p>Попробуй другое слово или направление.</p>
                <Action
                  kind="secondary"
                  onClick={() => {
                    setArea("Все");
                    setQuery("");
                  }}
                >
                  Сбросить поиск <ArrowRight size={18} />
                </Action>
              </div>
            )}
          </section>
        )}

        {route.view === "project" && (
          <section className="project-page page-pad">
            <button type="button" className="back-link" onClick={showBoard}>
              <ArrowLeft size={18} />
              Все инициативы
            </button>
            <div className="detail-layout">
              <div className="detail-story">
                <div className="detail-tags">
                  <span>{project.area}</span>
                  <span>{project.status}</span>
                </div>
                <h1 tabIndex={-1}>{project.title}</h1>
                <p className="detail-lead">{project.summary}</p>
                <ProjectArt type={project.art} large />
                <div className="story-section">
                  <h2>Что хотим сделать</h2>
                  <p>
                    {project.summary} Начнём с небольшой команды, вместе выберем
                    дату и распределим задачи. Для участия не нужен опыт — важно
                    желание быть полезным.
                  </p>
                </div>
                <div className="project-facts">
                  <div>
                    <MapPin size={21} />
                    <span>
                      <strong>{project.school}</strong>Екатеринбург · школьная
                      реализация
                    </span>
                  </div>
                  <div>
                    <Users size={21} />
                    <span>
                      <strong>Открыто каждому</strong>Можно прийти вместе с
                      друзьями
                    </span>
                  </div>
                </div>
                <div className="implementation-preview">
                  <h2>Где идея оживает</h2>
                  <span className="status-text">
                    <span />В работе
                  </span>
                  <h3>
                    {implemented
                      ? level === "Город"
                        ? "Городская реализация"
                        : "Новая школьная реализация"
                      : project.school}
                  </h3>
                  <p>
                    Ответственный: Егор Соколов
                    <br />
                    После проведения здесь появятся отчёт и результаты.
                  </p>
                  <button
                    type="button"
                    className="plain-link"
                    onClick={() => setSheet("implement")}
                  >
                    Предложить реализацию <Arrow />
                  </button>
                </div>
              </div>
              <aside className="join-panel">
                <p className="context-label">Будем делать вместе</p>
                <h2>
                  Здесь ждут <br />
                  именно тебя.
                </h2>
                <p>{project.need}</p>
                <div className="team-progress">
                  <div>
                    <span>Команда собирается</span>
                    <strong>
                      {project.people}/{project.goal}
                    </strong>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${(project.people / project.goal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <Action onClick={() => setSheet("join")}>
                  {joined.includes(project.id)
                    ? "Посмотреть мой отклик"
                    : "Хочу помочь"}{" "}
                  <Arrow />
                </Action>
                <Action kind="secondary" onClick={() => like(project.id)}>
                  <Heart
                    size={18}
                    fill={likes.includes(project.id) ? "currentColor" : "none"}
                  />
                  Поддержать · {project.likes}
                </Action>
                <div className="join-author">
                  <span className="person-avatar">
                    {project.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <span>
                    <strong>{project.author}</strong>
                    <small>Автор идеи</small>
                  </span>
                </div>
                <p className="small-copy">
                  Ответственный рассмотрит отклик и расскажет о следующем шаге.
                </p>
                <button
                  className="plain-link share-link"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(location.href)
                      .then(() => setNotice("Ссылка скопирована"))
                      .catch(() =>
                        setNotice(
                          "Ссылку можно скопировать из адресной строки",
                        ),
                      );
                  }}
                >
                  Поделиться инициативой <Arrow />
                </button>
              </aside>
            </div>
          </section>
        )}

        {route.view === "login" && (
          <section className="login-page page-pad">
            <div className="login-statement">
              <p className="context-label">Личный кабинет</p>
              <h1 tabIndex={-1}>
                Когда мы
                <br />
                <span>в команде.</span>
              </h1>
              <p>
                Заявки, инициативы и люди.
                <br />
                Всё, чтобы двигать общее дело.
              </p>
              <img src={logoUrl} alt="Первик" width="170" height="126" />
            </div>
            <div className="login-form">
              <h2>Добро пожаловать.</h2>
              <p>Выбери роль, чтобы посмотреть кабинет в новом дизайне.</p>
              <div className="role-grid">
                {(
                  [
                    "Администратор",
                    "Куратор",
                    "Председатель",
                    "Партнёр",
                  ] as Role[]
                ).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => changeRole(r)}
                    aria-pressed={r === role}
                  >
                    {r}
                    {r === role && <Check size={17} />}
                  </button>
                ))}
              </div>
              <div className="demo-callout">
                Это демо-вход. Логин и пароль не нужны.
                <br />
                Реальная авторизация остаётся в основной платформе.
              </div>
              <Action onClick={() => go("cabinet")}>
                Открыть кабинет <Arrow />
              </Action>
              <button
                className="plain-link"
                type="button"
                onClick={() => go("home")}
              >
                <ArrowLeft size={17} />
                Вернуться на главную
              </button>
            </div>
          </section>
        )}

        {route.view === "submit" && (
          <section className="submit-page page-pad">
            <div className="form-intro">
              <p className="context-label">Новая инициатива</p>
              <h1 tabIndex={-1}>
                А что,
                <br />
                <span>если?..</span>
              </h1>
              <p>
                У каждой перемены был момент,
                <br />
                когда кто-то просто предложил.
              </p>
              <div className="form-note">
                <span>Три простых вопроса.</span>
                <p>
                  Что хочется сделать?
                  <br />
                  Кому это поможет?
                  <br />
                  Кто нужен в команду?
                </p>
              </div>
            </div>
            {sent ? (
              <div className="submitted">
                <CheckCircle2 size={45} />
                <h2 tabIndex={-1}>Первый шаг сделан.</h2>
                <p>
                  Демо-заявка появилась в кабинете. В настоящем сервисе здесь
                  будет личный код для проверки ответа.
                </p>
                <Action
                  onClick={() => {
                    changeRole("Администратор");
                    go("cabinet");
                  }}
                >
                  Посмотреть заявку <Arrow />
                </Action>
                <button
                  className="plain-link"
                  onClick={() => setSent(false)}
                  type="button"
                >
                  Предложить ещё идею
                </button>
              </div>
            ) : (
              <form className="idea-form" onSubmit={formSubmit}>
                <h2>Расскажи о своей идее.</h2>
                <p className="small-copy">
                  Прототип: используй вымышленные данные. Форма ничего не
                  отправляет на сервер.
                </p>
                <label>
                  Как назовём идею?
                  <input
                    name="title"
                    required
                    minLength={4}
                    maxLength={100}
                    placeholder="Например, обмен книгами после уроков"
                  />
                </label>
                <fieldset>
                  <legend>В какой области?</legend>
                  <div className="form-areas">
                    {areas
                      .filter((a) => a !== "Все")
                      .map((a, i) => (
                        <label key={a}>
                          <input
                            type="radio"
                            name="area"
                            value={a}
                            defaultChecked={i === 0}
                          />
                          <span>{a}</span>
                        </label>
                      ))}
                  </div>
                </fieldset>
                <label>
                  Что хочешь сделать и кому это поможет?
                  <textarea
                    name="description"
                    required
                    minLength={15}
                    maxLength={2000}
                    rows={4}
                    placeholder="Не нужно сложных формулировок. Просто расскажи о задумке."
                  />
                </label>
                <label>
                  Как тебя зовут?
                  <input
                    name="author"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Демо-имя и фамилия"
                    autoComplete="off"
                  />
                </label>
                <label className="check-line">
                  <input type="checkbox" required />
                  <span>Понимаю, что это демонстрационная заявка.</span>
                </label>
                <Action type="submit">
                  Отправить идею <Send size={18} />
                </Action>
              </form>
            )}
          </section>
        )}

        {route.view === "cabinet" && (
          <div className="cabinet-shell">
            <aside className="cabinet-sidebar">
              <span className="workspace-name">Совет Екатеринбурга</span>
              <nav aria-label="Разделы кабинета">
                {permissions.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={currentTab === p ? "selected" : ""}
                    onClick={() => {
                      setTab(p);
                      setQuery("");
                    }}
                  >
                    {p}
                    <ChevronRight size={15} />
                  </button>
                ))}
              </nav>
              <div className="sidebar-person">
                <span className="person-avatar">ЕC</span>
                <div>
                  <strong>Егор Соколов</strong>
                  <span>{role}</span>
                </div>
              </div>
            </aside>
            <section className="cabinet-content">
              <div className="cabinet-top">
                <div>
                  <p className="context-label">Рабочее пространство</p>
                  <h1 tabIndex={-1}>{currentTab}</h1>
                </div>
                <label className="role-select">
                  <span>Демо-роль</span>
                  <select
                    value={role}
                    onChange={(e) => changeRole(e.target.value as Role)}
                  >
                    {(
                      [
                        "Администратор",
                        "Куратор",
                        "Председатель",
                        "Партнёр",
                      ] as Role[]
                    ).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mobile-cabinet-tabs">
                {permissions.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setTab(p)}
                    aria-pressed={currentTab === p}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {currentTab === "Заявки" ? (
                <>
                  <div className="cabinet-summary">
                    <span>
                      <strong>
                        {requests.filter((r) => r.state === "Новая").length}
                      </strong>
                      ждут ответа
                    </span>
                    <span>
                      <strong>
                        {
                          requests.filter((r) => r.state === "На доработке")
                            .length
                        }
                      </strong>
                      на доработке
                    </span>
                    <span>
                      <strong>
                        {requests.filter((r) => r.state === "Принята").length}
                      </strong>
                      принято
                    </span>
                  </div>
                  <div className="inbox-heading">
                    <h2>Каждая идея заслуживает ответа.</h2>
                    <p>
                      Раскрой заявку, чтобы посмотреть детали и принять решение.
                    </p>
                  </div>
                  <label className="search-box">
                    <Search size={18} />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Найти заявку или автора"
                      aria-label="Поиск заявок"
                    />
                  </label>
                  <div className="request-list">
                    {requests
                      .filter((r) =>
                        (r.name + " " + r.title)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((r) => (
                        <ExpandableRow
                          key={r.id}
                          id={r.id}
                          title={r.title}
                          subtitle={r.name}
                          aside={
                            <span className={"request-state state-" + r.state}>
                              {r.state}
                            </span>
                          }
                        >
                          <p className="small-copy">
                            {r.area} · {r.when}
                          </p>
                          <p>
                            Автор предлагает собрать школьную команду и провести
                            полезное дело для ребят. Следующий шаг — уточнить
                            площадку и необходимую поддержку.
                          </p>
                          <div className="request-decisions">
                            <Action
                              onClick={() => {
                                setRequests((current) =>
                                  current.map((item) =>
                                    item.id === r.id
                                      ? { ...item, state: "Принята" }
                                      : item,
                                  ),
                                );
                                setNotice("Решение сохранено в демо");
                              }}
                            >
                              Принять <Check size={17} />
                            </Action>
                            <Action
                              kind="secondary"
                              onClick={() => {
                                setRequests((current) =>
                                  current.map((item) =>
                                    item.id === r.id
                                      ? { ...item, state: "На доработке" }
                                      : item,
                                  ),
                                );
                                setNotice(
                                  "Демо-заявка отправлена на доработку",
                                );
                              }}
                            >
                              На доработку
                            </Action>
                          </div>
                        </ExpandableRow>
                      ))}
                  </div>
                  {!requests.some((r) =>
                    (r.name + " " + r.title)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  ) && (
                    <div className="empty-state">
                      <h2>Нет заявок по этому запросу</h2>
                      <button
                        className="plain-link"
                        type="button"
                        onClick={() => setQuery("")}
                      >
                        Очистить поиск
                      </button>
                    </div>
                  )}
                </>
              ) : currentTab === "База отделения" ? (
                <>
                  <p className="cabinet-description">
                    Участники, партнёры и инициативы — в одном рабочем
                    пространстве.
                  </p>
                  <div className="base-switch">
                    <button
                      type="button"
                      onClick={() => setNotice("В демо показан общий список")}
                    >
                      Участники и партнёры
                    </button>
                    <button type="button" onClick={showBoard}>
                      Все инициативы <Arrow />
                    </button>
                  </div>
                  {projectList.map((p) => (
                    <div className="directory-row" key={p.id}>
                      <span className="person-avatar">
                        {p.author
                          .split(" ")
                          .map((s) => s[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>{p.author}</strong>
                        <small>{p.school}</small>
                      </span>
                      <span className="directory-area">{p.area}</span>
                      <button
                        type="button"
                        className="icon-control"
                        aria-label={"Открыть " + p.title}
                        onClick={() => open(p)}
                      >
                        <Arrow />
                      </button>
                    </div>
                  ))}
                </>
              ) : currentTab === "Реализации" ||
                currentTab === "Переданные инициативы" ? (
                <>
                  <p className="cabinet-description">
                    {role === "Партнёр"
                      ? "Совет направил эти идеи, чтобы обсудить вашу поддержку."
                      : "Следующий шаг проекта — команда, площадка и подтверждённый результат."}
                  </p>
                  <div className="cabinet-projects">
                    {projectList
                      .slice(0, role === "Партнёр" ? 2 : 3)
                      .map((p) => (
                        <div className="implementation-row" key={p.id}>
                          <ProjectArt type={p.art} />
                          <div>
                            <span className="context-label">{p.status}</span>
                            <h2>{p.title}</h2>
                            <p>{p.need}</p>
                            <button
                              className="plain-link"
                              type="button"
                              onClick={() => open(p)}
                            >
                              Открыть проект <Arrow />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              ) : currentTab === "Пользователи" ? (
                <>
                  <p className="cabinet-description">
                    Видимость разделов зависит от роли. Переключи демо-роль
                    сверху, чтобы увидеть различия.
                  </p>
                  {(
                    [
                      "Администратор",
                      "Куратор",
                      "Председатель",
                      "Партнёр",
                    ] as Role[]
                  ).map((r, i) => (
                    <div className="directory-row" key={r}>
                      <span className="person-avatar">
                        {["АИ", "МК", "ЕС", "ПК"][i]}
                      </span>
                      <span>
                        <strong>
                          {
                            [
                              "Александр Ильин",
                              "Мария Ковалёва",
                              "Егор Соколов",
                              "Партнёрская команда",
                            ][i]
                          }
                        </strong>
                        <small>{r}</small>
                      </span>
                      <button
                        type="button"
                        className="plain-link"
                        onClick={() => changeRole(r)}
                      >
                        Посмотреть роль <Arrow />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="homepage-demo">
                  <h2>Идеям нужна команда.</h2>
                  <p>
                    В подборке на главной — три инициативы. В этой версии
                    прототипа редактор представлен превью подборки.
                  </p>
                  <div className="cabinet-projects">
                    {projectList.slice(0, 3).map((p) => (
                      <button type="button" key={p.id} onClick={() => open(p)}>
                        <span>{p.area}</span>
                        <strong>{p.title}</strong>
                        <Arrow />
                      </button>
                    ))}
                  </div>
                  <Action kind="secondary" onClick={() => go("home")}>
                    Открыть главную <Arrow />
                  </Action>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {route.view !== "cabinet" &&
        route.view !== "login" &&
        route.view !== "submit" && (
          <footer className="site-footer">
            <div className="footer-top">
              <h2>
                Город делают люди.
                <br />
                <span>Такие, как ты.</span>
              </h2>
              <Action
                onClick={() => {
                  setSent(false);
                  go("submit");
                }}
              >
                Предложить идею <Arrow />
              </Action>
            </div>
            <div className="footer-links">
              <span>Совет Первых Екатеринбурга</span>
              <a
                href="https://vk.ru/mypervie96_ekb"
                target="_blank"
                rel="noreferrer"
              >
                ВКонтакте <Arrow />
              </a>
              <a
                href="https://будьвдвижении.рф"
                target="_blank"
                rel="noreferrer"
              >
                Движение Первых <Arrow />
              </a>
              <button type="button" onClick={() => go("login")}>
                Вход для команды <Arrow />
              </button>
            </div>
            <div className="footer-word" aria-hidden="true">
              первик.
            </div>
            <p className="footer-note">
              Концепция интерфейса · 2026 · Все проекты и участники в этом
              прототипе вымышлены.
            </p>
          </footer>
        )}
      <nav
        className={
          "phone-bottom" +
          (route.view === "home" && !showPhoneNav ? " is-hidden" : "")
        }
        aria-label="Быстрая навигация"
        aria-hidden={route.view === "home" && !showPhoneNav}
        inert={route.view === "home" && !showPhoneNav}
      >
        {[
          { v: "home", label: "Главная", icon: Home },
          { v: "board", label: "Идеи", icon: Search },
          { v: "submit", label: "Создать", icon: Plus },
          { v: "login", label: "Кабинет", icon: LayoutDashboard },
        ].map(({ v, label, icon: Icon }) => (
          <button
            type="button"
            key={v}
            aria-current={route.view === v ? "page" : undefined}
            onClick={() => {
              if (v === "submit") setSent(false);
              go(v as View);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <AnimatePresence>
        {notice && (
          <motion.div
            className="toast"
            role="status"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle2 size={18} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
      <dialog
        ref={dialog}
        className="demo-dialog"
        onCancel={() => setSheet(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setSheet(null);
        }}
      >
        <div className="dialog-content">
          <button
            type="button"
            className="dialog-close icon-control"
            onClick={() => setSheet(null)}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
          {sheet === "join" ? (
            <>
              <p className="context-label">Присоединиться к команде</p>
              <h2>
                {joined.includes(project.id)
                  ? "Твой отклик на месте."
                  : "Давай делать вместе."}
              </h2>
              <p>
                {joined.includes(project.id)
                  ? "В настоящем сервисе ответственный рассмотрит отклик и свяжется с тобой."
                  : `Проект «${project.title}». Нужны: ${project.need.toLowerCase()}.`}
              </p>
              <div className="demo-callout">
                Демонстрационный отклик. Контакты не собираются.
              </div>
              <Action
                onClick={() => {
                  setJoined((current) =>
                    current.includes(project.id)
                      ? current
                      : [...current, project.id],
                  );
                  setSheet(null);
                  setNotice("Демо-отклик сохранён");
                }}
              >
                {joined.includes(project.id)
                  ? "Всё понятно"
                  : "Отправить отклик"}{" "}
                <Check size={18} />
              </Action>
            </>
          ) : sheet === "implement" ? (
            <>
              <p className="context-label">Реализация инициативы</p>
              <h2>
                Идея может
                <br />
                стать общим делом.
              </h2>
              <label className="dialog-label">
                Демо-статус
                <select
                  value={role}
                  onChange={(e) => changeRole(e.target.value as Role)}
                >
                  {(
                    [
                      "Администратор",
                      "Куратор",
                      "Председатель",
                      "Партнёр",
                    ] as Role[]
                  ).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              {role === "Партнёр" ? (
                <p>
                  Партнёр поддерживает инициативы. Реализацию предлагает
                  ответственный из Совета.
                </p>
              ) : (
                <>
                  <label className="dialog-label">
                    Где реализуем?
                    <select
                      value={role === "Председатель" ? "Школа" : level}
                      onChange={(e) => setLevel(e.target.value)}
                    >
                      <option>Школа</option>
                      {role !== "Председатель" && <option>Город</option>}
                    </select>
                  </label>
                  <p className="small-copy">
                    В рабочем сервисе возможность городской реализации
                    определяется статусом участника Совета.
                  </p>
                  <Action
                    onClick={() => {
                      setImplemented(true);
                      if (role === "Председатель") setLevel("Школа");
                      setSheet(null);
                      setNotice("Предложение реализации добавлено в демо");
                    }}
                  >
                    Предложить реализацию <Arrow />
                  </Action>
                </>
              )}
            </>
          ) : (
            <>
              <p className="context-label">Моя заявка</p>
              <h2>
                Твой первый шаг
                <br />
                уже важен.
              </h2>
              <p>
                В настоящем сервисе здесь будет проверка по личному коду. В демо
                можно посмотреть, как заявка выглядит у команды.
              </p>
              <Action
                onClick={() => {
                  setSheet(null);
                  changeRole("Администратор");
                  go("cabinet");
                }}
              >
                Открыть демо-заявки <Arrow />
              </Action>
            </>
          )}
        </div>
      </dialog>
    </MotionConfig>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Prototype />
  </StrictMode>,
);
