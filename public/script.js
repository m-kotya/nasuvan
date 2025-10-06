// Элементы DOM
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
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
let isAuthenticated = false;

// Обработчики событий
authBtn.addEventListener('click', handleAuth);
logoutBtn.addEventListener('click', handleLogout);
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
        
        // Проверяем статус авторизации
        checkAuthStatus();
    });
    
    // Обработчик ошибок подключения
    socket.on('connect_error', (error) => {
        console.error('Ошибка WebSocket подключения:', error);
        addChatMessage('system', 'Система', 'Ошибка подключения к серверу: ' + error.message);
        // Показываем кнопку авторизации при ошибке подключения
        updateAuthButtons(false);
    });
    
    // Обработчик получения нового сообщения из Twitch чата
    socket.on('twitchMessage', (data) => {
        console.log('Получено сообщение из Twitch чата:', data);
        // Добавляем сообщение в чат
        addChatMessage('user', data.username, data.message);
        
        // Если розыгрыш активен и сообщение содержит ключевое слово, добавляем участника
        if (giveawayActive && currentKeyword && 
            data.message.toLowerCase() === currentKeyword.toLowerCase()) {
            addParticipant(data.username);
        }
    });
    
    // Обработчик подключения к Twitch
    socket.on('twitchConnected', (data) => {
        console.log('Бот подключен к Twitch:', data);
        addChatMessage('system', 'Система', data.message);
    });
    
    // Обработчик присоединения к каналу
    socket.on('channelJoined', (data) => {
        console.log('Бот присоединился к каналу:', data);
        addChatMessage('system', 'Система', data.message);
    });
    
    // Обработчик выхода из канала
    socket.on('channelLeft', (data) => {
        console.log('Бот покинул канал:', data);
        addChatMessage('system', 'Система', data.message);
    });
    
    // Обработчик добавления участника
    socket.on('participantAdded', (data) => {
        console.log('Получено уведомление о новом участнике:', data);
        addParticipant(data.username);
    });
    
    // Обработчик начала розыгрыша
    socket.on('giveawayStarted', (data) => {
        currentKeyword = data.keyword;
        giveawayActive = true;
        addChatMessage('system', 'Система', `Розыгрыш начат! Кодовое слово: "${data.keyword}"`);
        showNotification(`Розыгрыш начат с кодовым словом "${data.keyword}"`, 'success');
        
        // Активируем кнопки управления
        startBtn.disabled = true;
        resetBtn.disabled = false;
    });
    
    // Обработчик завершения розыгрыша
    socket.on('giveawayEnded', (data) => {
        if (data.winner) {
            addChatMessage('system', 'Система', `Розыгрыш завершен! Победитель: @${data.winner}`);
        } else {
            addChatMessage('system', 'Система', 'Розыгрыш завершен! Участников не было.');
        }
        
        // Деактивируем кнопки управления
        startBtn.disabled = false;
        resetBtn.disabled = true;
    });
}

// Функция проверки статуса авторизации
function checkAuthStatus() {
    fetch('/api/giveaways/test', { method: 'GET' })
    .then(response => {
        if (response.status === 401) {
            // Пользователь не авторизован
            isAuthenticated = false;
            updateAuthButtons(false);
            addChatMessage('system', 'Система', 'Для начала работы необходимо авторизоваться через Twitch');
        } else if (response.ok) {
            // Пользователь авторизован
            isAuthenticated = true;
            updateAuthButtons(true);
            addChatMessage('system', 'Система', 'Вы успешно авторизованы через Twitch');
        } else {
            // Другая ошибка
            throw new Error('Ошибка проверки авторизации: ' + response.status);
        }
    })
    .catch(error => {
        console.error('Ошибка проверки статуса авторизации:', error);
        // В случае ошибки показываем кнопку авторизации
        updateAuthButtons(false);
        addChatMessage('system', 'Система', 'Ошибка проверки авторизации. Пожалуйста, авторизуйтесь через Twitch');
    });
}

// Функция обновления видимости кнопок авторизации/выхода
function updateAuthButtons(isLoggedIn) {
    if (isLoggedIn) {
        authBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        authBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
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

// Функция обработки выхода из системы
function handleLogout() {
    // Показываем индикатор загрузки
    const originalText = logoutBtn.innerHTML;
    logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Выход...';
    logoutBtn.disabled = true;
    
    // Перенаправляем на маршрут выхода
    window.location.href = '/auth/logout';
}

// Функция запуска розыгрыша
function handleStart() {
    const keyword = keywordInput.value.trim();
    
    if (!keyword) {
        showNotification('Пожалуйста, введите кодовое слово', 'error');
        return;
    }
    
    // Проверяем, авторизован ли пользователь
    if (!isAuthenticated) {
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
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
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Ошибка при запуске розыгрыша');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            currentKeyword = keyword;
            giveawayActive = true;
            addChatMessage('system', 'Система', `Розыгрыш начат! Кодовое слово: "${keyword}"`);
            showNotification(`Розыгрыш начат с кодовым словом "${keyword}"`, 'success');
            
            // Активируем кнопку сброса
            resetBtn.disabled = false;
        } else {
            throw new Error(data.error || 'Ошибка при запуске розыгрыша');
        }
    })
    .catch(error => {
        console.error('Ошибка при запуске розыгрыша:', error);
        showNotification('Ошибка при запуске розыгрыша: ' + error.message, 'error');
        startBtn.disabled = false;
    })
    .finally(() => {
        // Восстанавливаем кнопку
        startBtn.innerHTML = originalText;
    });
}

// Функция перезапуска (сброса) розыгрыша
function handleReset() {
    // Проверяем, авторизован ли пользователь
    if (!isAuthenticated) {
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        return;
    }
    
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
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Ошибка при сбросе розыгрыша');
            });
        }
        return response.json();
    })
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
        
        // Активируем кнопку запуска
        startBtn.disabled = false;
    })
    .catch(error => {
        console.error('Ошибка при сбросе розыгрыша:', error);
        showNotification('Ошибка при сбросе розыгрыша: ' + error.message, 'error');
        
        // Все равно очищаем локальный список
        participants = [];
        updateParticipantsList();
        giveawayActive = false;
        currentKeyword = '';
        keywordInput.value = '';
        
        // Активируем кнопку запуска
        startBtn.disabled = false;
    })
    .finally(() => {
        // Восстанавливаем кнопку
        resetBtn.innerHTML = originalText;
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
        window.history.replaceState({}, document.title, "/");
        isAuthenticated = true;
        updateAuthButtons(true);
    } else if (window.location.search.includes('logout=success')) {
        showNotification('Вы успешно вышли из системы', 'info');
        addChatMessage('system', 'Система', 'Вы вышли из системы');
        window.history.replaceState({}, document.title, "/");
        isAuthenticated = false;
        updateAuthButtons(false);
    } else {
        // Показываем кнопку авторизации по умолчанию
        updateAuthButtons(false);
    }
    
    // Инициализируем WebSocket соединение
    initWebSocket();
    
    // Деактивируем кнопки управления по умолчанию
    startBtn.disabled = false;
    resetBtn.disabled = true;
    
    // Добавляем приветственное сообщение в чат
    addChatMessage('system', 'Система', 'Добро пожаловать в Twitch Giveaway Bot!');
});