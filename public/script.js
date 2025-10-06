// Элементы DOM
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
const keywordInput = document.getElementById('keywordInput');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const winnerBtn = document.getElementById('winnerBtn');
const participantsList = document.getElementById('participantsList');
const participantsCount = document.getElementById('participantsCount');
const chatMessages = document.getElementById('chatMessages');
const winnerSection = document.getElementById('winnerSection');
const winnerName = document.getElementById('winnerName');
const winnerTimer = document.getElementById('winnerTimer');
const rerollBtn = document.getElementById('rerollBtn');
const closeWinnerBtn = document.getElementById('closeWinnerBtn');
const winnersList = document.getElementById('winnersList'); // Новый элемент

// Глобальные переменные
let participants = [];
let giveawayActive = false;
let currentKeyword = '';
let socket = null;
let isAuthenticated = false;
let currentWinner = null;
let winnerTimerInterval = null;
let winnerSeconds = 0;
let winners = []; // Массив для хранения последних победителей
let winnerResponded = false; // Флаг для отслеживания ответа победителя

// Обработчики событий
authBtn.addEventListener('click', handleAuth);
logoutBtn.addEventListener('click', handleLogout);
startBtn.addEventListener('click', handleStart);
resetBtn.addEventListener('click', handleReset);
winnerBtn.addEventListener('click', handleSelectWinner);
rerollBtn.addEventListener('click', handleReroll);
closeWinnerBtn.addEventListener('click', handleCloseWinner);

// Функция загрузки последних победителей из базы данных
async function loadWinnersFromDatabase() {
    try {
        // Проверяем, авторизован ли пользователь
        if (!isAuthenticated) {
            console.log('Пользователь не авторизован, пропускаем загрузку победителей');
            return;
        }
        
        console.log('Загрузка победителей из базы данных...');
        const response = await fetch('/api/winners');
        if (response.ok) {
            const data = await response.json();
            console.log('Получены данные победителей:', data);
            
            // Очищаем массив победителей
            winners = [];
            
            // Заполняем массив победителей данными из базы
            data.forEach(winnerData => {
                if (winnerData.winner) { // Проверяем, что есть победитель
                    winners.push({
                        name: winnerData.winner,
                        time: new Date(winnerData.ended_at)
                    });
                }
            });
            
            // Ограничиваем список последними 10 победителями
            if (winners.length > 10) {
                winners = winners.slice(0, 10);
            }
            
            updateWinnersList();
        } else {
            console.error('Ошибка при загрузке победителей, статус:', response.status);
        }
    } catch (error) {
        console.error('Ошибка при загрузке победителей из базы данных:', error);
    }
}

// Функция добавления победителя в список
function addWinner(winnerName) {
    // Проверяем, есть ли уже такой победитель в списке
    const existingWinner = winners.find(w => w.name === winnerName);
    if (existingWinner) {
        console.log('Победитель уже есть в списке:', winnerName);
        return;
    }
    
    const now = new Date();
    const winner = {
        name: winnerName,
        time: now
    };
    
    // Добавляем победителя в начало массива
    winners.unshift(winner);
    
    // Ограничиваем список последними 10 победителями
    if (winners.length > 10) {
        winners = winners.slice(0, 10);
    }
    
    // Обновляем отображение списка победителей
    updateWinnersList();
}

