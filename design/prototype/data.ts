export type Area = "Все" | "События" | "Медиа" | "IT" | "Волонтёрство";
export type Role = "Администратор" | "Куратор" | "Председатель" | "Партнёр";
export type Project = {
  id: string;
  title: string;
  area: Area;
  summary: string;
  author: string;
  school: string;
  need: string;
  likes: number;
  status: string;
  people: number;
  goal: number;
  art: "plant" | "media" | "code" | "books";
};
export const areas: Area[] = ["Все", "События", "Медиа", "IT", "Волонтёрство"];
export const projects: Project[] = [
  {
    id: "green",
    title: "Двор, в котором хочется быть",
    area: "Волонтёрство",
    summary:
      "Превратим школьный двор в общее место: высадим растения и устроим встречу соседей.",
    author: "Анна Петрова",
    school: "Гимназия № 39",
    need: "Волонтёры и фотограф",
    likes: 42,
    status: "Нужна команда",
    people: 4,
    goal: 10,
    art: "plant",
  },
  {
    id: "stories",
    title: "Истории нашего города",
    area: "Медиа",
    summary:
      "Снимем короткие истории о людях, которые каждый день меняют Екатеринбург.",
    author: "Михаил Орлов",
    school: "Школьный медиасовет",
    need: "Фотограф и монтажёр",
    likes: 35,
    status: "Нужна команда",
    people: 3,
    goal: 5,
    art: "media",
  },
  {
    id: "bot",
    title: "Школьный совет на связи",
    area: "IT",
    summary:
      "Соберём события и возможности в одном помощнике, чтобы ребята ничего не пропускали.",
    author: "Иван Миронов",
    school: "Команда Первых",
    need: "Разработчик и дизайнер",
    likes: 28,
    status: "Ищем поддержку",
    people: 2,
    goal: 4,
    art: "code",
  },
  {
    id: "books",
    title: "Хорошие книги идут дальше",
    area: "События",
    summary:
      "Откроем обмен книгами и читательские встречи в школьной библиотеке.",
    author: "Мария Ковалёва",
    school: "Школьный совет",
    need: "Ведущие и волонтёры",
    likes: 19,
    status: "Нужна команда",
    people: 2,
    goal: 6,
    art: "books",
  },
];
export type RequestItem = {
  id: string;
  name: string;
  title: string;
  area: Area;
  state: "Новая" | "Принята" | "На доработке";
  when: string;
};
export const initialRequests: RequestItem[] = [
  {
    id: "a1",
    name: "Алина Смирнова",
    title: "Мастерская добрых вещей",
    area: "Волонтёрство",
    state: "Новая",
    when: "Сегодня, 10:24",
  },
  {
    id: "a2",
    name: "Егор Соколов",
    title: "Кино после уроков",
    area: "События",
    state: "Новая",
    when: "Сегодня, 09:15",
  },
  {
    id: "a3",
    name: "Софья Иванова",
    title: "Медиаэкспедиция по району",
    area: "Медиа",
    state: "На доработке",
    when: "Вчера, 16:40",
  },
  {
    id: "a4",
    name: "Артём Волков",
    title: "Цифровой помощник школьника",
    area: "IT",
    state: "Принята",
    when: "Вчера, 14:10",
  },
];
