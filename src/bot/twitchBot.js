const tmi = require('tmi.js');
const { createGiveaway, addParticipant, selectWinner, addWinner, supabase } = require('../database/supabaseClient');

// Хранение активных розыгрышей
let activeGiveaways = new Map();
let io = null; // Ссылка на WebSocket сервер
let connectedChannels = new Set(); // Хранение списка подключенных каналов

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

console.log('Конфигурация клиента Twitch:', {
  username: process.env.TWITCH_BOT_USERNAME,
  password: process.env.TWITCH_OAUTH_TOKEN ? 'Установлен' : 'Не установлен'
});

function initBot(socketIo) {
  console.log('=== НАЧАЛО ФУНКЦИИ initBot ===');
  
  // Сохраняем ссылку на WebSocket сервер
  io = socketIo;
  
  // Обрабатываем ошибки подключения
  client.on('disconnected', (reason) => {
    console.log('Отключен от Twitch:', reason);
  });
  
  client.on('reconnect', () => {
    console.log('Попытка переподключения к Twitch');
  });
  
  client.on('connected', (address, port) => {
    console.log(`Подключен к Twitch по адресу ${address}:${port}`);
    
    // Отправляем сообщение через WebSocket при успешном подключении
    if (io) {
      io.emit('twitchConnected', {
        message: 'Бот успешно подключен к Twitch',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  client.on('logon', () => {
    console.log('Успешная аутентификация в Twitch');
  });
  
  client.on('notice', (channel, msgid, message) => {
    console.log('Twitch notice:', channel, msgid, message);
  });
  
  client.on('join', (channel, username, self) => {
    if (self) {
      console.log(`Бот присоединился к каналу ${channel}`);
      connectedChannels.add(channel);
      
      // Отправляем сообщение через WebSocket
      if (io) {
        io.emit('channelJoined', {
          channel: channel,
          message: `Бот присоединился к каналу ${channel}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  
  client.on('part', (channel, username, self) => {
    if (self) {
      console.log(`Бот покинул канал ${channel}`);
      connectedChannels.delete(channel);
      
      // Отправляем сообщение через WebSocket
      if (io) {
        io.emit('channelLeft', {
          channel: channel,
          message: `Бот покинул канал ${channel}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  // Обработчик сообщений в чате
  client.on('message', async (channel, tags, message, self) => {
    // Игнорируем сообщения от самого бота
    if (self) return;
    
    // Отправляем сообщение через WebSocket для отображения в веб-интерфейсе
    if (io) {
      io.emit('twitchMessage', {
        channel: channel,
        username: tags.username,
        message: message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Проверяем, есть ли активный розыгрыш для этого канала
    const normalizedChannel = channel.startsWith('#') ? channel.substring(1) : channel;
    
    // Проходим по всем активным розыгрышам и проверяем, совпадает ли ключевое слово
    for (const [key, giveaway] of activeGiveaways.entries()) {
      if (giveaway.channel === normalizedChannel && message.toLowerCase() === giveaway.keyword.toLowerCase()) {
        console.log('Найден подходящий розыгрыш!');
        const username = tags.username;
        
        // Проверяем, не участвует ли пользователь уже
        if (!giveaway.participants.includes(username)) {
          console.log('Добавление пользователя в список участников');
          giveaway.participants.push(username);
          
          // Добавляем участника в базу данных
          try {
            const participantData = await addParticipant(giveaway.id, username);
            console.log('Участник успешно добавлен в базу данных:', participantData);
            
            // Отправляем уведомление через WebSocket
            if (io) {
              io.emit('participantAdded', {
                giveawayId: giveaway.id,
                username: username,
                count: giveaway.participants.length
              });
            }
            
            // Отправляем сообщение в чат о добавлении участника
            // client.say(channel, `@${username} добавлен в список участников!`);
          } catch (error) {
            console.error('Ошибка при добавлении участника в базу данных:', error);
          }
        } else {
          console.log('Пользователь уже участвует в розыгрыше:', username);
        }
        break; // Прекращаем проверку после нахождения подходящего розыгрыша
      }
    }
  });

  // Подключение к Twitch (только если есть учетные данные)
  if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN) {
    // Проверяем, что учетные данные не являются плейсхолдерами
    if (process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
        process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
      console.log('Попытка подключения к Twitch с реальными учетными данными');
      client.connect().catch(error => {
        console.error('Ошибка подключения к Twitch:', error.message);
        // Отправляем сообщение через WebSocket об ошибке подключения
        if (io) {
          io.emit('twitchError', {
            message: 'Ошибка подключения к Twitch: ' + error.message,
            timestamp: new Date().toISOString()
          });
        }
        // Не прерываем работу приложения при ошибке подключения
      });
    } else {
      console.log('Учетные данные бота содержат плейсхолдеры. Бот будет работать в ограниченном режиме.');
      // Отправляем сообщение через WebSocket о тестовом режиме
      if (io) {
        io.emit('twitchConnected', {
          message: 'Бот работает в тестовом режиме (учетные данные содержат плейсхолдеры)',
          timestamp: new Date().toISOString()
        });
      }
    }
  } else {
    console.log('Учетные данные бота не настроены. Бот будет работать в ограниченном режиме.');
    // Отправляем сообщение через WebSocket о тестовом режиме
    if (io) {
      io.emit('twitchConnected', {
          message: 'Бот работает в тестовом режиме (учетные данные не настроены)',
          timestamp: new Date().toISOString()
        });
    }
  }
  
  console.log('Конфигурация бота:', {
    TWITCH_BOT_USERNAME: process.env.TWITCH_BOT_USERNAME,
    TWITCH_OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN ? 'Установлен' : 'Не установлен',
    hasPlaceholders: (process.env.TWITCH_BOT_USERNAME === 'your_bot_username' || 
                     process.env.TWITCH_OAUTH_TOKEN === 'oauth:your_token_here')
  });

  console.log('=== КОНЕЦ ФУНКЦИИ initBot ===');
}

// Функция для добавления бота в канал
async function joinChannel(channelName) {
  console.log('=== НАЧАЛО ФУНКЦИИ joinChannel ===');
  console.log('Попытка добавления канала:', { channelName, 
    TWITCH_BOT_USERNAME: process.env.TWITCH_BOT_USERNAME,
    TWITCH_OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN ? 'Установлен' : 'Не установлен',
    hasPlaceholders: (process.env.TWITCH_BOT_USERNAME === 'your_bot_username' || 
                     process.env.TWITCH_OAUTH_TOKEN === 'oauth:your_token_here')
  });
  
  // Проверяем, есть ли учетные данные бота и что они не являются плейсхолдерами
  if (!process.env.TWITCH_BOT_USERNAME || !process.env.TWITCH_OAUTH_TOKEN || 
      process.env.TWITCH_BOT_USERNAME === 'your_bot_username' || 
      process.env.TWITCH_OAUTH_TOKEN === 'oauth:your_token_here') {
    console.log('Учетные данные бота не настроены или содержат плейсхолдеры. Добавление в канал невозможно.');
    // Все равно отправляем сообщение через WebSocket для тестирования
    if (io) {
      io.emit('channelJoined', {
        channel: channelName,
        message: `Канал ${channelName} добавлен (тестовый режим)`,
        timestamp: new Date().toISOString()
      });
    }
    // Добавляем канал в список подключенных для тестирования
    connectedChannels.add(channelName);
    console.log('Канал добавлен в тестовом режиме:', { channelName, connectedChannels: Array.from(connectedChannels) });
    console.log('=== КОНЕЦ ФУНКЦИИ joinChannel ===');
    return true;
  }
  
  try {
    console.log(`Попытка присоединения к каналу ${channelName}`);
    await client.join(channelName);
    console.log(`Бот присоединился к каналу ${channelName}`);
    connectedChannels.add(channelName);
    
    // Отправляем сообщение через WebSocket
    if (io) {
      io.emit('channelJoined', {
        channel: channelName,
        message: `Бот присоединился к каналу ${channelName}`,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Успешное подключение к каналу ${channelName}. Текущие подключенные каналы:`, Array.from(connectedChannels));
    console.log('=== КОНЕЦ ФУНКЦИИ joinChannel ===');
    return true;
  } catch (error) {
    console.error(`Ошибка при присоединении к каналу ${channelName}:`, error);
    console.log('=== КОНЕЦ ФУНКЦИИ joinChannel ===');
    return false;
  }
}

// Функция для удаления бота из канала
async function leaveChannel(channelName) {
  console.log('=== НАЧАЛО ФУНКЦИИ leaveChannel ===');
  console.log('Попытка удаления бота из канала:', { channelName });
  
  // Проверяем, есть ли учетные данные бота и что они не являются плейсхолдерами
  if (!process.env.TWITCH_BOT_USERNAME || !process.env.TWITCH_OAUTH_TOKEN || 
      process.env.TWITCH_BOT_USERNAME === 'your_bot_username' || 
      process.env.TWITCH_OAUTH_TOKEN === 'oauth:your_token_here') {
    console.log('Учетные данные бота не настроены или содержат плейсхолдеры. Удаление из канала невозможно.');
    connectedChannels.delete(channelName);
    
    // Отправляем сообщение через WebSocket
    if (io) {
      io.emit('channelLeft', {
        channel: channelName,
        message: `Канал ${channelName} удален (тестовый режим)`,
        timestamp: new Date().toISOString()
      });
    }
    console.log('=== КОНЕЦ ФУНКЦИИ leaveChannel ===');
    return true;
  }
  
  try {
    await client.part(channelName);
    console.log(`Бот покинул канал ${channelName}`);
    connectedChannels.delete(channelName);
    
    // Отправляем сообщение через WebSocket
    if (io) {
      io.emit('channelLeft', {
        channel: channelName,
        message: `Бот покинул канал ${channelName}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Удаляем все активные розыгрыши для этого канала
    console.log('Удаление активных розыгрышей для канала:', channelName);
    let deletedCount = 0;
    for (const [key, giveaway] of activeGiveaways.entries()) {
      if (giveaway.channel === channelName) {
        activeGiveaways.delete(key);
        deletedCount++;
        console.log('Удален розыгрыш:', { key, giveawayId: giveaway.id });
      }
    }
    console.log('Удалено розыгрышей:', deletedCount);
    
    console.log('=== КОНЕЦ ФУНКЦИИ leaveChannel ===');
    return true;
  } catch (error) {
    console.error(`Ошибка при выходе из канала ${channelName}:`, error);
    console.log('=== КОНЕЦ ФУНКЦИИ leaveChannel ===');
    return false;
  }
}

// Функция для отправки сообщения о победителе в чат Twitch
async function announceWinner(channelName, winner, hasTelegram) {
  console.log('=== НАЧАЛО ФУНКЦИИ announceWinner ===');
  console.log('Объявление победителя:', { channelName, winner, hasTelegram });
  
  try {
    // Проверяем, есть ли учетные данные бота и что они не являются плейсхолдерами
    if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
        process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
        process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
      
      // Форматируем имя канала (убираем # если есть)
      const formattedChannel = channelName.startsWith('#') ? channelName : `#${channelName}`;
      console.log('Форматированный канал:', formattedChannel);
      
      // Отправляем сообщение о победителе
      console.log('Отправка сообщения о победителе в чат Twitch');
      await client.say(formattedChannel, `Поздравляем @${winner}! Вы выиграли розыгрыш! У вас есть 25 секунд чтобы скинуть свой ТГ.`);
      
      // Сохраняем победителя в таблице winners
      // Нам нужно найти активный розыгрыш для этого канала, чтобы получить приз
      console.log('Поиск активного розыгрыша для сохранения победителя');
      let activeGiveaway = null;
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          activeGiveaway = giveaway;
          console.log('Найден активный розыгрыш:', { key, giveawayId: giveaway.id });
          break;
        }
      }
      
      if (activeGiveaway) {
        const prize = activeGiveaway.prize || 'Участие в розыгрыше';
        console.log('Сохранение победителя в таблице winners:', { winner, channelName, prize });
        const winnerData = await addWinner(winner, channelName, prize);
        console.log('Победитель сохранен в таблице winners:', winnerData);
      } else {
        // Если не нашли активный розыгрыш, сохраняем с призом по умолчанию
        console.log('Активный розыгрыш не найден, сохранение с призом по умолчанию');
        const winnerData = await addWinner(winner, channelName, 'Участие в розыгрыше');
        console.log('Победитель сохранен в таблице winners (по умолчанию):', winnerData);
      }
    } else {
      console.log('Учетные данные бота не настроены или содержат плейсхолдеры. Не отправляем сообщение в чат.');
    }
  } catch (error) {
    console.error('Ошибка отправки сообщения о победителе в чат:', error.message);
  }
  
  console.log('=== КОНЕЦ ФУНКЦИИ announceWinner ===');
}

// Функция для получения активных розыгрышей
function getActiveGiveaways() {
  console.log('=== НАЧАЛО ФУНКЦИИ getActiveGiveaways ===');
  console.log('Текущие активные розыгрыши:', Array.from(activeGiveaways.entries()));
  console.log('=== КОНЕЦ ФУНКЦИИ getActiveGiveaways ===');
  return activeGiveaways;
}

// Функция для установки активных розыгрышей (используется для синхронизации)
function setActiveGiveaways(giveaways) {
  console.log('=== НАЧАЛО ФУНКЦИИ setActiveGiveaways ===');
  console.log('Установка активных розыгрышей:', giveaways);
  activeGiveaways = giveaways;
  console.log('=== КОНЕЦ ФУНКЦИИ setActiveGiveaways ===');
}

// Функция для получения имени канала авторизованного пользователя
function getUserChannel(username) {
  console.log('=== НАЧАЛО ФУНКЦИИ getUserChannel ===');
  console.log('Получение имени канала для пользователя:', username);
  // В реальной реализации здесь будет логика для получения имени канала пользователя
  // Пока возвращаем имя пользователя как имя канала
  console.log('=== КОНЕЦ ФУНКЦИИ getUserChannel ===');
  return username;
}

module.exports = {
  initBot,
  joinChannel,
  leaveChannel,
  getActiveGiveaways,
  setActiveGiveaways,
  getUserChannel,
  announceWinner
};