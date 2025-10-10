const { createClient } = require('@supabase/supabase-js');

// Принудительная инициализация Supabase клиента с подробным логированием
console.log('=== ПОДРОБНАЯ ИНИЦИАЛИЗАЦИЯ SUPABASE КЛИЕНТА ===');
console.log('Шаг 1: Получение переменных окружения');

// Получаем переменные несколькими способами для проверки
const supabaseUrl = process.env.SUPABASE_URL || process.env['SUPABASE_URL'];
const supabaseKey = process.env.SUPABASE_KEY || process.env['SUPABASE_KEY'];

console.log('Шаг 2: Проверка полученных значений');
console.log('supabaseUrl:', supabaseUrl ? `SET (${supabaseUrl.substring(0, 30)}...)` : 'NOT SET');
console.log('supabaseKey:', supabaseKey ? `SET (length: ${supabaseKey.length})` : 'NOT SET');

// Проверяем Railway переменные
const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
console.log('Шаг 3: Проверка Railway окружения');
console.log('isRailway:', isRailway ? 'YES' : 'NO');
console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID || 'NOT SET');

console.log('Шаг 4: Попытка создания клиента');
let supabase;

// Принудительно пытаемся создать клиента, даже если переменные не установлены
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && supabaseKey.length > 20) {
  console.log('Шаг 5: Создание реального Supabase клиента');
  console.log('URL валиден:', supabaseUrl.startsWith('http'));
  console.log('Ключ имеет подходящую длину:', supabaseKey.length > 20);
  
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Шаг 6: Клиент успешно создан');
  } catch (error) {
    console.error('Ошибка при создании клиента:', error.message);
    supabase = null;
  }
} else {
  console.log('Шаг 5: Условия для реального клиента не выполнены');
  console.log('supabaseUrl валиден:', !!(supabaseUrl && supabaseUrl.startsWith('http')));
  console.log('supabaseKey валиден:', !!(supabaseKey && supabaseKey.length > 20));
  supabase = null;
}

console.log('Шаг 7: Финальное состояние клиента:', supabase ? 'СОЗДАН' : 'НЕ СОЗДАН');

// Фиктивный клиент для тестирования с возможностью сохранения данных
let mockData = {
  winners: []
};

const mockSupabase = {
  from: (table) => {
    const mockTable = {
      insert: (data) => {
        console.log(`Mock insert into ${table}:`, data);
        
        // Сохраняем данные в зависимости от таблицы
        if (table === 'winners' && Array.isArray(data)) {
          // Добавляем данные в mockData
          data.forEach(item => {
            mockData.winners.push({
              id: mockData.winners.length + 1,
              ...item
            });
          });
        }
        
        return {
          select: () => Promise.resolve({ data: data.map((item, index) => ({ id: mockData.winners.length - data.length + index + 1, ...item })), error: null })
        };
      },
      update: (data) => ({
        eq: (field, value) => ({
          select: () => Promise.resolve({ data: [{ id: 1, [field]: value, ...data }], error: null })
        })
      }),
      select: (fields) => {
        // Для select создаем цепочку фильтров
        let filteredData = [];
        
        // Определяем начальные данные в зависимости от таблицы
        if (table === 'winners') {
          filteredData = [...mockData.winners];
        }
        
        const queryChain = {
          eq: (field, value) => {
            // Фильтруем данные по полю
            filteredData = filteredData.filter(item => item[field] === value);
            return queryChain;
          },
          order: (field, options) => {
            // Сортируем данные
            if (options && options.ascending === false) {
              filteredData.sort((a, b) => {
                if (a[field] < b[field]) return 1;
                if (a[field] > b[field]) return -1;
                return 0;
              });
            } else {
              filteredData.sort((a, b) => {
                if (a[field] < b[field]) return -1;
                if (a[field] > b[field]) return 1;
                return 0;
              });
            }
            return queryChain;
          },
          limit: (count) => {
            // Ограничиваем количество результатов
            filteredData = filteredData.slice(0, count);
            return queryChain;
          },
          single: () => {
            // Возвращаем один элемент или null с ошибкой
            if (filteredData.length > 0) {
              return Promise.resolve({ data: filteredData[0], error: null });
            } else {
              return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Row not found' } });
            }
          }
        };
        
        // Добавляем метод для выполнения запроса
        queryChain.then = (callback) => {
          return Promise.resolve({ data: filteredData, error: null }).then(callback);
        };
        
        return queryChain;
      }
    };
    return mockTable;
  }
};

