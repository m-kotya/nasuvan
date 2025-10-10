# Twitch Giveaway Bot

Twitch бот для проведения розыгрышей с сохранением данных в Supabase.

## Настройка

### Переменные окружения

Для работы приложения необходимо настроить следующие переменные окружения:

#### Основные переменные для работы бота:
- `TWITCH_BOT_USERNAME` - Имя пользователя бота в Twitch
- `TWITCH_OAUTH_TOKEN` - OAuth токен бота (см. https://twitchapps.com/tmi/)
- `TWITCH_CLIENT_ID` - Client ID приложения Twitch
- `TWITCH_CLIENT_SECRET` - Client Secret приложения Twitch
- `APP_URL` - URL вашего приложения (например: https://your-app.railway.app)
- `SUPABASE_URL` - URL базы данных Supabase
- `SUPABASE_KEY` - Ключ доступа к базе данных Supabase

#### Переменные для входа в админку:
- `ADMIN_USERNAME` - Логин для входа в админку (по умолчанию: admin)
- `ADMIN_PASSWORD` - Пароль для входа в админку (по умолчанию: password)

#### Railway переменные:
- `PORT` - Порт для запуска приложения (по умолчанию: 3006)
- `RAILWAY_PROJECT_ID` - ID проекта Railway (устанавливается автоматически)
- `RAILWAY_ENVIRONMENT_NAME` - Название окружения Railway (устанавливается автоматически)

### Настройка базы данных Supabase

Подробная инструкция по настройке базы данных Supabase находится в файле [SUPABASE_SETUP.md](file:///C:/Users/D/Desktop/Giveway%20Bot/twitch-giveaway-bot/SUPABASE_SETUP.md).

Основные шаги:
1. Создайте проект в Supabase
2. Получите URL и ключ доступа к базе данных
3. Создайте таблицу `winners` с правильной структурой
4. Обновите переменные окружения в файле `.env`

### Настройка на Railway

1. Создайте новый проект на [Railway](https://railway.app/)
2. Подключите репозиторий с ботом
3. В настройках проекта Railway добавьте все необходимые переменные окружения:
   - Перейдите в ваш проект Railway
   - Нажмите на "Settings" (Настройки)
   - Выберите вкладку "Variables" (Переменные)
   - Добавьте переменные окружения, нажав кнопку "New Variable" (Новая переменная)
   - Пример добавления переменной `ADMIN_USERNAME`:
     - Name: `ADMIN_USERNAME`
     - Value: `ваш_логин` (например, `myadmin`)
   - Пример добавления переменной `ADMIN_PASSWORD`:
     - Name: `ADMIN_PASSWORD`
     - Value: `ваш_пароль` (например, `mypassword123`)
4. Разверните приложение

### Локальный запуск

1. Установите зависимости:
   ```
   npm install
   ```

2. Создайте файл `.env` в корне проекта с необходимыми переменными окружения:
   ```
   TWITCH_BOT_USERNAME=your_bot_username
   TWITCH_OAUTH_TOKEN=your_oauth_token
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   APP_URL=http://localhost:3006
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=password
   ```

   Или используйте файл [.env.example](file:///C:/Users/D/Desktop/Giveway%20Bot/twitch-giveaway-bot/.env.example) как шаблон:
   ```
   cp .env.example .env
   # Затем отредактируйте .env файл
   ```

3. Запустите приложение:
   ```
   npm start
   ```

   Или для разработки:
   ```
   npm run dev
   ```

## Решение проблем

### Проблема: Не работает вход через логин и пароль

**Причина:** Отсутствовал middleware `express.urlencoded()` для обработки данных формы.

**Решение:** В файл [src/index.js](file:///C:/Users/D/Desktop/Giveway%20Bot/twitch-giveaway-bot/src/index.js) добавлена строка:
```javascript
app.use(express.urlencoded({ extended: true }));
```

Это middleware необходимо для корректной обработки данных, отправленных через HTML форму методом POST.

### Проблема: Не отображаются все победители

**Причина:** Неправильная структура таблицы `winners` в базе данных Supabase.

**Решение:** Убедитесь, что таблица `winners` создана с правильной структурой, как описано в [SUPABASE_SETUP.md](file:///C:/Users/D/Desktop/Giveway%20Bot/twitch-giveaway-bot/SUPABASE_SETUP.md).

### Проверка переменных окружения

Для проверки установленных переменных окружения используйте команду:
```
npm run check-env
```

## Использование

1. Откройте приложение в браузере
2. Авторизуйтесь используя логин и пароль, установленные в переменных окружения
3. После успешной аутентификации вы будете автоматически переадресованы на авторизацию Twitch
4. Подтвердите авторизацию в Twitch для подключения к вашему каналу
5. Введите кодовое слово для розыгрыша и нажмите "Начать розыгрыш"
6. Участники могут участвовать, отправляя кодовое слово в чат
7. Нажмите "Завершить розыгрыш" для выбора победителя

## API

- `POST /api/start-giveaway` - Начать розыгрыш
- `POST /api/end-giveaway` - Завершить розыгрыш
- `GET /api/winners` - Получить список победителей