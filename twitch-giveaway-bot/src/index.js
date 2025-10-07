require('dotenv').config();

// Для Node.js версии ниже 18, импортируем fetch
if (!global.fetch) {
  const fetch = require('node-fetch');
  global.fetch = fetch;
}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');

// Импортируем модули бота и веб-интерфейса
const { initBot } = require('./bot/twitchBot');
const { initWebServer } = require('./web/webServer');
const { initDatabase } = require('./database/supabaseClient');

// Инициализация Express приложения
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint для Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Проверка переменных окружения
console.log('=== Environment Variables Check ===');
console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID ? 'SET' : 'NOT SET');
console.log('RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME ? 'SET' : 'NOT SET');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'SET' : 'NOT SET');
console.log('TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('==================================');

// Инициализация компонентов
try {
  const supabaseClient = initDatabase();
  if (!supabaseClient) {
    console.warn('Предупреждение: Ошибка инициализации базы данных. Приложение будет работать в тестовом режиме.');
  }
} catch (error) {
  console.warn('Предупреждение: Ошибка инициализации базы данных. Приложение будет работать в тестовом режиме.', error.message);
}

// Инициализируем бота с передачей ссылки на WebSocket сервер
try {
  initBot(io);
} catch (error) {
  console.warn('Предупреждение: Ошибка инициализации бота. Функции Twitch могут быть недоступны.', error.message);
}

try {
  initWebServer(app, io);
} catch (error) {
  console.error('Критическая ошибка инициализации веб-сервера:', error);
  process.exit(1);
}

// Обработка ошибок сервера
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Порт ${error.port} уже используется. Пожалуйста, освободите порт или измените PORT в переменных окружения.`);
    process.exit(1);
  } else {
    console.error('Ошибка сервера:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM. Завершение работы...');
  server.close(() => {
    console.log('Сервер остановлен.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT. Завершение работы...');
  server.close(() => {
    console.log('Сервер остановлен.');
    process.exit(0);
  });
});

// Запуск сервера с учетом переменных окружения Railway
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 3006;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('Переменные окружения:');
  console.log('  TWITCH_BOT_USERNAME:', process.env.TWITCH_BOT_USERNAME ? 'Установлен' : 'Не установлен');
  console.log('  TWITCH_OAUTH_TOKEN:', process.env.TWITCH_OAUTH_TOKEN ? 'Установлен' : 'Не установлен');
  console.log('  TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID ? 'Установлен' : 'Не установлен');
  console.log('  TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET ? 'Установлен' : 'Не установлен');
  console.log('  APP_URL:', process.env.APP_URL || 'Не установлен');
  console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? 'Установлен' : 'Не установлен');
  console.log('  SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Установлен' : 'Не установлен');
});