function initDatabase() {
  console.log('=== НАЧАЛО ФУНКЦИИ initDatabase ===');
  console.log('Инициализация базы данных...');
  
  // Если клиент уже создан, возвращаем его
  if (supabase) {
    console.log('Клиент уже инициализирован');
    console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
    return supabase;
  }
  
  // Добавим подробное логирование всех переменных окружения
  console.log('Все переменные окружения:');
  Object.keys(process.env).filter(key => key.includes('SUPABASE') || key.includes('RAILWAY')).forEach(key => {
    if (key.includes('KEY')) {
      console.log(`  ${key}: ${process.env[key] ? `SET (length: ${process.env[key].length})` : 'NOT SET'}`);
    } else {
      console.log(`  ${key}: ${process.env[key] || 'NOT SET'}`);
    }
  });
  
  // Если мы на Railway, то переменные должны быть установлены
  if (isRailway) {
    console.log('Запущено на Railway');
    console.log('SUPABASE_URL:', supabaseUrl);
    console.log('SUPABASE_KEY:', supabaseKey ? `SET (length: ${supabaseKey.length})` : 'NOT SET');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('ОШИБКА: На Railway должны быть установлены переменные SUPABASE_URL и SUPABASE_KEY');
      console.error('Пожалуйста, установите их в настройках Railway');
      console.error('Текущие значения:');
      console.error('  SUPABASE_URL:', supabaseUrl || 'undefined');
      console.error('  SUPABASE_KEY:', supabaseKey ? `SET (length: ${supabaseKey.length})` : 'undefined');
      
      // Используем фиктивный клиент, чтобы приложение не падало
      supabase = mockSupabase;
      console.log('Подключение к Supabase установлено (тестовый режим)');
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    }
    
    // Проверяем, что значения не являются плейсхолдерами
    const isPlaceholderUrl = supabaseUrl.includes('your-project') || supabaseUrl.includes('localhost');
    const isPlaceholderKey = supabaseKey.includes('your-') || supabaseKey.includes('test');
    
    if (isPlaceholderUrl || isPlaceholderKey) {
      console.warn('ПРЕДУПРЕЖДЕНИЕ: Обнаружены плейсхолдеры в переменных окружения');
      console.warn('  SUPABASE_URL является плейсхолдером:', isPlaceholderUrl);
      console.warn('  SUPABASE_KEY является плейсхолдером:', isPlaceholderKey);
      
      // Используем фиктивный клиент
      supabase = mockSupabase;
      console.log('Подключение к Supabase установлено (тестовый режим)');
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    }
    
    try {
      console.log('Попытка подключения к Supabase с реальными данными...');
      console.log('SUPABASE_URL:', supabaseUrl);
      console.log('SUPABASE_KEY (первые 10 символов):', supabaseKey.substring(0, 10) + '...');
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Подключение к Supabase установлено');
      
      // Проверяем подключение, выполнив простой запрос
      console.log('Проверка подключения к базе данных...');
      supabase
        .from('winners')
        .select('count')
        .limit(1)
        .then(result => {
          if (result.error) {
            console.warn('Предупреждение: Ошибка при проверке подключения к таблице winners:', result.error.message);
            // Это может быть нормально, если таблица еще не создана
          } else {
            console.log('Проверка подключения успешна, таблица winners доступна');
          }
        })
        .catch(error => {
          console.warn('Предупреждение: Исключение при проверке подключения:', error.message);
        });
      
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    } catch (error) {
      console.error('Ошибка при подключении к Supabase:', error);
      console.error('Stack trace:', error.stack);
      console.warn('Используется фиктивный клиент для тестирования.');
      supabase = mockSupabase;
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    }
  }
  
  // Для локальной разработки проверяем реальные значения
  const isRealUrl = supabaseUrl && !supabaseUrl.includes('your-project.supabase.co');
  const isRealKey = supabaseKey && !supabaseKey.includes('your_supabase_key_here');
  
  console.log('Локальная разработка:');
  console.log('  SUPABASE_URL установлен:', !!supabaseUrl);
  console.log('  SUPABASE_KEY установлен:', !!supabaseKey);
  console.log('  Реальный URL:', isRealUrl);
  console.log('  Реальный ключ:', isRealKey);
  
  if (!supabaseUrl || !supabaseKey || !isRealUrl || !isRealKey) {
    console.warn('Не найдены настоящие SUPABASE_URL или SUPABASE_KEY в переменных окружения. Используется фиктивный клиент для тестирования.');
    console.log('Текущие значения:');
    console.log('  SUPABASE_URL:', supabaseUrl || 'NOT SET');
    console.log('  SUPABASE_KEY:', supabaseKey ? 'SET (длина: ' + supabaseKey.length + ')' : 'NOT SET');
    supabase = mockSupabase;
    console.log('Подключение к Supabase установлено (тестовый режим)');
    console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
    return supabase;
  }

  try {
    console.log('Попытка подключения к Supabase с реальными данными (локальная разработка)...');
    console.log('SUPABASE_URL:', supabaseUrl);
    console.log('SUPABASE_KEY (первые 10 символов):', supabaseKey.substring(0, 10) + '...');
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Подключение к Supabase установлено');
    
    // Проверяем подключение, выполнив простой запрос
    console.log('Проверка подключения к базе данных...');
    supabase
      .from('winners')
      .select('count')
      .limit(1)
      .then(result => {
        if (result.error) {
          console.warn('Предупреждение: Ошибка при проверке подключения к таблице winners:', result.error.message);
          // Это может быть нормально, если таблица еще не создана
        } else {
          console.log('Проверка подключения успешна, таблица winners доступна');
        }
      })
      .catch(error => {
        console.warn('Предупреждение: Исключение при проверке подключения:', error.message);
      });
    
    console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
    return supabase;
  } catch (error) {
    console.error('Ошибка при подключении к Supabase:', error);
    console.error('Stack trace:', error.stack);
    console.warn('Используется фиктивный клиент для тестирования.');
    supabase = mockSupabase;
    console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
    return supabase;
  }
}

