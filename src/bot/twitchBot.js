const tmi = require('tmi.js');
const { createGiveaway, addParticipant, selectWinner, supabase } = require('../database/supabaseClient');

// Хранение активных розыгрышей
let activeGiveaways = new Map();
let io = null; // Ссылка на WebSocket сервер

// Конфигурация клиента Twitch
const client = new tmi.Client({
  options: { debug: true },
  connection: {
    reconnect: true,
    secure: true
  },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN
  },
  channels: []
});

function initBot(socketIo) {
  // Сохраняем ссылку на WebSocket сервер
  io = socketIo;
  
  client.connect().catch(console.error);

  // Подписка на сообщения в чате
  client.on('message', async (channel, tags, message, self) => {
    // Игнорируем сообщения от самого бота
    if (self) return;

    const channelName = channel.replace('#', '');
    const username = tags.username;
    const lowerMessage = message.toLowerCase();

    // Отправляем сообщение через WebSocket всем подключенным клиентам
    if (io) {
      io.emit('twitchMessage', {
        channel: channelName,
        username: username,
        message: message,
        timestamp: new Date().toISOString()
      });
    }

    // Проверяем, есть ли активный розыгрыш с таким ключевым словом
    const giveaway = activeGiveaways.get(`${channelName}:${lowerMessage}`);
    
    if (giveaway) {
      // Добавляем участника в розыгрыш
      const participant = await addParticipant(giveaway.id, username);
      if (participant) {
        // Отправляем уведомление в чат
        client.say(channel, `@${username} добавлен в розыгрыш!`);
        
        // Отправляем обновление через WebSocket
        if (io) {
          io.emit('participantAdded', {
            giveawayId: giveaway.id,
            username: username,
            count: giveaway.participants.length + 1
          });
        }
        
        // Добавляем участника в локальный список
        giveaway.participants.push(username);
      }
      return;
    }

    // Команды для управления ботом (доступны только модераторам и стримеру)
    if (tags.mod || tags.badges?.broadcaster) {
      if (message.startsWith('!startgiveaway')) {
        const parts = message.split(' ');
        if (parts.length >= 3) {
          const keyword = parts[1].toLowerCase();
          const prize = parts.slice(2).join(' ');
          
          // Создаем розыгрыш в базе данных
          const giveawayData = await createGiveaway(channelName, keyword, prize);
          
          if (giveawayData) {
            // Сохраняем информацию о розыгрыше
            activeGiveaways.set(`${channelName}:${keyword}`, {
              id: giveawayData.id,
              keyword: keyword,
              prize: prize,
              participants: [],
              channel: channelName
            });
            
            // Отправляем уведомление в чат
            client.say(channel, `Розыгрыш "${prize}" начался! Напишите "${keyword}" чтобы принять участие!`);
            
            // Отправляем обновление через WebSocket
            if (io) {
              io.emit('giveawayStarted', {
                id: giveawayData.id,
                keyword: keyword,
                prize: prize,
                channel: channelName
              });
            }
          } else {
            client.say(channel, 'Ошибка при создании розыгрыша.');
          }
        } else {
          client.say(channel, 'Использование: !startgiveaway <ключевое слово> <приз>');
        }
      } else if (message.startsWith('!endgiveaway')) {
        // Завершаем все активные розыгрыши в канале
        let endedCount = 0;
        
        for (const [key, giveaway] of activeGiveaways.entries()) {
          if (giveaway.channel === channelName) {
            // Выбираем победителя
            const winner = await selectWinner(giveaway.id);
            
            if (winner) {
              client.say(channel, `Розыгрыш "${giveaway.prize}" завершен! Победитель: @${winner}`);
            } else {
              client.say(channel, `Розыгрыш "${giveaway.prize}" завершен! Участников не было.`);
            }
            
            // Удаляем розыгрыш из активных
            activeGiveaways.delete(key);
            endedCount++;
            
            // Отправляем обновление через WebSocket
            if (io) {
              io.emit('giveawayEnded', {
                id: giveaway.id,
                winner: winner,
                channel: channelName
              });
            }
          }
        }
        
        if (endedCount === 0) {
          client.say(channel, 'Нет активных розыгрышей в этом канале.');
        }
      }
    }
  });

  // Подписка на подключение к каналу
  client.on('connected', (address, port) => {
    console.log(`Подключен к Twitch по адресу ${address}:${port}`);
  });

  console.log('Twitch бот инициализирован');
}

// Функция для добавления бота в канал
async function joinChannel(channelName) {
  try {
    await client.join(channelName);
    console.log(`Бот присоединился к каналу ${channelName}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при присоединении к каналу ${channelName}:`, error);
    return false;
  }
}

// Функция для удаления бота из канала
async function leaveChannel(channelName) {
  try {
    await client.part(channelName);
    console.log(`Бот покинул канал ${channelName}`);
    
    // Удаляем все активные розыгрыши для этого канала
    for (const [key, giveaway] of activeGiveaways.entries()) {
      if (giveaway.channel === channelName) {
        activeGiveaways.delete(key);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Ошибка при выходе из канала ${channelName}:`, error);
    return false;
  }
}

module.exports = {
  initBot,
  joinChannel,
  leaveChannel
};