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

  // Подключение к Twitch (только если есть учетные данные)
  if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN) {
    // Проверяем, что учетные данные не являются плейсхолдерами
    if (process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
        process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
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

  // Подписка на сообщения в чате
  client.on('message', async (channel, tags, message, self) => {
    console.log('Обработчик сообщений вызван:', { channel, tags, message, self });
    // Игнорируем сообщения от самого бота
    if (self) return;

    const channelName = channel.replace('#', '');
    const username = tags.username;
    const lowerMessage = message.toLowerCase();
    
    console.log('Получено сообщение из Twitch чата:', { channelName, username, message, lowerMessage });
    console.log('Текущие подключенные каналы:', Array.from(connectedChannels));
    console.log('Канал сообщения подключен:', connectedChannels.has(channelName));

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
    console.log('Проверка розыгрышей:', { channelName, lowerMessage, activeGiveaways: Array.from(activeGiveaways.entries()) });
    let foundGiveaway = false;
    
    // Проверяем точное совпадение ключевого слова
    for (const [key, giveaway] of activeGiveaways.entries()) {
      console.log('Проверка розыгрыша:', { key, giveaway, channelMatch: giveaway.channel === channelName, keywordMatch: giveaway.keyword === lowerMessage });
      if (giveaway.channel === channelName && giveaway.keyword === lowerMessage) {
        foundGiveaway = true;
        console.log('Найден подходящий розыгрыш:', { giveawayId: giveaway.id, channel: giveaway.channel, keyword: giveaway.keyword });
        
        // Добавляем участника в розыгрыш
        const participant = await addParticipant(giveaway.id, username);
        console.log('Добавление участника:', { giveawayId: giveaway.id, username, participant });
        if (participant) {
          // Отправляем уведомление в чат (только если есть учетные данные бота и они не плейсхолдеры)
          try {
            if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
              await client.say(channel, `@${username} добавлен в розыгрыш!`);
            }
          } catch (error) {
            console.error('Ошибка отправки сообщения в чат:', error.message);
          }
          
          // Отправляем обновление через WebSocket
          if (io) {
            console.log('Отправка события participantAdded:', { giveawayId: giveaway.id, username, channelName });
            io.emit('participantAdded', {
              giveawayId: giveaway.id,
              username: username,
              count: giveaway.participants ? giveaway.participants.length + 1 : 1,
              channel: channelName // Добавляем имя канала
            });
            
            // Дополнительная отладочная информация
            console.log('Событие participantAdded отправлено. Данные:', {
              giveawayId: giveaway.id,
              username: username,
              participantsCount: giveaway.participants ? giveaway.participants.length + 1 : 1,
              channel: channelName,
              activeGiveawaysSize: activeGiveaways.size
            });
          }
          
          // Добавляем участника в локальный список
          if (!giveaway.participants) {
            giveaway.participants = [];
          }
          // Проверяем, чтобы не добавлять дубликаты
          if (!giveaway.participants.includes(username)) {
            giveaway.participants.push(username);
          }
        }
        return;
      }
    }
    
    // Если не найдено подходящих розыгрышей
    if (!foundGiveaway) {
      console.log('Розыгрыш не найден для:', { channelName, lowerMessage });
      // Выводим все активные розыгрыши для отладки
      console.log('Активные розыгрыши:', Array.from(activeGiveaways.entries()).map(([key, giveaway]) => ({
        key,
        channel: giveaway.channel,
        keyword: giveaway.keyword,
        id: giveaway.id
      })));
    }
    
    if (!foundGiveaway) {
      console.log('Розыгрыш не найден для:', { channelName, lowerMessage });
    }

    // Команды для управления ботом (доступны только модераторам и стримеру)
    if (tags.mod || tags.badges?.broadcaster) {
      if (message.startsWith('!startgiveaway')) {
        const parts = message.split(' ');
        if (parts.length >= 3) {
          const keyword = parts[1];
          const prize = parts.slice(2).join(' ');
          
          // Создаем розыгрыш в базе данных
          const giveawayData = await createGiveaway(channelName, keyword, prize);
          
          if (giveawayData) {
            // Сохраняем информацию о розыгрыше
            const normalizedKeyword = keyword.toLowerCase();
            const giveawayKey = `${channelName}:${normalizedKeyword}`;
            const giveawayInfo = {
              id: giveawayData.id,
              keyword: normalizedKeyword,
              prize: prize,
              participants: [],
              channel: channelName
            };
            
            activeGiveaways.set(giveawayKey, giveawayInfo);
            
            console.log('Розыгрыш создан и сохранен:', { giveawayKey, giveawayInfo });
            console.log('Текущие активные розыгрыши:', Array.from(activeGiveaways.entries()));
            
            // Отправляем уведомление в чат (только если есть учетные данные бота и они не плейсхолдеры)
            try {
              if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                  process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                  process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
                await client.say(channel, `Розыгрыш "${prize}" начался! Напишите "${keyword}" чтобы принять участие!`);
              }
            } catch (error) {
              console.error('Ошибка отправки сообщения в чат:', error.message);
            }
            
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
            try {
              if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                  process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                  process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
                await client.say(channel, 'Ошибка при создании розыгрыша.');
              }
            } catch (error) {
              console.error('Ошибка отправки сообщения в чат:', error.message);
            }
          }
        } else {
          try {
            if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
              await client.say(channel, 'Использование: !startgiveaway <ключевое слово> <приз>');
            }
          } catch (error) {
              console.error('Ошибка отправки сообщения в чат:', error.message);
            }
          }
        } else if (message.startsWith('!endgiveaway')) {
          // Завершаем все активные розыгрыши в канале
          let endedCount = 0;
          
          // Выводим информацию о текущих розыгрышах перед завершением
          console.log('Розыгрыши перед завершением:', Array.from(activeGiveaways.entries()).map(([key, giveaway]) => ({
            key,
            channel: giveaway.channel,
            keyword: giveaway.keyword,
            id: giveaway.id
          })));
          
          for (const [key, giveaway] of activeGiveaways.entries()) {
            console.log('Проверка розыгрыша для завершения:', { key, giveawayChannel: giveaway.channel, channelName });
            if (giveaway.channel === channelName) {
              console.log('Завершение розыгрыша:', { giveawayId: giveaway.id, prize: giveaway.prize });
              
              // Выбираем победителя
              const winnerResult = await selectWinner(giveaway.id);
              
              if (winnerResult && winnerResult.winner) {
                try {
                  if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                      process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                      process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
                    await client.say(channel, `Розыгрыш "${giveaway.prize}" завершен! Победитель: @${winnerResult.winner}`);
                  }
                } catch (error) {
                  console.error('Ошибка отправки сообщения в чат:', error.message);
                }
              } else {
                try {
                  if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                      process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                      process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
                    await client.say(channel, `Розыгрыш "${giveaway.prize}" завершен! Участников не было.`);
                  }
                } catch (error) {
                  console.error('Ошибка отправки сообщения в чат:', error.message);
                }
              }
              
              // Удаляем розыгрыш из активных
              activeGiveaways.delete(key);
              endedCount++;
              
              // Отправляем обновление через WebSocket
              if (io) {
                io.emit('giveawayEnded', {
                  id: giveaway.id,
                  winner: winnerResult ? winnerResult.winner : null,
                  channel: channelName
                });
              }
              
              console.log('Розыгрыш завершен и удален:', { key, giveawayId: giveaway.id });
            }
          }
          
          if (endedCount === 0) {
            try {
              if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
                  process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
                  process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
                await client.say(channel, 'Нет активных розыгрышей в этом канале.');
              }
            } catch (error) {
              console.error('Ошибка отправки сообщения в чат:', error.message);
            }
          }
        }
      }
    });

  console.log('Twitch бот инициализирован');
}