// Функции для работы с розыгрышами
async function createGiveaway(channel, keyword, prize) {
  console.log('=== НАЧАЛО ФУНКЦИИ createGiveaway ===');
  // Приводим ключевое слово к нижнему регистру для корректного сравнения
  const normalizedKeyword = keyword.toLowerCase();
  
  console.log('Создание розыгрыша с параметрами:', { channel, originalKeyword: keyword, normalizedKeyword, prize });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.warn('Supabase клиент не инициализирован, используем фиктивные данные');
    // Возвращаем фиктивные данные для тестирования
    const fakeData = {
      id: Date.now(),
      channel,
      keyword: normalizedKeyword,
      prize,
      started_at: new Date(),
      is_active: true
    };
    console.log('Возвращаем фиктивные данные розыгрыша:', fakeData);
    console.log('=== КОНЕЦ ФУНКЦИИ createGiveaway ===');
    return fakeData;
  }
  
  console.log('Попытка созданияания розыгрыша в Supabase:', { channel, keyword: normalizedKeyword, prize });
  
  try {
    const { data, error } = await supabase
      .from('giveaways')
      .insert([
        {
          channel,
          keyword: normalizedKeyword,
          prize,
          started_at: new Date(),
          is_active: true
        }
      ])
      .select();

    if (error) {
      console.error('Ошибка при создании розыгрыша в Supabase:', error);
      console.error('Детали ошибки:', JSON.stringify(error, null, 2));
      // Возвращаем фиктивные данные для тестирования
      const fakeData = {
        id: Date.now(),
        channel,
        keyword: normalizedKeyword,
        prize,
        started_at: new Date(),
        is_active: true
      };
      console.log('Возвращаем фиктивные данные из-за ошибки:', fakeData);
      console.log('=== КОНЕЦ ФУНКЦИИ createGiveaway ===');
      return fakeData;
    }
    
    console.log('Успешно создан розыгрыш в Supabase:', data);
    console.log('=== КОНЕЦ ФУНКЦИИ createGiveaway ===');
    return data[0];
  } catch (error) {
    console.error('Исключение при создании розыгрыша:', error);
    // Возвращаем фиктивные данные для тестирования
    const fakeData = {
      id: Date.now(),
      channel,
      keyword: normalizedKeyword,
      prize,
      started_at: new Date(),
      is_active: true
    };
    console.log('Возвращаем фиктивные данные из-за исключения:', fakeData);
    console.log('=== КОНЕЦ ФУНКЦИИ createGiveaway ===');
    return fakeData;
  }
}

