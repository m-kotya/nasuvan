const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { getGiveaways, createGiveaway, selectWinner, addWinner, supabase } = require('../database/supabaseClient');
const { joinChannel, leaveChannel, getActiveGiveaways, setActiveGiveaways } = require('../bot/twitchBot');

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
  console.log('=== НАЧАЛО ФУНКЦИИ refreshAccessToken ===');
  console.log('Попытка обновления access token');
  
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
      console.error('Token refresh failed:', tokenData);
      throw new Error(`Token refresh failed: ${JSON.stringify(tokenData)}`);
    }
    
    console.log('Токен успешно обновлен');
    console.log('=== КОНЕЦ ФУНКЦИИ refreshAccessToken ===');
    return tokenData;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ refreshAccessToken ===');
    throw error;
  }
}

// Middleware для проверки аутентификации
const requireAuth = async (req, res, next) => {
  console.log('=== НАЧАЛО MIDDLEWARE requireAuth ===');
  console.log('Проверка аутентификации для пути:', req.path);
  
  // Разрешаем доступ к странице входа, маршрутам аутентификации и health check без аутентификации
  if (req.path === '/login' || req.path === '/health' || req.path.startsWith('/auth/')) {
    console.log('Путь разрешен без аутентификации');
    console.log('=== КОНЕЦ MIDDLEWARE requireAuth ===');
    return next();
  }
  
  // Для API запросов возвращаем JSON ошибку вместо перенаправления
  const isAPIRequest = req.path.startsWith('/api/');
  
  const sessionId = req.cookies?.sessionId;
  console.log('Session ID из cookies:', sessionId);
  
  if (!sessionId || !userSessions.has(sessionId)) {
    console.log('Сессия не найдена или отсутствует');
    if (isAPIRequest) {
      console.log('API запрос без аутентификации, возвращаем 401');
      console.log('=== КОНЕЦ MIDDLEWARE requireAuth ===');
      return res.status(401).json({ error: 'Требуется аутентификация' });
    } else {
      console.log('Перенаправление на /login');
      console.log('=== КОНЕЦ MIDDLEWARE requireAuth ===');
      return res.redirect('/login');
    }
  }
  
  const session = userSessions.get(sessionId);
  console.log('Найдена сессия:', { userId: session.userId, username: session.username });
  
  // Проверяем, не истек ли токен
  if (Date.now() > session.expiresAt) {
    console.log('Токен истек, попытка обновления');
    // Пытаемся обновить токен
    try {
      const tokenData = await refreshAccessToken(session.refreshToken);
      
      // Обновляем сессию с новыми токенами
      session.accessToken = tokenData.access_token;
      session.refreshToken = tokenData.refresh_token;
      session.expiresAt = Date.now() + (tokenData.expires_in * 1000);
      
      userSessions.set(sessionId, session);
      console.log('Токен успешно обновлен');
    } catch (error) {
      console.error('Error refreshing token:', error);
      // Удаляем сессию при ошибке обновления токена
      userSessions.delete(sessionId);
      if (isAPIRequest) {
        console.log('API запрос с истекшим токеном, возвращаем 401');
        console.log('=== КОНЕЦ MIDDLEWARE requireAuth ===');
        return res.status(401).json({ error: 'Токен истек, требуется повторная аутентификация' });
      } else {
        console.log('Перенаправление на /login из-за истекшего токена');
        console.log('=== КОНЕЦ MIDDLEWARE requireAuth ===');
        return res.redirect('/login');
      }
    }
  }
  
  req.user = session;
  console.log('=== КОНЕЦ MIDDLEWARE requireAuth ===');
  next();
};

