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
  console.log('Инициализация базы данных...');
  
  // Если мы на Railway, то переменные должны быть установлены
  if (isRailway) {
    if (!supabaseUrl || !supabaseKey) {
      console.error('ОШИБКА: На Railway должны быть установлены переменные SUPABASE_URL и SUPABASE_KEY');
      console.error('Пожалуйста, установите их в настройках Railway');
      // Все равно продолжаем работу с фиктивным клиентом, чтобы приложение не падало
      supabase = mockSupabase;
      console.log('Подключение к Supabase установлено (тестовый режим)');
      return supabase;
    }
    
    try {
      console.log('Попытка подключения к Supabase с реальными данными...');
      console.log('SUPABASE_URL:', supabaseUrl);
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Подключение к Supabase установлено');
      return supabase;
    } catch (error) {
      console.error('Ошибка при подключении к Supabase:', error);
      console.warn('Используется фиктивный клиент для тестирования.');
      supabase = mockSupabase;
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
    return supabase;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Подключение к Supabase установлено');
    return supabase;
  } catch (error) {
    console.error('Ошибка при подключении к Supabase:', error);
    console.warn('Используется фиктивный клиент для тестирования.');
    supabase = mockSupabase;
    return supabase;
  }
}

// Функции для работы с розыгрышами
async function createGiveaway(channel, keyword, prize) {
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
    return fakeData;
  }
  
  console.log('Попытка создания розыгрыша в Supabase:', { channel, keyword: normalizedKeyword, prize });
  
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
      return fakeData;
    }
    
    console.log('Успешно создан розыгрыш в Supabase:', data);
    
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
    return fakeData;
  }
}

async function addParticipant(giveawayId, username) {
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
    return null;
  }
  
  console.log('Участник успешно добавлен:', data[0]);
  return data[0];
}

async function selectWinner(giveawayId) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    return null;
  }
  
  // Получаем все данные о розыгрыше
  const { data: giveawayData, error: giveawayError } = await supabase
    .from('giveaways')
    .select('*')
    .eq('id', giveawayId)
    .single();

  if (giveawayError) {
    console.error('Ошибка при получении данных розыгрыша:', giveawayError);
    return null;
  }
  
  // Получаем всех участников розыгрыша
  const { data: participants, error } = await supabase
    .from('participants')
    .select('username')
    .eq('giveaway_id', giveawayId);

  if (error) {
    console.error('Ошибка при получении участников:', error);
    return null;
  }

  if (participants.length === 0) {
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
      return null;
    }
    
    return null;
  }

  // Выбираем случайного победителя
  const winnerIndex = Math.floor(Math.random() * participants.length);
  const winner = participants[winnerIndex];

  // Обновляем запись о розыгрыше с информацией о победителе
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
    return null;
  }

  // Возвращаем объект с информацией о победителе и канале
  return {
    winner: winner.username,
    channel: giveawayData.channel,
    prize: giveawayData.prize
  };
}

async function getGiveaways(channel) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    return [];
  }
  
  const { data, error } = await supabase
    .from('giveaways')
    .select('*')
    .eq('channel', channel)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Ошибка при получении розыгрышей:', error);
    return [];
  }

  return data;
}

// Функция для добавления победителя в таблицу winners
async function addWinner(username, channel, prize, telegram = null) {
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
    return fakeData;
  }
  
  try {
    // Проверяем, есть ли уже запись о победителе в этой таблице
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
    }
    
    // Добавляем победителя в таблицу
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
      return null;
    }
    
    console.log('Победитель успешно добавлен:', data[0]);
    return data[0];
  } catch (error) {
    console.error('Исключение при добавлении победителя:', error);
    return null;
  }
}

// Функция для получения истории победителей
async function getWinnersHistory(channel, limit = 10) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
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
      return [];
    }

    return data;
  } catch (error) {
    console.error('Исключение при получении истории победителей:', error);
    return [];
  }
}

// Функция для обновления Telegram победителя
async function updateWinnerTelegram(username, channel, telegram) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.warn('Supabase клиент не инициализирован');
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
      return null;
    }
    
    console.log('Telegram победителя успешно обновлен:', data[0]);
    return data[0];
  } catch (error) {
    console.error('Исключение при обновлении Telegram победителя:', error);
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