async function addParticipant(giveawayId, username) {
  console.log('=== НАЧАЛО ФУНКЦИИ addParticipant ===');
  console.log('Попытка добавления участника:', { giveawayId, username });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.warn('Supabase клиент не инициализирован, используем фиктивную реализацию');
    // Возвращаем фиктивные данные для тестирования
    const fakeData = {
      id: Date.now(),
      giveaway_id: giveawayId,
      username: username,
      participated_at: new Date()
    };
    console.log('Возвращаем фиктивные данные участника:', fakeData);
    console.log('=== КОНЕЦ ФУНКЦИИ addParticipant ===');
    return fakeData;
  }
  
  const { data, error } = await supabase
    .from('participants')
    .insert([
      {
        giveaway_id: giveawayId,
        username,
        participated_at: new Date()
      }
    ])
    .select();

  if (error) {
    console.error('Ошибка при добавлении участника:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ addParticipant ===');
    return null;
  }
  
  console.log('Участник успешно добавлен:', data[0]);
  console.log('=== КОНЕЦ ФУНКЦИИ addParticipant ===');
  return data[0];
}

async function selectWinner(giveawayId) {
  console.log('=== НАЧАЛО ФУНКЦИИ selectWinner ===');
  console.log('Выбор победителя для розыгрыша:', { giveawayId });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
    return null;
  }
  
  // Получаем все данные о розыгрыше
  console.log('Получение данных о розыгрыше:', { giveawayId });
  const { data: giveawayData, error: giveawayError } = await supabase
    .from('giveaways')
    .select('*')
    .eq('id', giveawayId)
    .single();

  if (giveawayError) {
    console.error('Ошибка при получении данных розыгрыша:', giveawayError);
    console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
    return null;
  }
  
  // Получаем всех участников розыгрыша
  console.log('Получение участников розыгрыша:', { giveawayId });
  const { data: participants, error } = await supabase
    .from('participants')
    .select('username')
    .eq('giveaway_id', giveawayId);

  if (error) {
    console.error('Ошибка при получении участников:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
    return null;
  }

  if (participants.length === 0) {
    console.log('Участников нет, обновление записи о розыгрыше');
    // Обновляем запись о розыгрыше, даже если нет участников
    const { data: updatedGiveaway, error: updateError } = await supabase
      .from('giveaways')
      .update({ 
        is_active: false, 
        ended_at: new Date()
      })
      .eq('id', giveawayId)
      .select();

    if (updateError) {
      console.error('Ошибка при обновлении розыгрыша:', updateError);
      console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
      return null;
    }
    
    console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
    return null;
  }

  // Выбираем случайного победителя
  console.log('Выбор случайного победителя из участников:', participants.length);
  const winnerIndex = Math.floor(Math.random() * participants.length);
  const winner = participants[winnerIndex];
  console.log('Выбран победитель:', winner);

  // Обновляем запись о розыгрыше с информацией о победителе
  console.log('Обновление записи о розыгрыше с информацией о победителе');
  const { data: updatedGiveaway, error: updateError } = await supabase
    .from('giveaways')
    .update({ 
      is_active: false, 
      ended_at: new Date(),
      winner: winner.username
    })
    .eq('id', giveawayId)
    .select();

  if (updateError) {
    console.error('Ошибка при обновлении розыгрыша:', updateError);
    console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
    return null;
  }

  // Возвращаем объект с информацией о победителе и канале
  const result = {
    winner: winner.username,
    channel: giveawayData.channel,
    prize: giveawayData.prize
  };
  console.log('Возвращаем результат:', result);
  console.log('=== КОНЕЦ ФУНКЦИИ selectWinner ===');
  return result;
}

async function getGiveaways(channel) {
  console.log('=== НАЧАЛО ФУНКЦИИ getGiveaways ===');
  console.log('Получение розыгрышей для канала:', { channel });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    console.log('=== КОНЕЦ ФУНКЦИИ getGiveaways ===');
    return [];
  }
  
  const { data, error } = await supabase
    .from('giveaways')
    .select('*')
    .eq('channel', channel)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Ошибка при получении розыгрышей:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ getGiveaways ===');
    return [];
  }
  
  console.log('Получены розыгрыши:', data.length);
  console.log('=== КОНЕЦ ФУНКЦИИ getGiveaways ===');
  return data;
}

