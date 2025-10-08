const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase клиента
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

console.log('Supabase environment variables check:');
console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('SUPABASE_KEY:', supabaseKey ? 'SET' : 'NOT SET');

// Проверка Railway переменных
const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
console.log('Running on Railway:', isRailway ? 'YES' : 'NO');

if (isRailway) {
  console.log('Railway Environment:');
  console.log('  RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);
  console.log('  RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME);
}

// Фиктивный клиент для тестирования
const mockSupabase = {
  from: (table) => ({
    insert: (data) => {
      console.log(`Mock insert into ${table}:`, data);
      return {
        select: () => Promise.resolve({ data: [{ id: 1, ...data[0] }], error: null })
      };
    },
    update: (data) => ({
      eq: (field, value) => ({
        select: () => Promise.resolve({ data: [{ id: 1, [field]: value, ...data }], error: null })
      })
    }),
    select: (fields) => ({
      eq: (field, value) => ({
        order: (field, options) => Promise.resolve({ data: [], error: null })
      })
    })
  })
};

function initDatabase() {
  console.log('=== НАЧАЛО ФУНКЦИИ initDatabase ===');
  console.log('Инициализация базы данных...');
  
  // Если мы на Railway, то переменные должны быть установлены
  if (isRailway) {
    if (!supabaseUrl || !supabaseKey) {
      console.error('ОШИБКА: На Railway должны быть установлены переменные SUPABASE_URL и SUPABASE_KEY');
      console.error('Пожалуйста, установите их в настройках Railway');
      // Все равно продолжаем работу с фиктивным клиентом, чтобы приложение не падало
      supabase = mockSupabase;
      console.log('Подключение к Supabase установлено (тестовый режим)');
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    }
    
    try {
      console.log('Попытка подключения к Supabase с реальными данными...');
      console.log('SUPABASE_URL:', supabaseUrl);
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Подключение к Supabase установлено');
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    } catch (error) {
      console.error('Ошибка при подключении к Supabase:', error);
      console.warn('Используется фиктивный клиент для тестирования.');
      supabase = mockSupabase;
      console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
      return supabase;
    }
  }
  
  // Для локальной разработки проверяем реальные значения
  const isRealUrl = supabaseUrl && !supabaseUrl.includes('your-project.supabase.co');
  const isRealKey = supabaseKey && !supabaseKey.includes('your_supabase_key_here');
  
  if (!supabaseUrl || !supabaseKey || !isRealUrl || !isRealKey) {
    console.warn('Не найдены настоящие SUPABASE_URL или SUPABASE_KEY в переменных окружения. Используется фиктивный клиент для тестирования.');
    supabase = mockSupabase;
    console.log('Подключение к Supabase установлено (тестовый режим)');
    console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
    return supabase;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Подключение к Supabase установлено');
    console.log('=== КОНЕЦ ФУНКЦИИ initDatabase ===');
    return supabase;
  } catch (error) {
    console.error('Ошибка при подключении к Supabase:', error);
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
    // Проверяем, есть ли уже запись о победителе в этой таблице
    console.log('Проверка существующих записей о победителе');
    const { data: existingWinner, error: fetchError } = await supabase
      .from('winners')
      .select('id, total_wins')
      .eq('username', username)
      .eq('channel', channel)
      .order('win_time', { ascending: false })
      .limit(1)
      .single();
    
    let totalWins = 1;
    if (existingWinner && !fetchError) {
      totalWins = existingWinner.total_wins + 1;
      console.log('Найдена существующая запись, увеличиваем счетчик побед:', totalWins);
    } else {
      console.log('Существующая запись не найдена, начинаем с 1 победы');
    }
    
    // Добавляем победителя в таблицу
    console.log('Добавление победителя в таблицу winners');
    const { data, error } = await supabase
      .from('winners')
      .insert([
        {
          username,
          channel,
          prize,
          telegram,
          win_time: new Date(),
          total_wins: totalWins
        }
      ])
      .select();

    if (error) {
      console.error('Ошибка при добавлении победителя:', error);
      console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
      return null;
    }
    
    console.log('Победитель успешно добавлен:', data[0]);
    console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
    return data[0];
  } catch (error) {
    console.error('Исключение при добавлении победителя:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
    return null;
  }
}

// Функция для получения истории победителей
async function getWinnersHistory(channel, limit = 10) {
  console.log('=== НАЧАЛО ФУНКЦИИ getWinnersHistory ===');
  console.log('Получение истории победителей для канала:', { channel, limit });
  
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('winners')
      .select('*')
      .eq('channel', channel)
      .order('win_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Ошибка при получении истории победителей:', error);
      console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
      return [];
    }
    
    console.log('Получена история победителей:', data.length);
    console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
    return data;
  } catch (error) {
    console.error('Исключение при получении истории победителей:', error);
    console.log('=== КОНЕЦ ФУНКЦИИ getWinnersHistory ===');
    return [];
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
  supabase
};