// Функция обновления списка победителей
function updateWinnersList() {
    if (winners.length === 0) {
        winnersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-trophy"></i>
                <p>Победителей пока нет</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    winners.forEach(winner => {
        // Форматируем дату как день/месяц/год
        const day = winner.time.getDate().toString().padStart(2, '0');
        const month = (winner.time.getMonth() + 1).toString().padStart(2, '0');
        const year = winner.time.getFullYear();
        const dateString = `${day}/${month}/${year}`;
        
        // Форматируем время как 24-часовой формат часы:минуты
        const hours = winner.time.getHours().toString().padStart(2, '0');
        const minutes = winner.time.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        
        html += `
            <div class="winner-item">
                <div>
                    <span class="winner-name"><i class="fas fa-trophy winner-trophy"></i> ${winner.name}</span>
                </div>
                <div>
                    <span class="winner-time">${dateString} ${timeString}</span>
                </div>
            </div>
        `;
    });
    
    winnersList.innerHTML = html;
}

// Функция инициализации WebSocket соединения
function initWebSocket() {
    // Создаем WebSocket соединение с сервером
    socket = io();
    
    // Флаг для отслеживания первого подключения
    let isFirstConnection = true;
    
    // Обработчик успешного подключения
    socket.on('connect', () => {
        console.log('WebSocket подключение установлено');
        
        // Добавляем сообщение в чат только при первом подключении
        if (isFirstConnection) {
            addChatMessage('system', 'Система', 'Подключение к серверу установлено');
            isFirstConnection = false;
        }
        
        // Проверяем статус авторизации
        checkAuthStatus();
    });
    
    // Обработчик ошибок подключения
    socket.on('connect_error', (error) => {
        console.error('Ошибка WebSocket подключения:', error);
        // Добавляем сообщение в чат только если это первая ошибка
        if (isFirstConnection) {
            addChatMessage('system', 'Система', 'Ошибка подключения к серверу: ' + error.message);
            // Показываем кнопку авторизации при ошибке подключения
            updateAuthButtons(false);
        }
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
        
        // Если есть активный победитель и это его сообщение, останавливаем таймер и отображаем сообщение в модальном окне
        if (currentWinner && data.username === currentWinner) {
            stopWinnerTimer();
            winnerResponded = true; // Устанавливаем флаг ответа
            showNotification(`Победитель ${currentWinner} ответил в чат!`, 'success');
            
            // Добавляем сообщение в чат модального окна
            const winnerChat = document.getElementById('winnerChat');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'winner-chat-message winner-response';
            
            // Форматируем время как [00:18:32]
            const now = new Date();
            const timeString = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
            
            messageDiv.innerHTML = `
                <span class="winner-chat-time">${timeString}</span>
                <span class="winner-chat-user">${data.username}:</span>
                <span class="winner-chat-text">${processEmojis(data.message)}</span>
            `;
            winnerChat.appendChild(messageDiv);
            winnerChat.scrollTop = winnerChat.scrollHeight;
        }
    });
    
    // Обработчик ошибок Twitch
    socket.on('twitchError', (data) => {
        console.log('Ошибка Twitch:', data);
        addChatMessage('system', 'Система', 'Ошибка Twitch: ' + data.message);
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
        winnerBtn.style.display = 'block';
    });
    
    // Обработчик завершения розыгрыша
    socket.on('giveawayEnded', (data) => {
        if (data.winner) {
            addChatMessage('system', 'Система', `Розыгрыш завершен! Победитель: @${data.winner}`);
            // Добавляем победителя в список
            addWinner(data.winner);
        } else {
            addChatMessage('system', 'Система', 'Розыгрыш завершен! Участников не было.');
        }
        
        // Деактивируем кнопки управления
        startBtn.disabled = false;
        resetBtn.disabled = true;
        winnerBtn.style.display = 'none';
        
        // Скрываем секцию победителя
        winnerSection.style.display = 'none';
        currentWinner = null;
    });
    
    // Обработчик выбора победителя
    socket.on('winnerSelected', (data) => {
        showWinner(data.winner);
        // Добавляем победителя в список только если он ответил
        // Для этого мы будем добавлять победителя позже, когда он ответит
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket соединение закрыто');
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
            
            // Активируем кнопку сброса и кнопку выбора победителя
            resetBtn.disabled = false;
            winnerBtn.style.display = 'block';
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
        
        // Если есть победитель, добавляем его в список
        if (data.winner && data.winner.winner) {
            addWinner(data.winner.winner);
        }
        
        // Активируем кнопку запуска
        startBtn.disabled = false;
        winnerBtn.style.display = 'none';
        
        // Скрываем секцию победителя
        winnerSection.style.display = 'none';
        currentWinner = null;
        stopWinnerTimer();
        winnerResponded = false;
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
        winnerBtn.style.display = 'none';
        
        // Скрываем секцию победителя
        winnerSection.style.display = 'none';
        currentWinner = null;
        stopWinnerTimer();
        winnerResponded = false;
    })
    .finally(() => {
        // Восстанавливаем кнопку
        resetBtn.innerHTML = originalText;
    });
}

// Функция выбора победителя
function handleSelectWinner() {
    if (!isAuthenticated) {
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        return;
    }
    
    if (participants.length === 0) {
        showNotification('Нет участников для выбора победителя', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = winnerBtn.innerHTML;
    winnerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Выбор...';
    winnerBtn.disabled = true;
    
    // Отправляем запрос на сервер для выбора победителя, включая список участников
    fetch('/api/select-winner', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            participants: participants
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Ошибка при выборе победителя');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.winner) {
            showWinner(data.winner);
            addChatMessage('winner', 'Система', `Победитель: @${data.winner}!`);
            showNotification(`Победитель: ${data.winner}`, 'success');
            
            // Не добавляем победителя сразу, ждем его ответа
            // addWinner(data.winner);
            
            // Отправляем уведомление в чат через WebSocket
            if (socket && socket.connected) {
                socket.emit('winnerSelectedChat', {
                    winner: data.winner,
                    channel: 'default',
                    message: `Поздравляем @${data.winner}! Вы выиграли розыгрыш! Пожалуйста, напишите любое сообщение в чат для подтверждения.`
                });
            }
        } else {
            showNotification('Не удалось выбрать победителя', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка при выборе победителя:', error);
        showNotification('Ошибка при выборе победителя: ' + error.message, 'error');
    })
    .finally(() => {
        // Восстанавливаем кнопку
        winnerBtn.innerHTML = originalText;
        winnerBtn.disabled = false;
    });
}

// Функция реролла (повторного выбора победителя)
function handleReroll() {
    if (!isAuthenticated) {
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        return;
    }
    
    if (participants.length === 0) {
        showNotification('Нет участников для выбора победителя', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = rerollBtn.innerHTML;
    rerollBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Реролл...';
    rerollBtn.disabled = true;
    
    // Отправляем запрос на сервер для повторного выбора победителя, включая список участников
    fetch('/api/select-winner', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            participants: participants
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Ошибка при реролле');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.winner) {
            showWinner(data.winner);
            addChatMessage('winner', 'Система', `Новый победитель: @${data.winner}!`);
            showNotification(`Новый победитель: ${data.winner}`, 'success');
            
            // Не добавляем победителя сразу, ждем его ответа
            // addWinner(data.winner);
            
            // Отправляем уведомление в чат через WebSocket
            if (socket && socket.connected) {
                socket.emit('winnerSelectedChat', {
                    winner: data.winner,
                    channel: 'default',
                    message: `Поздравляем @${data.winner}! Вы выиграли розыгрыш! Пожалуйста, напишите любое сообщение в чат для подтверждения.`
                });
            }
        } else {
            showNotification('Не удалось выбрать нового победителя', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка при реролле:', error);
        showNotification('Ошибка при реролле: ' + error.message, 'error');
    })
    .finally(() => {
        // Восстанавливаем кнопку
        rerollBtn.innerHTML = originalText;
        rerollBtn.disabled = false;
    });
}

// Функция закрытия секции победителя
function handleCloseWinner() {
    winnerSection.style.display = 'none';
    currentWinner = null;
    stopWinnerTimer();
    
    // Если победитель не ответил, не добавляем его в список
    if (!winnerResponded && currentWinner) {
        console.log('Победитель не ответил, не добавляем в список:', currentWinner);
    } else if (currentWinner) {
        // Добавляем победителя в список только если он ответил
        addWinner(currentWinner);
    }
    
    // Удаляем оверлей
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Функция отображения победителя в модальном окне
function showWinner(winner) {
    currentWinner = winner;
    winnerName.textContent = winner;
    winnerResponded = false; // Сброс флага ответа
    
    // Очищаем чат в модальном окне
    const winnerChat = document.getElementById('winnerChat');
    winnerChat.innerHTML = '';
    
    // Показываем модальное окно
    winnerSection.style.display = 'block';
    
    // Убеждаемся, что модальное окно остается по центру
    winnerSection.style.position = 'fixed';
    winnerSection.style.top = '50%';
    winnerSection.style.left = '50%';
    winnerSection.style.transform = 'translate(-50%, -50%)';
    winnerSection.style.zIndex = '10000';
    
    // Добавляем оверлей для затемнения фона
    let overlay = document.getElementById('modalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(overlay);
    }
    
    // Сброс таймера и запуск
    winnerSeconds = 0;
    updateWinnerTimer();
    startWinnerTimer();
}

// Функция запуска таймера победителя
function startWinnerTimer() {
    stopWinnerTimer(); // Останавливаем предыдущий таймер, если есть
    
    winnerTimerInterval = setInterval(() => {
        winnerSeconds++;
        updateWinnerTimer();
    }, 1000);
}

// Функция остановки таймера победителя
function stopWinnerTimer() {
    if (winnerTimerInterval) {
        clearInterval(winnerTimerInterval);
        winnerTimerInterval = null;
    }
}

// Функция обновления отображения таймера
function updateWinnerTimer() {
    const hours = Math.floor(winnerSeconds / 3600);
    const minutes = Math.floor((winnerSeconds % 3600) / 60);
    const seconds = winnerSeconds % 60;
    
    // Форматируем как HH:MM:SS
    winnerTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    
    // Отправляем уведомление на сервер о новом участнике
    if (socket && socket.connected) {
        socket.emit('addParticipant', {
            username: username,
            channel: 'default',
            timestamp: new Date().toISOString()
        });
    }
    
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
            <div class="participant-item" data-username="${participant}">
                <span class="participant-name">${participant}</span>
                <span class="participant-time">${timeString}</span>
            </div>
        `;
    });
    
    participantsList.innerHTML = html;
}

// Функция добавления сообщения в чат с поддержкой эмодзи
function addChatMessage(type, user, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    // Проверяем, есть ли пользователь уже в списке участников
    if (participants.includes(user) && type === 'user') {
        messageDiv.classList.add('already-participant');
    }
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Обрабатываем эмодзи в тексте сообщения
    const processedText = processEmojis(text);
    messageDiv.innerHTML = `
        <span class="message-user">${user}:</span>
        <span class="message-text">${processedText}</span>
        <span class="message-time">${timeString}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Функция обработки эмодзи в тексте
function processEmojis(text) {
    // Заменяем некоторые популярные Twitch эмодзи на изображения
    // В реальной реализации здесь будет логика получения эмодзи с Twitch API
    const emojiMap = {
        ':)': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/1/default/light/1.0" alt=":)" class="twitch-emoji">',
        ':(': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/2/default/light/1.0" alt=":(" class="twitch-emoji">',
        ':D': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/3/default/light/1.0" alt=":D" class="twitch-emoji">',
        ';)': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/4/default/light/1.0" alt=";)" class="twitch-emoji">',
        ':P': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/5/default/light/1.0" alt=":P" class="twitch-emoji">',
        ':p': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/5/default/light/1.0" alt=":p" class="twitch-emoji">',
        ':o': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/6/default/light/1.0" alt=":o" class="twitch-emoji">',
        ':O': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/6/default/light/1.0" alt=":O" class="twitch-emoji">',
        'Kappa': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/25/default/light/1.0" alt="Kappa" class="twitch-emoji">',
        'PogChamp': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/88/default/light/1.0" alt="PogChamp" class="twitch-emoji">',
        'DansGame': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/33/default/light/1.0" alt="DansGame" class="twitch-emoji">',
        'BibleThump': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/86/default/light/1.0" alt="BibleThump" class="twitch-emoji">',
        '4Head': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/354/default/light/1.0" alt="4Head" class="twitch-emoji">',
        'Pog': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/light/1.0" alt="Pog" class="twitch-emoji">',
        'LUL': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/305954160/default/light/1.0" alt="LUL" class="twitch-emoji">',
        'OMEGALUL': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/305954159/default/light/1.0" alt="OMEGALUL" class="twitch-emoji">',
        'Pepega': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/305954157/default/light/1.0" alt="Pepega" class="twitch-emoji">',
        'monkaS': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/305954158/default/light/1.0" alt="monkaS" class="twitch-emoji">',
        'FeelsGoodMan': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/304486302/default/light/1.0" alt="FeelsGoodMan" class="twitch-emoji">',
        'FeelsBadMan': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/304486300/default/light/1.0" alt="FeelsBadMan" class="twitch-emoji">',
        'KEKW': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/304486305/default/light/1.0" alt="KEKW" class="twitch-emoji">',
        'monkaHmm': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/304486309/default/light/1.0" alt="monkaHmm" class="twitch-emoji">',
        'Sadge': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/304486310/default/light/1.0" alt="Sadge" class="twitch-emoji">',
        'Clap': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/433/default/light/1.0" alt="Clap" class="twitch-emoji">',
        'Heart': '<img src="https://static-cdn.jtvnw.net/emoticons/v2/434/default/light/1.0" alt="Heart" class="twitch-emoji">'
    };
    
    let processedText = text;
    for (const [emojiCode, emojiHtml] of Object.entries(emojiMap)) {
        // Используем регулярное выражение с флагом 'gi' для замены всех вхождений
        const regex = new RegExp(escapeRegExp(emojiCode), 'gi');
        processedText = processedText.replace(regex, emojiHtml);
    }
    
    return processedText;
}

// Вспомогательная функция для экранирования специальных символов в регулярных выражениях
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        
        // Загружаем победителей после авторизации
        setTimeout(() => {
            loadWinnersFromDatabase();
        }, 1000);
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
    winnerBtn.style.display = 'none';
    
    // Загружаем победителей из базы данных если пользователь авторизован
    if (isAuthenticated) {
        loadWinnersFromDatabase();
        
        // Периодически обновляем список победителей каждые 30 секунд
        setInterval(() => {
            if (isAuthenticated) {
                loadWinnersFromDatabase();
            }
        }, 30000);
    }
    
    // Добавляем обработчик для закрытия модального окна при клике вне его области
    document.addEventListener('click', function(event) {
        if (winnerSection.style.display === 'block' && 
            !winnerSection.contains(event.target) && 
            event.target.id === 'modalOverlay') {
            handleCloseWinner();
        }
    });
    
    // Обработчик изменения размера окна для центрирования модального окна
    window.addEventListener('resize', function() {
        if (winnerSection.style.display === 'block') {
            winnerSection.style.top = '50%';
            winnerSection.style.left = '50%';
            winnerSection.style.transform = 'translate(-50%, -50%)';
        }
    });
    
    // Добавляем приветственное сообщение в чат
    addChatMessage('system', 'Система', 'Добро пожаловать в Twitch Giveaway Bot!');
});