// Функция для добавления победителя в таблицу winners
async function addWinner(username, channel, prize, telegram = null) {
  console.log('=== НАЧАЛО ФУНКЦИИ addWinner ===');
  console.log('Попытка добавления победителя:', { username, channel, prize, telegram });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.warn('Supabase клиент не инициализирован, используем фиктивную реализацию');
    // Возвращаем фиктивные данные для тестирования
    const fakeData = {
      id: Date.now(),
      username,
      channel,
      prize,
      telegram,
      win_time: new Date(),
      total_wins: 1,
      created_at: new Date()
    };
    console.log('Возвращаем фиктивные данные победителя:', fakeData);
    console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
    return fakeData;
  }
  
  try {
    // Проверяем, есть ли уже запись о победителе с тем же именем пользователя и каналом в последнюю минуту
    // Это предотвратит дублирование при быстрых последовательных вызовах
    console.log('Проверка существующих записей о победителе за последнюю минуту');
    const oneMinuteAgo = new Date(Date.now() - 60000); // 1 минута назад
    
    // Для реального клиента используем gte, для мок-клиента фильтруем вручную
    let recentWinnersQuery = supabase
      .from('winners')
      .select('id, total_wins, win_time')
      .eq('username', username)
      .eq('channel', channel);
      
    // Проверяем, поддерживает ли клиент метод gte (реальный клиент поддерживает, мок - нет)
    if (typeof recentWinnersQuery.gte === 'function') {
      recentWinnersQuery = recentWinnersQuery.gte('win_time', oneMinuteAgo.toISOString());
    }
    
    const { data: recentWinners, error: fetchError } = await recentWinnersQuery
      .order('win_time', { ascending: false });

    if (fetchError) {
      console.log('Ошибка при поиске существующих записей (это нормально, если запись не найдена):', fetchError.message);
      // Проверяем, является ли ошибка "не найдено" - это нормально
      if (fetchError.code !== 'PGRST116') { // Код ошибки "Row not found"
        console.error('Неожиданная ошибка при поиске существующей записи:', fetchError);
      }
    } else if (recentWinners && recentWinners.length > 0) {
      // Для мок-клиента фильтруем вручную по времени
      let filteredWinners = recentWinners;
      if (typeof supabase.from !== 'function' || supabase === mockSupabase) {
        // Это мок-клиент, фильтруем вручную
        filteredWinners = recentWinners.filter(winner => 
          new Date(winner.win_time) >= oneMinuteAgo
        );
      }
      
      if (filteredWinners.length > 0) {
        // Если найдены недавние записи, возвращаем самую последнюю
        console.log('Найдены недавние записи победителя, возвращаем последнюю:', filteredWinners[0]);
        console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
        return filteredWinners[0];
      }
    }
    
    // Если недавних записей нет, проверяем общее количество побед
    console.log('Проверка общего количества побед для пользователя');
    const { data: allWinners, error: allWinnersError } = await supabase
      .from('winners')
      .select('total_wins')
      .eq('username', username)
      .eq('channel', channel)
      .order('win_time', { ascending: false })
      .limit(1)
      .single();
    
    let totalWins = 1;
    if (allWinners && !allWinnersError) {
      totalWins = allWinners.total_wins + 1;
      console.log('Найдены предыдущие победы, увеличиваем счетчик побед:', totalWins);
    } else {
      if (allWinnersError) {
        console.log('Ошибка при поиске предыдущих побед (это нормально, если запись не найдена):', allWinnersError.message);
        // Проверяем, является ли ошибка "не найдено" - это нормально
        if (allWinnersError.code !== 'PGRST116') { // Код ошибки "Row not found"
          console.error('Неожиданная ошибка при поиске предыдущих побед:', allWinnersError);
        }
      }
      console.log('Предыдущие победы не найдены, начинаем с 1 победы');
    }
    
    // Подготавливаем данные для вставки
    const winnerData = {
      username,
      channel,
      win_time: new Date(),
      total_wins: totalWins,
      created_at: new Date()
    };
    
    // Добавляем приз, если он указан
    if (prize !== null && prize !== undefined) {
      winnerData.prize = prize;
    }
    
    // Добавляем Telegram, если он указан
    if (telegram !== null) {
      winnerData.telegram = telegram;
    }
    
    console.log('Подготовленные данные для вставки:', winnerData);
    
    // Добавляем победителя в таблицу
    console.log('Добавление победителя в таблицу winners');
    const { data, error } = await supabase
      .from('winners')
      .insert([winnerData])
      .select();

    if (error) {
      console.error('Ошибка при добавлении победителя:', error);
      console.error('Детали ошибки:', JSON.stringify(error, null, 2));
      console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
      return { error: error.message, details: error };
    }
    
    console.log('Победитель успешно добавлен:', data[0]);
    console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
    return data[0];
  } catch (error) {
    console.error('Исключение при добавлении победителя:', error);
    console.error('Stack trace:', error.stack);
    console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
    return { error: error.message, exception: error };
  }
}

