const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase клиента
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

// Фиктивный клиент для тестирования
const mockSupabase = {
  from: (table) => ({
    insert: (data) => ({
      select: () => Promise.resolve({ data: [{ id: 1, ...data[0] }], error: null })
    }),
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
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Не найдены SUPABASE_URL или SUPABASE_KEY в переменных окружения. Используется фиктивный клиент для тестирования.');
    supabase = mockSupabase;
    console.log('Подключение к Supabase установлено (тестовый режим)');
    return supabase;
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Подключение к Supabase установлено');
  return supabase;
}

// Функции для работы с розыгрышами
async function createGiveaway(channel, keyword, prize) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    return null;
  }
  
  const { data, error } = await supabase
    .from('giveaways')
    .insert([
      {
        channel,
        keyword,
        prize,
        started_at: new Date(),
        is_active: true
      }
    ])
    .select();

  if (error) {
    console.error('Ошибка при создании розыгрыша:', error);
    return null;
  }

  return data[0];
}

async function addParticipant(giveawayId, username) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
    return null;
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

  return data[0];
}

async function selectWinner(giveawayId) {
  // Проверяем, инициализирован ли клиент
  if (!supabase) {
    console.error('Supabase клиент не инициализирован');
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

  return winner.username;
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

module.exports = {
  initDatabase,
  createGiveaway,
  addParticipant,
  selectWinner,
  getGiveaways,
  supabase
};