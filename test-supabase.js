// Тестовый скрипт для проверки подключения к Supabase
require('dotenv').config();
const { initDatabase } = require('./src/database/supabaseClient');

console.log('Проверка подключения к Supabase...');

const supabase = initDatabase();

if (supabase) {
  console.log('✅ Подключение к Supabase успешно установлено');
} else {
  console.log('❌ Ошибка подключения к Supabase');
  console.log('Проверьте переменные окружения:');
  console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'Установлен' : 'Не установлен');
  console.log('- SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Установлен' : 'Не установлен');
}