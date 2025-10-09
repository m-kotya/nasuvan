// Скрипт для проверки переменных окружения на railway.com
console.log('=== ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RAILWAY ===');

// Проверяем, запущены ли мы на Railway
const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
console.log('Запущено на Railway:', isRailway ? 'ДА' : 'НЕТ');

if (isRailway) {
  console.log('Railway Environment Variables:');
  console.log('  RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID || 'NOT SET');
  console.log('  RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME || 'NOT SET');
  
  console.log('\nSupabase Environment Variables:');
  console.log('  SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET');
  console.log('  SUPABASE_KEY:', process.env.SUPABASE_KEY ? `SET (length: ${process.env.SUPABASE_KEY.length})` : 'NOT SET');
  
  // Проверяем, являются ли значения плейсхолдерами
  if (process.env.SUPABASE_URL) {
    const isPlaceholderUrl = process.env.SUPABASE_URL.includes('your-project') || process.env.SUPABASE_URL.includes('localhost');
    console.log('  SUPABASE_URL является плейсхолдером:', isPlaceholderUrl);
  }
  
  if (process.env.SUPABASE_KEY) {
    const isPlaceholderKey = process.env.SUPABASE_KEY.includes('your-') || process.env.SUPABASE_KEY.includes('test');
    console.log('  SUPABASE_KEY является плейсхолдером:', isPlaceholderKey);
  }
  
  console.log('\nВсе переменные окружения с SUPABASE или RAILWAY:');
  Object.keys(process.env)
    .filter(key => key.includes('SUPABASE') || key.includes('RAILWAY'))
    .sort()
    .forEach(key => {
      if (key.includes('KEY')) {
        console.log(`  ${key}: ${process.env[key] ? `SET (length: ${process.env[key].length})` : 'NOT SET'}`);
      } else {
        console.log(`  ${key}: ${process.env[key] || 'NOT SET'}`);
      }
    });
} else {
  console.log('Приложение не запущено на Railway');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET');
  console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? `SET (length: ${process.env.SUPABASE_KEY.length})` : 'NOT SET');
}

console.log('=== КОНЕЦ ПРОВЕРКИ ===');