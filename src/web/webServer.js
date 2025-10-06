const path = require('path');
const { getGiveaways, createGiveaway, selectWinner } = require('../database/supabaseClient');
const { joinChannel, leaveChannel } = require('../bot/twitchBot');

// Хранение активных розыгрышей в памяти (в реальном приложении лучше использовать БД)
let activeGiveaways = new Map();

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
  app.get('/auth/twitch/callback', (req, res) => {
    // В упрощенной версии просто показываем сообщение об успешной авторизации
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Авторизация успешна</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: green; }
          a { display: inline-block; margin: 20px; padding: 10px 20px; background-color: #9146ff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1 class="success">Авторизация через Twitch успешна!</h1>
        <p>Теперь вы можете использовать бота для розыгрышей.</p>
        <a href="/">Вернуться в приложение</a>
      </body>
      </html>
    `);
  });

  // API маршрут для начала розыгрыша
  app.post('/api/start-giveaway', async (req, res) => {
    try {
      const { keyword, prize } = req.body;
      
      if (!keyword) {
        return res.status(400).json({ error: 'Кодовое слово обязательно' });
      }
      
      // Здесь обычно мы бы получали имя канала авторизованного пользователя
      // Но для упрощения используем тестовый канал
      const channelName = 'test_channel'; // В реальном приложении это будет имя канала пользователя
      
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
  app.post('/api/end-giveaway', async (req, res) => {
    try {
      // В реальном приложении мы бы определяли канал по авторизованному пользователю
      const channelName = 'test_channel'; // В реальном приложении это будет имя канала пользователя
      
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