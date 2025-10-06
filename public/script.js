// Элементы DOM
const authBtn = document.getElementById('authBtn');
const keywordInput = document.getElementById('keywordInput');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const participantsList = document.getElementById('participantsList');
const participantsCount = document.getElementById('participantsCount');
const chatMessages = document.getElementById('chatMessages');

// Глобальные переменные
let participants = [];
let giveawayActive = false;
let currentKeyword = '';
let socket = null;

// Обработчики событий
authBtn.addEventListener('click', handleAuth);
startBtn.addEventListener('click', handleStart);
resetBtn.addEventListener('click', handleReset);

// Функция инициализации WebSocket соединения
function initWebSocket() {
    // Создаем WebSocket соединение с сервером
    socket = io();
    
    // Обработчик успешного подключения
    socket.on('connect', () => {
        console.log('WebSocket подключение установлено');
        addChatMessage('system', 'Система', 'Подключение к серверу установлено');
    });
    
    // Обработчик ошибок подключения
    socket.on('connect_error', (error) => {
        console.error('Ошибка WebSocket подключения:', error);
        addChatMessage('system', 'Система', 'Ошибка подключения к серверу: ' + error.message);
    });
    
    // Обработчик получения нового сообщения из Twitch чата
    socket.on('twitchMessage', (data) => {
        // Добавляем сообщение в чат
        addChatMessage('user', data.username, data.message);
        
        // Если розыгрыш активен и сообщение содержит ключевое слово, добавляем участника
        if (giveawayActive && currentKeyword && 
            data.message.toLowerCase() === currentKeyword.toLowerCase()) {
            addParticipant(data.username);
        }
    });
    
    // Обработчик добавления участника
    socket.on('participantAdded', (data) => {
        addParticipant(data.username);
    });
    
    // Обработчик начала розыгрыша
    socket.on('giveawayStarted', (data) => {
        currentKeyword = data.keyword;
        giveawayActive = true;
        addChatMessage('system', 'Система', `Розыгрыш начат! Кодовое слово: "${data.keyword}"`);
        showNotification(`Розыгрыш начат с кодовым словом "${data.keyword}"`, 'success');
    });
    
    // Обработчик завершения розыгрыша
    socket.on('giveawayEnded', (data) => {
        if (data.winner) {
            addChatMessage('system', 'Система', `Розыгрыш завершен! Победитель: @${data.winner}`);
        } else {
            addChatMessage('system', 'Система', 'Розыгрыш завершен! Участников не было.');
        }
    });
}

// Функция обработки авторизации
function handleAuth() {
    // Показываем индикатор загрузки
    const originalText = authBtn.innerHTML;
    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Перенаправление...';
    authBtn.disabled = true;
    
    // Перенаправляем на маршрут авторизации Twitch
    window.location.href = '/auth/twitch';
}

// Функция запуска розыгрыша
function handleStart() {
    const keyword = keywordInput.value.trim();
    
    if (!keyword) {
        showNotification('Пожалуйста, введите кодовое слово', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = startBtn.innerHTML;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запуск...';
    startBtn.disabled = true;
    
    // Отправляем запрос на сервер для начала розыгрыша
    fetch('/api/start-giveaway', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            keyword: keyword,
            prize: 'Участие в розыгрыше' // Простой текст, так как приз не нужен
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentKeyword = keyword;
            giveawayActive = true;
            addChatMessage('system', 'Система', `Розыгрыш начат! Кодовое слово: "${keyword}"`);
            showNotification(`Розыгрыш начат с кодовым словом "${keyword}"`, 'success');
        } else {
            showNotification(data.error || 'Ошибка при запуске розыгрыша', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка при запуске розыгрыша:', error);
        showNotification('Ошибка при запуске розыгрыша', 'error');
    })
    .finally(() => {
        // Восстанавливаем кнопку
        startBtn.innerHTML = originalText;
        startBtn.disabled = false;
    });
}

// Функция перезапуска (сброса) розыгрыша
function handleReset() {
    // Показываем индикатор загрузки
    const originalText = resetBtn.innerHTML;
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сброс...';
    resetBtn.disabled = true;
    
    // Отправляем запрос на сервер для завершения розыгрыша
    fetch('/api/end-giveaway', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        // Очищаем список участников
        participants = [];
        updateParticipantsList();
        
        // Сбрасываем состояние розыгрыша
        giveawayActive = false;
        currentKeyword = '';
        keywordInput.value = '';
        
        addChatMessage('system', 'Система', 'Розыгрыш сброшен. Список участников очищен.');
        showNotification('Розыгрыш сброшен. Список участников очищен.', 'info');
    })
    .catch(error => {
        console.error('Ошибка при сбросе розыгрыша:', error);
        showNotification('Ошибка при сбросе розыгрыша', 'error');
        
        // Все равно очищаем локальный список
        participants = [];
        updateParticipantsList();
        giveawayActive = false;
        currentKeyword = '';
        keywordInput.value = '';
    })
    .finally(() => {
        // Восстанавливаем кнопку
        resetBtn.innerHTML = originalText;
        resetBtn.disabled = false;
    });
}

// Функция добавления участника
function addParticipant(username) {
    // Проверяем, есть ли уже такой участник
    if (participants.includes(username)) {
        return;
    }
    
    // Добавляем участника
    participants.push(username);
    updateParticipantsList();
    
    // Добавляем сообщение в чат
    addChatMessage('participant', username, `Написал кодовое слово: "${currentKeyword}"`);
    
    // Показываем уведомление
    showNotification(`Участник ${username} добавлен`, 'success');
}

// Функция обновления списка участников
function updateParticipantsList() {
    // Обновляем счетчик
    participantsCount.textContent = `(${participants.length})`;
    
    // Если нет участников, показываем пустое состояние
    if (participants.length === 0) {
        participantsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <p>Участников пока нет</p>
            </div>
        `;
        return;
    }
    
    // Создаем список участников
    let html = '';
    participants.forEach(participant => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        html += `
            <div class="participant-item">
                <span class="participant-name">${participant}</span>
                <span class="participant-time">${timeString}</span>
            </div>
        `;
    });
    
    participantsList.innerHTML = html;
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
        addChatMessage('system', 'Система', 'Подключение к чату Twitch установлено');
    }
    
    // Инициализируем WebSocket соединение
    initWebSocket();
});