// Функция для получения истории победителей
async function getWinnersHistory(channel, limit = 100) {
  console.log('=== НАЧАЛО ФУНКЦИИ getWinnersHistory ===');
  console.log('Получение истории победителей для канала:', { channel, limit });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
    throw new Error('Supabase клиент не инициализирован');
  }
  
  try {
    console.log('Выполняем запрос к базе данных Supabase');
    // Сначала попробуем получить все данные без ограничений, чтобы понять объем
    const { data: allData, error: countError } = await supabase
      .from('winners')
      .select('*', { count: 'exact' })
      .eq('channel', channel);
      
    if (countError) {
      console.log('Не удалось получить общее количество записей:', countError.message);
    } else {
      console.log('Общее количество записей в таблице для канала:', allData.length);
    }
    
    // Теперь выполняем основной запрос с лимитом
    const { data, error } = await supabase
      .from('winners')
      .select('*')
      .eq('channel', channel)
      .order('win_time', { ascending: false })
      .limit(limit);

    console.log('Результат запроса к базе данных:', { 
      hasData: !!data, 
      dataLength: data ? data.length : 0,
      hasError: !!error,
      error: error ? error.message : null
    });

    if (error) {
      console.error('Ошибка при получении истории победителей:', error);
      console.error('Детали ошибки:', JSON.stringify(error, null, 2));
      console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
      throw new Error(`Ошибка базы данных: ${error.message}`);
    }
    
    // Проверяем, что data определен
    const result = data || [];
    console.log('Получена история победителей:', result.length);
    
    // Выводим информацию о первых нескольких победителях для отладки
    if (result.length > 0) {
      console.log('Первые 3 победителя:', result.slice(0, 3));
    }
    
    // Удаляем дубликаты, если они есть, используя более строгую проверку
    const uniqueResult = result.filter((winner, index, self) => {
      // Проверяем по username и точному времени (с точностью до секунды)
      const winnerTime = new Date(winner.win_time).getTime();
      return index === self.findIndex(w => 
        w.username === winner.username && 
        Math.abs(new Date(w.win_time).getTime() - winnerTime) < 1000 // Разница менее 1 секунды
      );
    });
    
    if (uniqueResult.length !== result.length) {
        console.log('Удалены дубликаты. Было:', result.length, 'Стало:', uniqueResult.length);
    }
    
    console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
    return uniqueResult;
  } catch (error) {
    console.error('Исключение при получении истории победителей:', error);
    console.error('Stack trace:', error.stack);
    console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
    throw new Error(`Исключение при получении истории победителей: ${error.message}`);
  }
}

// Функция для обновления Telegram победителя
async function updateWinnerTelegram(username, channel, telegram) {
  console.log('=== НАЧАЛО ФУНКЦИИ updateWinnerTelegram ===');
  console.log('Обновление Telegram для победителя:', { username, channel, telegram });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.warn('Supabase клиент не инициализирован');
    console.log('=== КОНЕЦ ФУНКЦИИ updateWinnerTelegram ===');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('winners')
      .update({ telegram: telegram })
      .eq('username', username)
      .eq('channel', channel)
      .order('win_time', { ascending: false })
      .limit(1)
      .select();

    if (error) {
      console.error('Ошибка при обновлении Telegram победителя:', error);
      console.log('=== КОНЕЦ ФУНКЦИИ updateWinnerTelegram ===');
      return null;
    }
    
    console.log('Telegram победителя успешно обновлен:', data[0]);
    console.log('=== КОНЕЦ ФУНКЦИИ updateWinnerTelegram ===');
    return data[0];
  } catch (error) {
    console.error('Исключение при обновлении Telegram победителя:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ updateWinnerTelegram ===');
    return null;
  }
}

module.exports = {
  initDatabase,
  createGiveaway,
  addParticipant,
  selectWinner,
  getGiveaways,
  addWinner,
  getWinnersHistory,
  updateWinnerTelegram,
  supabase,
  mockSupabase // Экспортируем mockSupabase для использования в других модулях
};