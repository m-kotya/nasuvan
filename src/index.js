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
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint для Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Инициализация компонентов
const supabaseClient = initDatabase();
if (!supabaseClient) {
  console.error('Ошибка инициализации базы данных. Проверьте переменные окружения.');
  process.exit(1);
}

initBot(io);
initWebServer(app, io);

// Запуск сервера с учетом переменных окружения Railway
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});