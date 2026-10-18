import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, getInitials, filterBaseItems } from './auth.ts';

test('authenticate: missing local auth service does not grant access', async () => {
  await assert.rejects(authenticate('admin', 'admin'));
});

test('getInitials: generates correct 2-letter uppercase initials', () => {
  assert.equal(getInitials('Мария Ковалёва'), 'МК');
  assert.equal(getInitials('Илья Ильин'), 'ИИ');
  assert.equal(getInitials('Администратор'), 'АД');
  assert.equal(getInitials('Студия «Голос»'), 'С«');
});

test('filterBaseItems: correctly separates initiatives from regular base members', () => {
  const sample = [
    { name: 'Иван Иванов', isInitiative: false, category: 'Волонтёрство', description: 'Помощь на выездах' },
    { name: 'Подкаст Первых', isInitiative: true, category: 'Медиа', description: 'Запись подкастов' },
    { name: 'Хакатон ЕКБ', isInitiative: true, category: 'IT', description: 'Школьный хакатон' },
    { name: 'Анна Кузнецова', isInitiative: false, category: 'Мероприятия', description: 'Ведущая' },
  ];

  const nonInitiatives = filterBaseItems(sample, 'all_non_initiatives', 'all');
  assert.equal(nonInitiatives.length, 2);
  assert.equal(nonInitiatives[0].name, 'Иван Иванов');
  assert.equal(nonInitiatives[1].name, 'Анна Кузнецова');

  const onlyInitiatives = filterBaseItems(sample, 'only_initiatives', 'all');
  assert.equal(onlyInitiatives.length, 2);
  assert.equal(onlyInitiatives[0].name, 'Подкаст Первых');
  assert.equal(onlyInitiatives[1].name, 'Хакатон ЕКБ');

  // Filter by category
  const itInitiatives = filterBaseItems(sample, 'only_initiatives', 'IT');
  assert.equal(itInitiatives.length, 1);
  assert.equal(itInitiatives[0].name, 'Хакатон ЕКБ');
});
