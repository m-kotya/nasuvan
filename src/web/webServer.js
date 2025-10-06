const path = require('path');
const { getGiveaways, createGiveaway, selectWinner } = require('../database/supabaseClient');
const { joinChannel, leaveChannel } = require('../bot/twitchBot');

// Хранение активных розыгрышей в памяти (в реальном приложении лучше использовать БД)
let activeGiveaways = new Map();
// Хранение информации о сессиях пользователей
let userSessions = new Map();

function initWebServer(app, io) {
  // Маршрут для главной страницы
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  // Маршрут для начала авторизации через Twitch
  app.get('/auth/twitch', (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const redirectUri = `${process.env.APP_URL}/auth/twitch/callback`;
    
    if (!clientId) {
      return res.status(500).send('TWITCH_CLIENT_ID не установлен в переменных окружения');
    }
    
    const scope = 'user:read:email';
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    
    res.redirect(authUrl);
  });

  // Маршрут для обработки callback от Twitch OAuth
  app.get('/auth/twitch/callback', async (req, res) => {
    console.log('Получен callback запрос:', req.query);
    
    const code = req.query.code;
    const error = req.query.error;
    
    // Обрабатываем ошибки авторизации
    if (error) {
      console.error('Ошибка авторизации Twitch:', error);
      return res.status(400).send(`Ошибка авторизации: ${error}`);
    }
    
    if (!code) {
      console.error('Код авторизации не предоставлен в запросе:', req.query);
      return res.status(400).send('Код авторизации не предоставлен. Пожалуйста, попробуйте авторизоваться снова.');
    }
    
    try {
      // Обмениваем код на токен
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
          redirect_uri: `${process.env.APP_URL}/auth/twitch/callback`
        })
      });
      
      const tokenData = await tokenResponse.json();
      console.log('Получен токен:', tokenData);
      
      if (!tokenResponse.ok) {
        console.error('Ошибка получения токена:', tokenData);
        return res.status(500).send('Ошибка получения токена доступа: ' + JSON.stringify(tokenData));
      }
      
      // Получаем информацию о пользователе
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Client-ID': process.env.TWITCH_CLIENT_ID
        }
      });
      
      const userData = await userResponse.json();
      console.log('Получены данные пользователя:', userData);
      
      if (!userResponse.ok) {
        console.error('Ошибка получения данных пользователя:', userData);
        return res.status(500).send('Ошибка получения данных пользователя: ' + JSON.stringify(userData));
      }
      
      const user = userData.data[0];
      
      // Сохраняем сессию пользователя
      const sessionId = Math.random().toString(36).substring(2, 15);
      userSessions.set(sessionId, {
        userId: user.id,
        username: user.login,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      });
      
      // Устанавливаем cookie с sessionId
      res.cookie('sessionId', sessionId, { maxAge: 900000, httpOnly: true });
      
      // Присоединяем бота к каналу пользователя
      await joinChannel(user.login);
      
      // Перенаправляем на главную страницу с параметром успеха
      res.redirect('/?auth=success');
    } catch (error) {
      console.error('Ошибка обработки callback:', error);
      res.status(500).send('Ошибка обработки авторизации: ' + error.message);
    }
  });

  // Middleware для проверки аутентификации
  const requireAuth = (req, res, next) => {
    const sessionId = req.cookies?.sessionId;
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const session = userSessions.get(sessionId);
    // Проверяем, не истек ли токен
    if (Date.now() > session.expiresAt) {
      return res.status(401).json({ error: 'Сессия истекла' });
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
        
        activeGiveaways.set(`${channelName}:${keyword}`, giveawayInfo);
        
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
      
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          // Выбираем победителя
          const winner = await selectWinner(giveaway.id);
          
          // Удаляем розыгрыш из активных
          activeGiveaways.delete(key);
          endedCount++;
          
          // Отправляем уведомление через WebSocket
          io.emit('giveawayEnded', {
            id: giveaway.id,
            winner: winner,
            channel: channelName
          });
        }
      }
      
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
    
    // Здесь можно добавить логику для обработки сообщений от клиента
    // Например, для присоединения к каналу пользователя
    
    socket.on('disconnect', () => {
      console.log('WebSocket соединение закрыто');
    });
  });

  console.log('Веб-сервер инициализирован');
}

module.exports = {
  initWebServer
};