// Функция для добавления бота в канал
async function joinChannel(channelName) {
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
    return true;
  } catch (error) {
    console.error(`Ошибка при присоединении к каналу ${channelName}:`, error);
    return false;
  }
}

// Функция для удаления бота из канала
async function leaveChannel(channelName) {
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

// Функция для отправки сообщения о победителе в чат Twitch
async function announceWinner(channelName, winner, hasTelegram) {
  try {
    // Проверяем, есть ли учетные данные бота и что они не являются плейсхолдерами
    if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && 
        process.env.TWITCH_BOT_USERNAME !== 'your_bot_username' && 
        process.env.TWITCH_OAUTH_TOKEN !== 'oauth:your_token_here') {
      
      // Форматируем имя канала (убираем # если есть)
      const formattedChannel = channelName.startsWith('#') ? channelName : `#${channelName}`;
      
      // Отправляем сообщение о победителе
      await client.say(formattedChannel, `Поздравляем @${winner}! Вы выиграли розыгрыш! У вас есть 25 секунд чтобы скинуть свой ТГ.`);
      
      // Сохраняем победителя в таблице winners
      // Нам нужно найти активный розыгрыш для этого канала, чтобы получить приз
      let activeGiveaway = null;
      for (const [key, giveaway] of activeGiveaways.entries()) {
        if (giveaway.channel === channelName) {
          activeGiveaway = giveaway;
          break;
        }
      }
      
      if (activeGiveaway) {
        const prize = activeGiveaway.prize || 'Участие в розыгрыше';
        const winnerData = await addWinner(winner, channelName, prize);
        console.log('Победитель сохранен в таблице winners:', winnerData);
      } else {
        // Если не нашли активный розыгрыш, сохраняем с призом по умолчанию
        const winnerData = await addWinner(winner, channelName, 'Участие в розыгрыше');
        console.log('Победитель сохранен в таблице winners (по умолчанию):', winnerData);
      }
    }
  } catch (error) {
    console.error('Ошибка отправки сообщения о победителе в чат:', error.message);
  }
}

// Функция для получения активных розыгрышей
function getActiveGiveaways() {
  return activeGiveaways;
}

// Функция для установки активных розыгрышей (используется для синхронизации)
function setActiveGiveaways(giveaways) {
  activeGiveaways = giveaways;
}

// Функция для получения имени канала авторизованного пользователя
function getUserChannel(username) {
  // В реальной реализации здесь будет логика для получения имени канала пользователя
  // Пока возвращаем имя пользователя как имя канала
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