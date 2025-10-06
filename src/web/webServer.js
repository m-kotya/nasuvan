const path = require('path');
const { getGiveaways, supabase } = require('../database/supabaseClient');
const { joinChannel, leaveChannel } = require('../bot/twitchBot');

function initWebServer(app, io) {
  // Маршрут для главной страницы
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
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

  // Маршрут для авторизации через Twitch
  app.get('/auth/twitch/callback', (req, res) => {
    // Здесь будет обработка OAuth авторизации через Twitch
    res.send('Авторизация через Twitch будет реализована здесь');
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