function initWebServer(app, io) {
  console.log('=== НАЧАЛО ФУНКЦИИ initWebServer ===');
  
  // Проверка Railway переменных
  const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
  console.log('Running on Railway:', isRailway ? 'YES' : 'NO');
  
  if (isRailway) {
    console.log('Railway Environment Variables:');
    console.log('  RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID ? 'SET' : 'NOT SET');
    console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('  SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'SET' : 'NOT SET');
    console.log('  TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID ? 'SET' : 'NOT SET');
    console.log('  TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET ? 'SET' : 'NOT SET');
    console.log('  ADMIN_USERNAME:', process.env.ADMIN_USERNAME ? 'SET' : 'NOT SET');
    console.log('  ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET');
  }

  // Применяем middleware аутентификации ко всем маршрутам
  app.use(requireAuth);
  
  // Теперь добавляем middleware для статических файлов после аутентификации
  app.use(express.static(path.join(__dirname, '../../public')));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      authenticated: !!req.user,
      environment: {
        railway: !!isRailway,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    });
  });

  // Маршрут для главной страницы
  app.get('/', (req, res) => {
    console.log('Запрос главной страницы');
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  // Маршрут для страницы входа
  app.get('/login', (req, res) => {
    console.log('Запрос страницы входа');
    res.sendFile(path.join(__dirname, '../../public/login.html'));
  });

  // Маршрут для обработки логина через форму
  app.post('/login', (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /login ===');
    const { username, password } = req.body;
    
    console.log('Попытка входа:', { username });
    
    // Проверяем учетные данные через переменные окружения
    // Если переменные не установлены, используем значения по умолчанию и показываем предупреждение
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'password';
    
    // Проверяем, установлены ли переменные окружения
    const usingDefaultCredentials = !process.env.ADMIN_USERNAME && !process.env.ADMIN_PASSWORD;
    if (usingDefaultCredentials) {
      console.warn('Используются учетные данные по умолчанию. Рекомендуется установить переменные окружения ADMIN_USERNAME и ADMIN_PASSWORD.');
    } else {
      console.log('Используются учетные данные из переменных окружения.');
    }
    
    if (!username || !password) {
      console.log('Не указаны имя пользователя или пароль');
      return res.redirect('/login?error=missing');
    }
    
    // Проверяем учетные данные
    if (username !== validUsername || password !== validPassword) {
      console.log('Неверные учетные данные');
      console.log('Полученные данные:', { username, password });
      console.log('Ожидаемые данные:', { validUsername, validPassword });
      return res.redirect('/login?error=invalid');
    }
    
    // Создаем сессию для пользователя
    const sessionId = generateSessionId();
    const session = {
      userId: username,
      username: username,
      // В реальной реализации здесь будут настоящие токены
      accessToken: 'demo_access_token',
      refreshToken: 'demo_refresh_token',
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 час
    };
    
    userSessions.set(sessionId, session);
    
    // Устанавливаем cookie с sessionId
    res.cookie('sessionId', sessionId, { 
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    console.log('Пользователь успешно вошел в систему:', username);
    console.log('=== КОНЕЦ ОБРАБОТКИ /login ===');
    
    // После успешной аутентификации администратора автоматически переадресуем на авторизацию Twitch
    res.redirect('/auth/twitch');
  });

  // Маршрут для страницы победителей
  app.get('/winners', (req, res) => {
    console.log('Запрос страницы победителей');
    res.sendFile(path.join(__dirname, '../../public/winners.html'));
  });

  // Маршрут для начала авторизации через Twitch
  app.get('/auth/twitch', (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /auth/twitch ===');
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
      console.error('APP_URL does not start with http:// или https://');
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
    console.log('=== КОНЕЦ ОБРАБОТКИ /auth/twitch ===');
  });

  // Маршрут для обработки callback от Twitch OAuth
  app.get('/auth/twitch/callback', async (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /auth/twitch/callback ===');
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
      
      // Синхронизируем активные розыгрыши с Twitch ботом
      setActiveGiveaways(activeGiveaways);
      
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
    console.log('=== КОНЕЦ ОБРАБОТКИ /auth/twitch/callback ===');
  });

  // Маршрут для выхода из системы
  app.get('/auth/logout', (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /auth/logout ===');
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
    console.log('=== КОНЕЦ ОБРАБОТКИ /auth/logout ===');
  });

  // Тестовый маршрут для проверки авторизации
  app.get('/api/giveaways/test', (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /api/giveaways/test ===');
    console.log('Тест авторизации успешен для пользователя:', req.user.username);
    res.json({ message: 'Авторизация успешна', user: req.user.username });
    console.log('=== КОНЕЦ ОБРАБОТКИ /api/giveaways/test ===');
  });

  // API маршрут для начала розыгрыша
  app.post('/api/start-giveaway', async (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /api/start-giveaway ===');
    try {
      const { keyword, prize } = req.body;
      
      console.log('Получен запрос на создание розыгрыша:', { keyword, prize });
      
      if (!keyword) {
        console.log('Ошибка: Кодовое слово обязательно');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/start-giveaway ===');
        return res.status(400).json({ error: 'Кодовое слово обязательно' });
      }
      
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      console.log('Имя канала:', channelName);
      
      // Создаем розыгрыш в базе данных
      console.log('Попытка создания розыгрыша в базе данных...');
      const giveawayData = await createGiveaway(channelName, keyword, prize || 'Участие в розыгрыше');
      
      console.log('Результат создания розыгрыша:', giveawayData);
      
      // Проверяем, что мы получили данные (даже фиктивные)
      if (giveawayData && giveawayData.id) {
        // Сохраняем информацию о розыгрыше
        const normalizedKeyword = keyword.toLowerCase();
        const giveawayInfo = {
          id: giveawayData.id,
          keyword: normalizedKeyword,
          prize: prize || 'Участие в розыгрыше',
          participants: [],
          channel: channelName
        };
        
        const giveawayKey = `${channelName}:${normalizedKeyword}`;
        console.log('Сохранение розыгрыша:', { giveawayKey, giveawayInfo });
        activeGiveaways.set(giveawayKey, giveawayInfo);
        console.log('Розыгрыш сохранен. Текущие розыгрыши:', Array.from(activeGiveaways.entries()));
        
        // Отправляем уведомление через WebSocket
        io.emit('giveawayStarted', {
          id: giveawayData.id,
          keyword: keyword.toLowerCase(),
          prize: prize || 'Участие в розыгрыше',
          channel: channelName
        });
        
        // Синхронизируем активные розыгрыши с Twitch ботом
        setActiveGiveaways(activeGiveaways);
        
        console.log('Розыгрыш успешно создан и сохранен:', giveawayInfo);
        console.log('Текущие розыгрыши в activeGiveaways:', Array.from(activeGiveaways.entries()));
        
        // Дополнительная отладочная информация
        console.log('Отладочная информация после создания розыгрыша:', {
          channelName,
          keyword: normalizedKeyword,
          giveawayKey,
          activeGiveawaysSize: activeGiveaways.size
        });
        
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/start-giveaway ===');
        return res.json({ success: true, giveaway: giveawayInfo });
      } else {
        console.error('Не удалось создать розыгрыш - отсутствует ID');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/start-giveaway ===');
        return res.status(500).json({ error: 'Ошибка при создании розыгрыша' });
      }
    } catch (error) {
      console.error('Ошибка при создании розыгрыша:', error);
      console.error('Stack trace:', error.stack);
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/start-giveaway ===');
      res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
    }
  });

  // API маршрут для завершения розыгрыша
  app.post('/api/end-giveaway', async (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /api/end-giveaway ===');
    try {
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      console.log('Завершение розыгрышей для канала:', channelName);
      
      // Завершаем все активные розыгрыши в канале
      let endedCount = 0;
      const keysToDelete = [];
      let winnerData = null;
      
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          console.log('Завершение розыгрыша:', { giveawayId: giveaway.id, prize: giveaway.prize });
          
          // Выбираем победителя
          const winnerResult = await selectWinner(giveaway.id);
          console.log('Результат выбора победителя:', winnerResult);
          
          // Объявляем победителя в чате Twitch, если есть победитель
          if (winnerResult && winnerResult.winner) {
            try {
              const { announceWinner } = require('../bot/twitchBot');
              console.log('Объявление победителя в чате Twitch');
              await announceWinner(channelName, winnerResult.winner, false); // false - так как у нас нет Telegram интеграции
            } catch (error) {
              console.error('Ошибка при объявлении победителя в чате Twitch:', error);
            }
            
            // Сохраняем победителя в таблице winners
            const prize = giveaway.prize || 'Участие в розыгрыше';
            console.log('Сохранение победителя в таблице winners');
            const winnerRecord = await addWinner(winnerResult.winner, channelName, prize);
            
            // Проверяем, была ли ошибка при добавлении победителя
            if (winnerRecord && winnerRecord.error) {
              console.error('Ошибка при сохранении победителя в базе данных:', winnerRecord.error);
              console.error('Детали ошибки:', winnerRecord.details || winnerRecord.exception);
            } else {
              console.log('Победитель успешно сохранен в базе данных:', winnerRecord);
            }
            
            // Сохраняем данные победителя для ответа
            if (!winnerData) {
              winnerData = { 
                id: giveaway.id, 
                winner: winnerResult.winner,
                winnerRecord: winnerRecord
              };
            }
          }
          
          // Добавляем ключ для удаления
          keysToDelete.push(key);
          endedCount++;
          
          // Отправляем уведомление через WebSocket
          console.log('Отправка уведомления о завершении розыгрыша через WebSocket');
          io.emit('giveawayEnded', {
            id: giveaway.id,
            winner: winnerResult ? winnerResult.winner : null,
            channel: channelName
          });
        }
      }
      
      // Удаляем завершенные розыгрыши
      console.log('Удаление завершенных розыгрышей:', keysToDelete.length);
      keysToDelete.forEach(key => activeGiveaways.delete(key));
      
      // Синхронизируем активные розыгрыши с Twitch ботом
      setActiveGiveaways(activeGiveaways);
      
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/end-giveaway ===');
      return res.json({ 
        success: true, 
        message: `Завершено розыгрышей: ${endedCount}`,
        endedCount: endedCount,
        winner: winnerData
      });
    } catch (error) {
      console.error('Ошибка при завершении розыгрыша:', error);
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/end-giveaway ===');
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // API маршрут для выбора победителя
  app.post('/api/select-winner', async (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /api/select-winner ===');
    try {
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      console.log('Выбор победителя для канала:', channelName);
      
      // Находим активный розыгрыш для этого канала
      let activeGiveaway = null;
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          activeGiveaway = giveaway;
          console.log('Найден активный розыгрыш:', { giveawayId: giveaway.id, prize: giveaway.prize });
          break;
        }
      }
      
      if (!activeGiveaway) {
        console.log('Активный розыгрыш не найден');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/select-winner ===');
        return res.status(400).json({ error: 'Нет активного розыгрыша' });
      }
      
      // Проверяем, есть ли участники (проверяем как в локальном массиве, так и в базе данных)
      if ((!activeGiveaway.participants || activeGiveaway.participants.length === 0) && 
          (!req.body.participants || req.body.participants.length === 0)) {
        console.log('Нет участников для выбора победителя');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/select-winner ===');
        return res.status(400).json({ error: 'Нет участников для выбора победителя' });
      }
      
      // Если участники переданы в запросе, обновляем локальный список
      if (req.body.participants && Array.isArray(req.body.participants)) {
        console.log('Обновление локального списка участников');
        activeGiveaway.participants = req.body.participants;
      }
      
      // Проверяем, что есть участники
      if (!activeGiveaway.participants || activeGiveaway.participants.length === 0) {
        console.log('Нет участников для выбора победителя (после обновления)');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/select-winner ===');
        return res.status(400).json({ error: 'Нет участников для выбора победителя' });
      }
      
      // Выбираем случайного победителя из участников
      console.log('Выбор случайного победителя из участников:', activeGiveaway.participants.length);
      const winnerIndex = Math.floor(Math.random() * activeGiveaway.participants.length);
      const winner = activeGiveaway.participants[winnerIndex];
      console.log('Выбран победитель:', winner);
      
      // Сохраняем победителя в таблице winners
      const prize = activeGiveaway.prize || 'Участие в розыгрыше';
      console.log('Сохранение победителя в таблице winners');
      const winnerData = await addWinner(winner, channelName, prize);
      
      // Проверяем, была ли ошибка при добавлении победителя
      if (winnerData && winnerData.error) {
        console.error('Ошибка при сохранении победителя в базе данных:', winnerData.error);
        console.error('Детали ошибки:', winnerData.details || winnerData.exception);
      } else {
        console.log('Победитель успешно сохранен в базе данных:', winnerData);
      }
      
      // Отправляем уведомление через WebSocket
      console.log('Отправка уведомления о выборе победителя через WebSocket');
      io.emit('winnerSelected', {
        winner: winner,
        channel: channelName,
        giveawayId: activeGiveaway.id,
        winnerData: winnerData
      });
      
      // Объявляем победителя в чате Twitch
      try {
        const { announceWinner } = require('../bot/twitchBot');
        console.log('Объявление победителя в чате Twitch');
        await announceWinner(channelName, winner, false); // false - так как у нас нет Telegram интеграции
      } catch (error) {
        console.error('Ошибка при объявлении победителя в чате Twitch:', error);
      }
      
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/select-winner ===');
      return res.json({ 
        success: true, 
        winner: winner,
        winnerData: winnerData
      });
    } catch (error) {
      console.error('Ошибка при выборе победителя:', error);
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/select-winner ===');
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // API маршрут для получения последних победителей
  app.get('/api/winners', async (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /api/winners ===');
    try {
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      console.log('Запрос победителей для канала:', channelName);
      
      // Проверяем, что у нас есть клиент Supabase
      if (!supabase) {
        console.error('Supabase клиент не инициализирован');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/winners ===');
        return res.status(500).json({ error: 'База данных не доступна', details: 'Supabase клиент не инициализирован' });
      }
      
      // Получаем историю победителей из новой таблицы
      console.log('Получение истории победителей');
      const winners = await getWinnersHistory(channelName, 50);
      
      console.log('Получена история победителей:', winners.length);
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/winners ===');
      return res.json(winners);
    } catch (error) {
      console.error('Ошибка при получении истории победителей:', error);
      console.error('Stack trace:', error.stack);
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/winners ===');
      // Возвращаем более подробную информацию об ошибке
      return res.status(500).json({ 
        error: 'Внутренняя ошибка сервера', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // API маршрут для обновления Telegram победителя
  app.post('/api/update-telegram', async (req, res) => {
    console.log('=== НАЧАЛО ОБРАБОТКИ /api/update-telegram ===');
    try {
      const { username, telegram } = req.body;
      console.log('Обновление Telegram для победителя:', { username, telegram });
      
      if (!username || !telegram) {
        console.log('Требуется указать имя пользователя и Telegram');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/update-telegram ===');
        return res.status(400).json({ error: 'Требуется указать имя пользователя и Telegram' });
      }
      
      // Получаем имя канала авторизованного пользователя
      const channelName = req.user.username;
      console.log('Канал пользователя:', channelName);
      
      // Обновляем Telegram победителя
      console.log('Обновление Telegram победителя в базе данных');
      const updatedWinner = await updateWinnerTelegram(username, channelName, telegram);
      
      if (!updatedWinner) {
        console.log('Не удалось обновить Telegram победителя');
        console.log('=== КОНЕЦ ОБРАБОТКИ /api/update-telegram ===');
        return res.status(500).json({ error: 'Не удалось обновить Telegram победителя' });
      }
      
      console.log('Telegram победителя успешно обновлен');
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/update-telegram ===');
      return res.json({ success: true, winner: updatedWinner });
    } catch (error) {
      console.error('Ошибка при обновлении Telegram победителя:', error);
      console.log('=== КОНЕЦ ОБРАБОТКИ /api/update-telegram ===');
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // WebSocket соединения
  io.on('connection', (socket) => {
    console.log('=== НОВОЕ WEBSOCKET СОЕДИНЕНИЕ ===');
    console.log('Новое WebSocket соединение');
    
    // Отправляем тестовое сообщение при подключении (но не отображаем его в интерфейсе)
    socket.emit('twitchMessage', {
      channel: 'system',
      username: 'Система',
      message: 'WebSocket соединение установлено',
      timestamp: new Date().toISOString()
    });
    
    // Обработчик добавления участника от фронтенда
    socket.on('addParticipant', (data) => {
      console.log('=== НАЧАЛО ОБРАБОТКИ addParticipant (от фронтенда) ===');
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
          console.log('Добавление участника в локальный список:', data.username);
          activeGiveaway.participants.push(data.username);
          console.log('Участник добавлен в локальный список. Текущие участники:', activeGiveaway.participants);
          
          // Отправляем уведомление через WebSocket
          io.emit('participantAdded', {
            giveawayId: activeGiveaway.id,
            username: data.username,
            count: activeGiveaway.participants.length
          });
        } else {
          console.log('Участник уже есть в локальном списке:', data.username);
        }
      }
      console.log('=== КОНЕЦ ОБРАБОТКИ addParticipant (от фронтенда) ===');
    });
    
    // Обработчик уведомления о выборе победителя от фронтенда
    socket.on('winnerSelectedChat', (data) => {
      console.log('=== НАЧАЛО ОБРАБОТКИ winnerSelectedChat ===');
      console.log('Получено уведомление о выборе победителя:', data);
      
      // Отправляем сообщение в чат всем подключенным клиентам
      console.log('Отправка сообщения в чат всем подключенным клиентам');
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
      console.log('=== КОНЕЦ ОБРАБОТКИ winnerSelectedChat ===');
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket соединение закрыто');
      console.log('=== ЗАКРЫТИЕ WEBSOCKET СОЕДИНЕНИЯ ===');
    });
  });

  console.log('Веб-сервер инициализирован');
  console.log('=== КОНЕЦ ФУНКЦИИ initWebServer ===');
}

module.exports = {
  initWebServer,
  activeGiveaways
};