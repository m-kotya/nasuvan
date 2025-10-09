// Скрипт для диагностики проблемы с Supabase клиентом
console.log('=== ДИАГНОСТИКА SUPABASE КЛИЕНТА ===');

// Проверяем переменные окружения
console.log('1. Проверка переменных окружения:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET');
console.log('   SUPABASE_KEY:', process.env.SUPABASE_KEY ? `SET (length: ${process.env.SUPABASE_KEY.length})` : 'NOT SET');

// Проверяем Railway переменные
console.log('2. Проверка Railway переменных:');
console.log('   RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID || 'NOT SET');
console.log('   RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME || 'NOT SET');

// Пробуем импортировать и инициализировать Supabase клиент
try {
  console.log('3. Попытка импорта supabaseClient...');
  const { initDatabase, supabase } = require('./src/database/supabaseClient');
  
  console.log('4. Состояние клиента до инициализации:');
  console.log('   supabase:', supabase ? 'СУЩЕСТВУЕТ' : 'НЕ СУЩЕСТВУЕТ');
  
  console.log('5. Попытка инициализации базы данных...');
  const initializedClient = initDatabase();
  
  console.log('6. Состояние клиента после инициализации:');
  console.log('   initializedClient:', initializedClient ? 'СУЩЕСТВУЕТ' : 'НЕ СУЩЕСТВУЕТ');
  
  if (initializedClient) {
    console.log('7. Тип клиента:', typeof initializedClient);
    console.log('8. Методы клиента:', Object.keys(initializedClient).slice(0, 10)); // Показываем первые 10 методов
  }
} catch (error) {
  console.error('Ошибка при диагностики Supabase клиента:', error.message);
  console.error('Stack trace:', error.stack);
}

console.log('=== КОНЕЦ ДИАГНОСТИКИ ===');