# Настройка базы данных Supabase для Twitch Giveaway Bot

## Шаг 1: Создание проекта в Supabase

1. Перейдите на [https://supabase.io](https://supabase.io) и создайте аккаунт или войдите в существующий
2. Создайте новый проект:
   - Нажмите "New Project"
   - Выберите организацию или создайте новую
   - Введите имя проекта (например, "twitch-giveaway-bot")
   - Выберите регион
   - Введите пароль для базы данных
   - Нажмите "Create Project"

## Шаг 2: Получение учетных данных

После создания проекта вы получите доступ к панели управления. Перейдите в раздел "Settings" → "API" и найдите:

1. **Project URL** - это будет ваш `SUPABASE_URL`
2. **anon key** или **service role key** - это будет ваш `SUPABASE_KEY`

## Шаг 3: Создание таблицы winners

Перейдите в раздел "Table Editor" и создайте таблицу `winners` со следующей структурой:

### Структура таблицы winners

| Поле | Тип данных | Обязательное | Описание |
|------|------------|--------------|----------|
| id | SERIAL | Да | Уникальный идентификатор |
| username | VARCHAR(255) | Да | Имя пользователя победителя |
| channel | VARCHAR(255) | Да | Канал, где проводился розыгрыш |
| prize | TEXT | Нет | Приз, который выиграл пользователь |
| telegram | VARCHAR(255) | Нет | Telegram контакт победителя |
| win_time | TIMESTAMP WITH TIME ZONE | Да | Время победы |
| total_wins | INTEGER | Да (default: 1) | Общее количество побед пользователя |
| created_at | TIMESTAMP WITH TIME ZONE | Да | Время создания записи |

### SQL скрипт для создания таблицы

```sql
-- Создание таблицы winners
CREATE TABLE IF NOT EXISTS winners (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    channel VARCHAR(255) NOT NULL,
    prize TEXT,
    telegram VARCHAR(255),
    win_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_wins INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_winners_username ON winners(username);
CREATE INDEX IF NOT EXISTS idx_winners_channel ON winners(channel);
CREATE INDEX IF NOT EXISTS idx_winners_win_time ON winners(win_time);
```

## Шаг 4: Обновление файла .env

Откройте файл `.env` в корне проекта и обновите следующие переменные:

```env
# Supabase Database Credentials
SUPABASE_URL=ваш_урл_из_панели_supabase
SUPABASE_KEY=ваш_ключ_из_панели_supabase
```

## Шаг 5: Проверка подключения

После обновления файла .env перезапустите приложение:

```bash
npm start
```

Если все настроено правильно, приложение должно успешно подключиться к базе данных и начать работать с таблицей winners.