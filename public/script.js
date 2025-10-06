// Элементы DOM
const authBtn = document.getElementById('authBtn');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const giveawayKeywordInput = document.getElementById('giveawayKeyword');
const giveawayPrizeInput = document.getElementById('giveawayPrize');
const startGiveawayBtn = document.getElementById('startGiveawayBtn');
const endGiveawayBtn = document.getElementById('endGiveawayBtn');
const selectWinnerBtn = document.getElementById('selectWinnerBtn');
const chatMessages = document.getElementById('chatMessages');
const winnersList = document.getElementById('winnersList');

// Обработчики событий
authBtn.addEventListener('click', handleAuth);
sendChatBtn.addEventListener('click', handleSendChat);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSendChat();
    }
});
startGiveawayBtn.addEventListener('click', handleStartGiveaway);
endGiveawayBtn.addEventListener('click', handleEndGiveaway);
selectWinnerBtn.addEventListener('click', handleSelectWinner);

// Функция обработки авторизации
function handleAuth() {
    // Показываем индикатор загрузки
    const originalText = authBtn.innerHTML;
    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Перенаправление...';
    authBtn.disabled = true;
    
    // Перенаправляем на маршрут авторизации Twitch
    window.location.href = '/auth/twitch';
}

// Функция отправки сообщения в чат
function handleSendChat() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Добавляем сообщение в чат
    addChatMessage('user', 'Вы', message);
    chatInput.value = '';
    
    // Имитация ответа бота
    setTimeout(() => {
        addChatMessage('bot', 'Бот', 'Сообщение получено!');
    }, 1000);
}

// Функция добавления сообщения в чат
function addChatMessage(type, user, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    messageDiv.innerHTML = `
        <span class="message-user">${user}:</span>
        <span class="message-text">${text}</span>
        <span class="message-time">${timeString}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Функция начала розыгрыша
function handleStartGiveaway() {
    const keyword = giveawayKeywordInput.value.trim();
    const prize = giveawayPrizeInput.value.trim();
    
    if (!keyword) {
        showNotification('Пожалуйста, введите кодовое слово', 'error');
        return;
    }
    
    if (!prize) {
        showNotification('Пожалуйста, введите описание приза', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = startGiveawayBtn.innerHTML;
    startGiveawayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Начало...';
    startGiveawayBtn.disabled = true;
    
    // Имитация начала розыгрыша
    setTimeout(() => {
        addChatMessage('system', 'Система', `Розыгрыш "${prize}" начат! Кодовое слово: "${keyword}"`);
        showNotification(`Розыгрыш "${prize}" начат с кодовым словом "${keyword}"`, 'success');
        
        // Восстанавливаем кнопку
        startGiveawayBtn.innerHTML = originalText;
        startGiveawayBtn.disabled = false;
    }, 1000);
}

// Функция завершения розыгрыша
function handleEndGiveaway() {
    // Показываем индикатор загрузки
    const originalText = endGiveawayBtn.innerHTML;
    endGiveawayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Завершение...';
    endGiveawayBtn.disabled = true;
    
    // Имитация завершения розыгрыша
    setTimeout(() => {
        addChatMessage('system', 'Система', 'Розыгрыш завершен!');
        showNotification('Розыгрыш завершен', 'success');
        
        // Восстанавливаем кнопку
        endGiveawayBtn.innerHTML = originalText;
        endGiveawayBtn.disabled = false;
    }, 1000);
}

// Функция выбора победителя
function handleSelectWinner() {
    // Показываем индикатор загрузки
    const originalText = selectWinnerBtn.innerHTML;
    selectWinnerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Выбор...';
    selectWinnerBtn.disabled = true;
    
    // Имитация выбора победителя
    setTimeout(() => {
        const winners = ['User123', 'GamerPro', 'TwitchFan', 'StreamLover', 'ChatHero'];
        const randomWinner = winners[Math.floor(Math.random() * winners.length)];
        const prize = giveawayPrizeInput.value.trim() || 'Приз';
        
        addChatMessage('system', 'Система', `Победитель: ${randomWinner}! Поздравляем!`);
        addWinner(randomWinner, prize);
        showNotification(`Победитель: ${randomWinner}!`, 'success');
        
        // Восстанавливаем кнопку
        selectWinnerBtn.innerHTML = originalText;
        selectWinnerBtn.disabled = false;
    }, 1500);
}

// Функция добавления победителя в список
function addWinner(name, prize) {
    // Удаляем пустое состояние, если оно есть
    if (winnersList.querySelector('.empty-state')) {
        winnersList.innerHTML = '';
    }
    
    const winnerDiv = document.createElement('div');
    winnerDiv.className = 'winner-item';
    
    const now = new Date();
    const timeString = `${now.getDate()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    winnerDiv.innerHTML = `
        <div>
            <span class="winner-name">${name}</span>
            <div class="winner-prize">${prize}</div>
        </div>
        <div class="winner-time">${timeString}</div>
    `;
    
    winnersList.prepend(winnerDiv);
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : ''}
        ${type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : ''}
        ${type === 'info' ? '<i class="fas fa-info-circle"></i>' : ''}
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически удаляем уведомление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Веб-интерфейс загружен');
    
    // Проверяем, успешно ли прошла авторизация
    if (window.location.search.includes('auth=success')) {
        showNotification('Авторизация через Twitch прошла успешно!', 'success');
    }
    
    // Добавляем приветственное сообщение
    setTimeout(() => {
        addChatMessage('bot', 'Бот', 'Бот розыгрышей готов к работе!');
    }, 1000);
});