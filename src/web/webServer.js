const path = require('path');
const { getGiveaways } = require('../database/supabaseClient');
const { joinChannel, leaveChannel } = require('../bot/twitchBot');

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

    socket.on('disconnect', () => {
      console.log('WebSocket соединение закрыто');
    });
  });

  console.log('Веб-сервер инициализирован');
}

module.exports = {
  initWebServer
};