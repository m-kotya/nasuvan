require('dotenv').config();

console.log('=== Проверка конфигурации Twitch Giveaway Bot ===\n');

// Проверяем обязательные переменные окружения
const requiredEnvVars = [
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'TWITCH_OAUTH_TOKEN',
  'TWITCH_BOT_USERNAME',
  'APP_URL'
];

let allSet = true;

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar] || process.env[envVar] === `your_${envVar.toLowerCase()}_here` || process.env[envVar].includes('placeholder')) {
    console.log(`❌ ${envVar}: НЕ УСТАНОВЛЕНА или содержит плейсхолдер`);
    allSet = false;
  } else {
    console.log(`✅ ${envVar}: Установлена`);
  }
});

console.log('\n=== Дополнительные проверки ===\n');

// Проверяем формат APP_URL
if (process.env.APP_URL) {
  if (process.env.APP_URL.startsWith('http://') || process.env.APP_URL.startsWith('https://')) {
    console.log('✅ APP_URL имеет правильный формат');
  } else {
    console.log('❌ APP_URL: должен начинаться с http:// или https://');
    allSet = false;
  }
  
  if (process.env.APP_URL.endsWith('/')) {
    console.log('⚠️  APP_URL: заканчивается на слеш (рекомендуется убрать)');
  }
}

// Проверяем формат TWITCH_OAUTH_TOKEN
if (process.env.TWITCH_OAUTH_TOKEN) {
  if (process.env.TWITCH_OAUTH_TOKEN.startsWith('oauth:')) {
    console.log('✅ TWITCH_OAUTH_TOKEN имеет правильный формат');
  } else {
    console.log('⚠️  TWITCH_OAUTH_TOKEN: рекомендуется начинать с "oauth:"');
  }
}

console.log('\n=== Результат ===\n');

if (allSet) {
  console.log('🎉 Все обязательные переменные окружения установлены правильно');
  console.log('✅ Конфигурация готова для использования');
} else {
  console.log('❌ Некоторые обязательные переменные окружения не установлены или содержат плейсхолдеры');
  console.log('🔧 Пожалуйста, проверьте файл .env и убедитесь, что все значения заполнены правильно');
}