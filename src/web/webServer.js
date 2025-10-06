const path = require('path');
const crypto = require('crypto');
const { getGiveaways, createGiveaway, selectWinner } = require('../database/supabaseClient');
const { joinChannel, leaveChannel } = require('../bot/twitchBot');

// Хранение активных розыгрышей в памяти (в реальном приложении лучше использовать БД)
let activeGiveaways = new Map();
// Хранение информации о сессиях пользователей
let userSessions = new Map();

// Функция для генерации безопасного sessionId
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Функция для обновления access token через refresh token
async function refreshAccessToken(refreshToken) {
  try {
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${JSON.stringify(tokenData)}`);
    }
    
    return tokenData;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

function initWebServer(app, io) {
  // Маршрут для главной страницы
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  // Маршрут для начала авторизации через Twitch
  app.get('/auth/twitch', (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const appUrl = process.env.APP_URL;
    
    // Нормализуем APP_URL - убираем слеш в конце если есть
    const normalizedAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    const redirectUri = `${normalizedAppUrl}/auth/twitch/callback`;
    
    console.log('=== Twitch OAuth Authorization Request ===');
    console.log('Environment variables:');
    console.log('  TWITCH_CLIENT_ID:', clientId ? 'SET' : 'NOT SET');
    console.log('  APP_URL:', appUrl || 'NOT SET');
    console.log('  Normalized APP_URL:', normalizedAppUrl);
    console.log('  Calculated redirectUri:', redirectUri);
    
    // Проверяем обязательные переменные окружения
    if (!clientId) {
      console.error('TWITCH_CLIENT_ID is not set');
      return res.status(500).send(`
        <h2>Ошибка конфигурации</h2>
        <p>TWITCH_CLIENT_ID не установлен.</p>
        <p>Пожалуйста, установите правильное значение в переменных окружения Railway.</p>
        <a href="/">Вернуться на главную</a>
      `);
    }
    
    if (!appUrl) {
      console.error('APP_URL is not set');
      return res.status(500).send(`
        <h2>Ошибка конфигурации</h2>
        <p>APP_URL не установлен.</p>
        <p>Пожалуйста, установите правильное значение в переменных окружения Railway.</p>
        <a href="/">Вернуться на главную</a>
      `);
    }
    
    // Проверяем, что APP_URL начинается с http:// или https://
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      console.error('APP_URL does not start with http:// or https://');
      return res.status(500).send(`
        <h2>Ошибка конфигурации</h2>
        <p>APP_URL должен начинаться с http:// или https://</p>
        <p>Текущее значение: ${appUrl}</p>
        <a href="/">Вернуться на главную</a>
      `);
    }
    
    // Необходимые scope для полноценной работы бота:
    // - user:read:email - для получения email пользователя
    // - channel:read:redemptions - для чтения сообщений в чате
    // - channel:manage:redemptions - для управления розыгрышами
    // - chat:read - для чтения сообщений в чате
    // - chat:edit - для отправки сообщений в чат
    // - whispers:read - для чтения личных сообщений
    // - whispers:edit - для отправки личных сообщений
    const scopes = [
      'user:read:email',
      'channel:read:redemptions',
      'channel:manage:redemptions',
      'chat:read',
      'chat:edit',
      'whispers:read',
      'whispers:edit'
    ];
    
    const scope = scopes.join(' ');
    const state = crypto.randomBytes(32).toString('hex'); // Защита от CSRF
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    
    console.log('Redirecting user to Twitch Auth URL:', authUrl);
    res.redirect(authUrl);
  });

  // Маршрут для обработки callback от Twitch OAuth
  app.get('/auth/twitch/callback', async (req, res) => {
    console.log('=== Twitch OAuth Callback Received ===');
    console.log('Query parameters:', req.query);
    console.log('Headers:', req.headers);
    console.log('Host:', req.get('host'));
    console.log('Protocol:', req.protocol);
    console.log('Secure:', req.secure);
    console.log('APP_URL from env:', process.env.APP_URL);
    
    const code = req.query.code;
    const state = req.query.state;
    const error = req.query.error;
    const errorDescription = req.query.error_description;
    
    // Обрабатываем ошибки авторизации
    if (error) {
      console.error('Twitch OAuth Error:', error);
      console.error('Error Description:', errorDescription);
      return res.status(400).send(`
        <h2>Ошибка авторизации Twitch</h2>
        <p><strong>Ошибка:</strong> ${error}</p>
        <p><strong>Описание:</strong> ${errorDescription}</p>
        <p><strong>Решение:</strong> Убедитесь, что Redirect URL в настройках Twitch приложения совпадает с ${process.env.APP_URL}/auth/twitch/callback</p>
        <a href="/">Вернуться на главную</a>
      `);
    }
    
    if (!code) {
      console.error('Authorization code not provided in request:', req.query);
      return res.status(400).send(`
        <h2>Ошибка авторизации</h2>
        <p>Код авторизации не предоставлен. Пожалуйста, попробуйте авторизоваться снова.</p>
        <a href="/">Вернуться на главную</a>
      `);
    }
    
    // Проверяем, что все обязательные переменные окружения установлены
    const requiredEnvVars = [
      'TWITCH_CLIENT_ID',
      'TWITCH_CLIENT_SECRET',
      'APP_URL'
    ];
    
    for (const varName of requiredEnvVars) {
      if (!process.env[varName]) {
        console.error(`Required environment variable ${varName} is not set`);
        return res.status(500).send(`
          <h2>Ошибка конфигурации</h2>
          <p>Переменная окружения ${varName} не установлена.</p>
          <p>Пожалуйста, установите правильное значение в переменных окружения Railway.</p>
          <a href="/">Вернуться на главную</a>
        `);
      }
    }
    
    // Нормализуем APP_URL для redirect_uri
    const normalizedAppUrl = process.env.APP_URL.endsWith('/') ? process.env.APP_URL.slice(0, -1) : process.env.APP_URL;
    const redirectUri = `${normalizedAppUrl}/auth/twitch/callback`;
    console.log('Using redirect URI for token exchange:', redirectUri);
    
    try {
      // Обмениваем код на токен
      console.log('Exchanging authorization code for access token...');
      const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      
      const tokenData = await tokenResponse.json();
      console.log('Token exchange response status:', tokenResponse.status);
      console.log('Token exchange response:', tokenData);
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        let errorMessage = 'Неизвестная ошибка';
        if (tokenData.message) {
          errorMessage = tokenData.message;
        } else if (tokenData.error) {
          errorMessage = tokenData.error;
        } else if (tokenData.error_description) {
          errorMessage = tokenData.error_description;
        }
        
        return res.status(tokenResponse.status).send(`
          <h2>Ошибка получения токена доступа</h2>
          <p><strong>Статус:</strong> ${tokenResponse.status}</p>
          <p><strong>Ошибка:</strong> ${errorMessage}</p>
          <p><strong>Решение:</strong> Проверьте правильность Client ID и Client Secret в настройках.</p>
          <a href="/">Вернуться на главную</a>
        `);
      }
      
      // Получаем информацию о пользователе
      console.log('Fetching user information...');
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Client-ID': process.env.TWITCH_CLIENT_ID
        }
      });
      
      const userData = await userResponse.json();
      console.log('User information response status:', userResponse.status);
      console.log('User information response:', userData);
      
      if (!userResponse.ok) {
        console.error('Failed to fetch user information:', userData);
        let errorMessage = 'Неизвестная ошибка';
        if (userData.message) {
          errorMessage = userData.message;
        } else if (userData.error) {
          errorMessage = userData.error;
        }
        
        return res.status(userResponse.status).send(`
          <h2>Ошибка получения данных пользователя</h2>
          <p><strong>Статус:</strong> ${userResponse.status}</p>
          <p><strong>Ошибка:</strong> ${errorMessage}</p>
          <a href="/">Вернуться на главную</a>
        `);
      }
      
      if (!userData.data || userData.data.length === 0) {
        console.error('No user data received:', userData);
        return res.status(500).send(`
          <h2>Ошибка получения данных пользователя</h2>
          <p>Данные пользователя отсутствуют в ответе.</p>
          <a href="/">Вернуться на главную</a>
        `);
      }
      
      const user = userData.data[0];
      console.log('Successfully authenticated user:', user.login);
      
      // Сохраняем сессию пользователя
      const sessionId = generateSessionId();
      userSessions.set(sessionId, {
        userId: user.id,
        username: user.login,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      });
      
      // Устанавливаем cookie с sessionId
      res.cookie('sessionId', sessionId, { 
        maxAge: 24 * 60 * 60 * 1000, // 24 часа
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Только HTTPS в production
        sameSite: 'lax'
      });
      
      // Присоединяем бота к каналу пользователя
      console.log('Joining channel:', user.login);
      await joinChannel(user.login);
      
      // Перенаправляем на главную страницу с параметром успеха
      console.log('Redirecting to main page with success');
      res.redirect('/?auth=success');
    } catch (error) {
      console.error('Exception in OAuth callback handler:', error);
      res.status(500).send(`
        <h2>Внутренняя ошибка сервера</h2>
        <p><strong>Ошибка:</strong> ${error.message}</p>
        <p><strong>Stack trace:</strong> ${error.stack}</p>
        <p>Пожалуйста, попробуйте авторизоваться позже или обратитесь к администратору.</p>
        <a href="/">Вернуться на главную</a>
      `);
    }
  });

  // Маршрут для выхода из системы
  app.get('/auth/logout', (req, res) => {
    const sessionId = req.cookies?.sessionId;
    
    if (sessionId && userSessions.has(sessionId)) {
      const session = userSessions.get(sessionId);
      
      // Отключаем бота от канала пользователя
      leaveChannel(session.username).catch(error => {
        console.error('Error leaving channel on logout:', error);
      });
      
      // Удаляем сессию
      userSessions.delete(sessionId);
    }
    
    // Удаляем cookie
    res.clearCookie('sessionId');
    
    // Перенаправляем на главную страницу
    res.redirect('/?logout=success');
  });

  // Middleware для проверки аутентификации
  const requireAuth = async (req, res, next) => {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const session = userSessions.get(sessionId);
    
    // Проверяем, не истек ли токен
    if (Date.now() > session.expiresAt) {
      // Пытаемся обновить токен
      try {
        const tokenData = await refreshAccessToken(session.refreshToken);
        
        // Обновляем сессию с новыми токенами
        session.accessToken = tokenData.access_token;
        session.refreshToken = tokenData.refresh_token;
        session.expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        userSessions.set(sessionId, session);
      } catch (error) {
        console.error('Error refreshing token:', error);
        // Удаляем сессию при ошибке обновления токена
        userSessions.delete(sessionId);
        return res.status(401).json({ error: 'Сессия истекла, требуется повторная авторизация' });
      }
    }
    
    req.user = session;
    next();
  };

  // Тестовый маршрут для проверки авторизации
  app.get('/api/giveaways/test', requireAuth, (req, res) => {
    res.json({ message: 'Авторизация успешна', user: req.user.username });
  });

  // API маршрут для начала розыгрыша
  app.post('/api/start-giveaway', requireAuth, async (req, res) => {
    try {
      const { keyword, prize } = req.body;
      
      if (!keyword) {
        return res.status(400).json({ error: 'Кодовое слово обязательно' });
      }
      
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      
      // Создаем розыгрыш в базе данных
      const giveawayData = await createGiveaway(channelName, keyword, prize || 'Участие в розыгрыше');
      
      if (giveawayData) {
        // Сохраняем информацию о розыгрыше
        const giveawayInfo = {
          id: giveawayData.id,
          keyword: keyword,
          prize: prize || 'Участие в розыгрыше',
          participants: [],
          channel: channelName
        };
        
        activeGiveaways.set(`${channelName}:${keyword.toLowerCase()}`, giveawayInfo);
        
        // Отправляем уведомление через WebSocket
        io.emit('giveawayStarted', {
          id: giveawayData.id,
          keyword: keyword,
          prize: prize || 'Участие в розыгрыше',
          channel: channelName
        });
        
        return res.json({ success: true, giveaway: giveawayInfo });
      } else {
        return res.status(500).json({ error: 'Ошибка при создании розыгрыша' });
      }
    } catch (error) {
      console.error('Ошибка при создании розыгрыша:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // API маршрут для завершения розыгрыша
  app.post('/api/end-giveaway', requireAuth, async (req, res) => {
    try {
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      
      // Завершаем все активные розыгрыши в канале
      let endedCount = 0;
      const keysToDelete = [];
      
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          // Выбираем победителя
          const winner = await selectWinner(giveaway.id);
          
          // Добавляем ключ для удаления
          keysToDelete.push(key);
          endedCount++;
          
          // Отправляем уведомление через WebSocket
          io.emit('giveawayEnded', {
            id: giveaway.id,
            winner: winner,
            channel: channelName
          });
        }
      }
      
      // Удаляем завершенные розыгрыши
      keysToDelete.forEach(key => activeGiveaways.delete(key));
      
      return res.json({ 
        success: true, 
        message: `Завершено розыгрышей: ${endedCount}`,
        endedCount: endedCount
      });
    } catch (error) {
      console.error('Ошибка при завершении розыгрыша:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // API маршрут для выбора победителя
  app.post('/api/select-winner', requireAuth, async (req, res) => {
    try {
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      
      // Находим активный розыгрыш для этого канала
      let activeGiveaway = null;
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          activeGiveaway = giveaway;
          break;
        }
      }
      
      if (!activeGiveaway) {
        return res.status(400).json({ error: 'Нет активного розыгрыша' });
      }
      
      // Проверяем, есть ли участники (проверяем как в локальном массиве, так и в базе данных)
      if ((!activeGiveaway.participants || activeGiveaway.participants.length === 0) && 
          (!req.body.participants || req.body.participants.length === 0)) {
        return res.status(400).json({ error: 'Нет участников для выбора победителя' });
      }
      
      // Если участники переданы в запросе, обновляем локальный список
      if (req.body.participants && Array.isArray(req.body.participants)) {
        activeGiveaway.participants = req.body.participants;
      }
      
      // Выбираем случайного победителя из участников
      const winnerIndex = Math.floor(Math.random() * activeGiveaway.participants.length);
      const winner = activeGiveaway.participants[winnerIndex];
      
      // Отправляем уведомление через WebSocket
      io.emit('winnerSelected', {
        winner: winner,
        channel: channelName,
        giveawayId: activeGiveaway.id
      });
      
      return res.json({ 
        success: true, 
        winner: winner
      });
    } catch (error) {
      console.error('Ошибка при выборе победителя:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // API маршруты
  app.get('/api/giveaways/:channel', async (req, res) => {
    try {
      const { channel } = req.params;
      const giveaways = await getGiveaways(channel);
      res.json(giveaways);
    } catch (error) {
      console.error('Ошибка при получении розыгрышей:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // Маршрут для добавления бота в канал
  app.post('/api/channels/:channelName/join', async (req, res) => {
    try {
      const { channelName } = req.params;
      const success = await joinChannel(channelName);
      
      if (success) {
        res.json({ message: `Бот успешно добавлен в канал ${channelName}` });
      } else {
        res.status(500).json({ error: `Ошибка при добавлении бота в канал ${channelName}` });
      }
    } catch (error) {
      console.error('Ошибка при добавлении бота в канал:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // Маршрут для удаления бота из канала
  app.post('/api/channels/:channelName/leave', async (req, res) => {
    try {
      const { channelName } = req.params;
      const success = await leaveChannel(channelName);
      
      if (success) {
        res.json({ message: `Бот успешно удален из канала ${channelName}` });
      } else {
        res.status(500).json({ error: `Ошибка при удалении бота из канала ${channelName}` });
      }
    } catch (error) {
      console.error('Ошибка при удалении бота из канала:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // WebSocket соединения
  io.on('connection', (socket) => {
    console.log('Новое WebSocket соединение');
    
    // Отправляем тестовое сообщение при подключении
    socket.emit('twitchMessage', {
      channel: 'system',
      username: 'Система',
      message: 'WebSocket соединение установлено',
      timestamp: new Date().toISOString()
    });
    
    // Обработчик добавления участника от фронтенда
    socket.on('addParticipant', (data) => {
      console.log('Получен запрос на добавление участника:', data);
      
      // Находим активный розыгрыш для канала
      let activeGiveaway = null;
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === data.channel) {
          activeGiveaway = giveaway;
          break;
        }
      }
      
      if (activeGiveaway) {
        // Добавляем участника в локальный список, если его там еще нет
        if (!activeGiveaway.participants) {
          activeGiveaway.participants = [];
        }
        
        if (!activeGiveaway.participants.includes(data.username)) {
          activeGiveaway.participants.push(data.username);
          console.log(`Участник ${data.username} добавлен в розыгрыш ${activeGiveaway.id}`);
        }
      }
    });
    
    // Обработчик уведомления о выборе победителя от фронтенда
    socket.on('winnerSelectedChat', (data) => {
      console.log('Получено уведомление о выборе победителя:', data);
      
      // Отправляем сообщение в чат всем подключенным клиентам
      io.emit('twitchMessage', {
        channel: data.channel || 'system',
        username: 'Система',
        message: data.message,
        timestamp: new Date().toISOString()
      });
      
      // Отправляем сообщение в Twitch чат, если есть учетные данные бота
      try {
        const twitchBot = require('../bot/twitchBot');
        // В реальной реализации здесь будет вызов функции для отправки сообщения в Twitch чат
        console.log(`Сообщение для отправки в Twitch чат: ${data.message}`);
      } catch (error) {
        console.error('Ошибка при отправке сообщения в Twitch чат:', error);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket соединение закрыто');
    });
  });

  console.log('Веб-сервер инициализирован');
}

module.exports = {
  initWebServer
};