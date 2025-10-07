-- Создание таблицы победителей
CREATE TABLE IF NOT EXISTS winners (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  win_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_wins INTEGER DEFAULT 1,
  telegram VARCHAR(255),
  channel VARCHAR(255) NOT NULL,
  prize TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индексы для ускорения поиска
CREATE INDEX IF NOT EXISTS idx_winners_username ON winners(username);
CREATE INDEX IF NOT EXISTS idx_winners_channel ON winners(channel);
CREATE INDEX IF NOT EXISTS idx_winners_win_time ON winners(win_time);

-- Добавляем комментарии к таблице и столбцам
COMMENT ON TABLE winners IS 'Таблица победителей розыгрышей';
COMMENT ON COLUMN winners.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN winners.username IS 'Имя пользователя Twitch победителя';
COMMENT ON COLUMN winners.win_time IS 'Время победы';
COMMENT ON COLUMN winners.total_wins IS 'Общее количество побед пользователя';
COMMENT ON COLUMN winners.telegram IS 'Telegram победителя';
COMMENT ON COLUMN winners.channel IS 'Канал, на котором была проведена игра';
COMMENT ON COLUMN winners.prize IS 'Приз, который выиграл пользователь';
COMMENT ON COLUMN winners.created_at IS 'Время создания записи';