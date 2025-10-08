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
const winnersList = document.getElementById('winnersList');
const userStatus = document.getElementById('userStatus');
const usernameDisplay = document.getElementById('usernameDisplay');

// Глобальные переменные
let participants = [];
let giveawayActive = false;
let currentKeyword = '';
let socket = null;
let isAuthenticated = false;
let currentWinner = null;
let winnerTimerInterval = null;
let winnerSeconds = 0;
let winners = [];
let winnerResponded = false;
let currentUsername = '';
let winnerChatMessages = []; // Новый массив для хранения сообщений в модальном окне

// Обработчики событий
authBtn.addEventListener('click', handleAuth);
logoutBtn.addEventListener('click', handleLogout);
startBtn.addEventListener('click', handleStart);
resetBtn.addEventListener('click', handleReset);
winnerBtn.addEventListener('click', handleSelectWinner);
rerollBtn.addEventListener('click', handleReroll);
closeWinnerBtn.addEventListener('click', handleCloseWinner);

// Функция инициализации WebSocket соединения
function initWebSocket() {
    console.log('=== НАЧАЛО ФУНКЦИИ initWebSocket ===');
    
    // Создаем WebSocket соединение с сервером
    socket = io();
    
    // Обработчик успешного подключения
    socket.on('connect', () => {
        console.log('WebSocket подключение установлено');
        
        // Проверяем статус авторизации
        checkAuthStatus();
    });
    
    // Обработчик ошибок подключения
    socket.on('connect_error', (error) => {
        console.error('Ошибка WebSocket подключения:', error);
        // Показываем кнопку авторизации при ошибке подключения
        updateAuthButtons(false);
    });
    
    // Обработчик сообщений из Twitch чата
    socket.on('twitchMessage', (data) => {
        console.log('Получено сообщение из Twitch чата:', data);
        // Не показываем системные сообщения о подключении
        if (data.username !== 'Система' || !data.message.includes('WebSocket соединение установлено')) {
            addChatMessage('user', data.username, data.message);
            
            // Если модальное окно открыто и сообщение от победителя, добавляем его в чат модального окна
            if (winnerSection.style.display === 'block' && data.username === currentWinner) {
                addWinnerChatMessage(data.username, data.message);
            }
        }
    });
    
    // Обработчик добавления участника
    socket.on('participantAdded', (data) => {
        console.log('Получено уведомление о добавлении участника:', data);
        // Добавляем участника в локальный список, если его там еще нет
        if (!participants.includes(data.username)) {
            participants.push(data.username);
            updateParticipantsList();
            showNotification(`Участник ${data.username} добавлен`, 'success');
            // Добавляем специальное сообщение в чат о добавлении участника
            addChatMessage('participant-notification', data.username, `ввел кодовое слово и теперь в списке участников!`);
        }
    });
    
    // Обработчик удаленных сообщений
    socket.on('messageDeleted', (data) => {
        console.log('Получено уведомление об удалении сообщения:', data);
        // Удаляем сообщение из чата
        const messageElements = document.querySelectorAll('.chat-message');
        messageElements.forEach(element => {
            const userElement = element.querySelector('.message-user');
            const timeElement = element.querySelector('.message-time');
            if (userElement && timeElement) {
                const username = userElement.textContent.replace(':', '');
                const timeText = timeElement.textContent;
                // Проверяем, совпадает ли пользователь и время сообщения
                if (username === data.username && timeText === data.time) {
                    element.remove();
                }
            }
        });
    });
    
    console.log('=== КОНЕЦ ФУНКЦИИ initWebSocket ===');
}

// Функция проверки статуса авторизации
function checkAuthStatus() {
    console.log('=== НАЧАЛО ФУНКЦИИ checkAuthStatus ===');
    
    fetch('/api/giveaways/test', { method: 'GET' })
    .then(response => {
        console.log('Ответ от сервера при проверке авторизации:', { status: response.status });
        if (response.status === 401) {
            // Пользователь не авторизован
            isAuthenticated = false;
            updateAuthButtons(false);
        } else if (response.ok) {
            // Пользователь авторизован
            return response.json();
        } else {
            // Другая ошибка
            throw new Error('Ошибка проверки авторизации: ' + response.status);
        }
    })
    .then(data => {
        if (data) {
            isAuthenticated = true;
            currentUsername = data.user;
            updateAuthButtons(true);
        }
    })
    .catch(error => {
        console.error('Ошибка проверки статуса авторизации:', error);
        // В случае ошибки показываем кнопку авторизации
        updateAuthButtons(false);
    })
    .finally(() => {
        console.log('=== КОНЕЦ ФУНКЦИИ checkAuthStatus ===');
    });
}

// Функция обновления видимости кнопок авторизации/выхода
function updateAuthButtons(isLoggedIn) {
    console.log('=== НАЧАЛО ФУНКЦИИ updateAuthButtons ===');
    console.log('Обновление видимости кнопок:', { isLoggedIn });
    
    if (isLoggedIn) {
        authBtn.style.display = 'none';
        userStatus.style.display = 'flex';
        usernameDisplay.textContent = currentUsername;
        console.log('Показываем панель пользователя');
    } else {
        authBtn.style.display = 'block';
        userStatus.style.display = 'none';
        currentUsername = '';
        console.log('Показываем кнопку авторизации');
    }
    
    console.log('=== КОНЕЦ ФУНКЦИИ updateAuthButtons ===');
}

// Функция обработки авторизации
function handleAuth() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleAuth ===');
    
    // Показываем индикатор загрузки
    const originalText = authBtn.innerHTML;
    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Перенаправление...';
    authBtn.disabled = true;
    
    // Перенаправляем на маршрут авторизации Twitch
    console.log('Перенаправление на авторизацию Twitch');
    window.location.href = '/auth/twitch';
    
    console.log('=== КОНЕЦ ФУНКЦИИ handleAuth ===');
}

// Функция обработки выхода из системы
function handleLogout() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleLogout ===');
    
    // Показываем индикатор загрузки
    const originalText = logoutBtn.innerHTML;
    logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Выход...';
    logoutBtn.disabled = true;
    
    // Перенаправляем на маршрут выхода
    console.log('Перенаправление на выход из системы');
    window.location.href = '/auth/logout';
    
    console.log('=== КОНЕЦ ФУНКЦИИ handleLogout ===');
}

// Функция запуска розыгрыша
function handleStart() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleStart ===');
    const keyword = keywordInput.value.trim();
    
    if (!keyword) {
        console.log('Кодовое слово не введено');
        showNotification('Пожалуйста, введите кодовое слово', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleStart ===');
        return;
    }
    
    // Проверяем, авторизован ли пользователь
    if (!isAuthenticated) {
        console.log('Пользователь не авторизован');
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleStart ===');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = startBtn.innerHTML;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запуск...';
    startBtn.disabled = true;
    
    console.log('Отправка запроса на начало розыгрыша:', { keyword });
    
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
        console.log('Ответ от сервера при начале розыгрыша:', { status: response.status, ok: response.ok });
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Ошибка при запуске розыгрыша');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Данные от сервера при начале розыгрыша:', data);
        if (data.success) {
            currentKeyword = keyword.toLowerCase(); // Приводим к нижнему регистру для корректного сравнения
            giveawayActive = true;
            // Очищаем список участников при начале нового розыгрыша
            participants = [];
            updateParticipantsList();
            showNotification(`Розыгрыш начат с кодовым словом "${keyword}"`, 'success');
            
            // Активируем кнопку сброса и кнопку выбора победителя
            resetBtn.disabled = false;
            winnerBtn.style.display = 'block';
            
            // Дополнительная отладочная информация
            console.log('Состояние после начала розыгрыша:', { 
              giveawayActive: giveawayActive, 
              currentKeyword: currentKeyword, 
              participantsCount: participants.length 
            });
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
        console.log('=== КОНЕЦ ФУНКЦИИ handleStart ===');
    });
}

// Функция перезапуска (сброса) розыгрыша
function handleReset() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleReset ===');
    
    // Проверяем, авторизован ли пользователь
    if (!isAuthenticated) {
        console.log('Пользователь не авторизован');
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleReset ===');
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
        console.log('Ответ от сервера при сбросе розыгрыша:', { status: response.status, ok: response.ok });
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
        console.log('=== КОНЕЦ ФУНКЦИИ handleReset ===');
    });
}

// Функция выбора победителя
function handleSelectWinner() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleSelectWinner ===');
    
    if (!isAuthenticated) {
        console.log('Пользователь не авторизован');
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleSelectWinner ===');
        return;
    }
    
    if (participants.length === 0) {
        console.log('Нет участников для выбора победителя');
        showNotification('Нет участников для выбора победителя', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleSelectWinner ===');
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
        console.log('Ответ от сервера при выборе победителя:', { status: response.status, ok: response.ok });
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
        console.log('=== КОНЕЦ ФУНКЦИИ handleSelectWinner ===');
    });
}

// Функция реролла (повторного выбора победителя)
function handleReroll() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleReroll ===');
    
    if (!isAuthenticated) {
        console.log('Пользователь не авторизован');
        showNotification('Пожалуйста, сначала авторизуйтесь через Twitch', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleReroll ===');
        return;
    }
    
    if (participants.length === 0) {
        console.log('Нет участников для выбора победителя');
        showNotification('Нет участников для выбора победителя', 'error');
        console.log('=== КОНЕЦ ФУНКЦИИ handleReroll ===');
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
        console.log('Ответ от сервера при реролле:', { status: response.status, ok: response.ok });
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
        console.log('=== КОНЕЦ ФУНКЦИИ handleReroll ===');
    });
}

// Функция закрытия секции победителя
function handleCloseWinner() {
    console.log('=== НАЧАЛО ФУНКЦИИ handleCloseWinner ===');
    
    winnerSection.style.display = 'none';
    currentWinner = null;
    stopWinnerTimer();
    
    // Если победитель не ответил, не добавляем его в список
    if (!winnerResponded && currentWinner) {
        console.log('Победитель не ответил, не добавляем в список:', currentWinner);
        showNotification(`Победитель ${currentWinner} не ответил в чат`, 'info');
    } else if (currentWinner) {
        // Добавляем победителя в список только если он ответил
        addWinner(currentWinner);
        showNotification(`Победитель ${currentWinner} добавлен в список`, 'success');
    }
    
    // Удаляем оверлей
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.remove();
    }
    
    console.log('=== КОНЕЦ ФУНКЦИИ handleCloseWinner ===');
}

// Функция отображения победителя в модальном окне
function showWinner(winner) {
    console.log('=== НАЧАЛО ФУНКЦИИ showWinner ===');
    console.log('Отображение победителя:', winner);
    
    currentWinner = winner;
    winnerName.textContent = winner;
    winnerResponded = false; // Сброс флага ответа
    winnerChatMessages = []; // Очищаем массив сообщений
    
    // Очищаем чат в модальном окне
    const winnerChat = document.getElementById('winnerChat');
    if (winnerChat) {
        winnerChat.innerHTML = '';
    }
    
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
    const timerElement = document.getElementById('winnerTimer');
    if (timerElement) {
        timerElement.classList.remove('red'); // Убираем красный цвет при сбросе
    }
    updateWinnerTimer();
    startWinnerTimer();
    
    console.log('=== КОНЕЦ ФУНКЦИИ showWinner ===');
}

// Функция запуска таймера победителя
function startWinnerTimer() {
    stopWinnerTimer(); // Останавливаем предыдущий таймер, если есть
    
    winnerTimerInterval = setInterval(() => {
        winnerSeconds++;
        updateWinnerTimer();
        
        // После 20 секунд делаем таймер красным
        if (winnerSeconds >= 20) {
            const timerElement = document.getElementById('winnerTimer');
            if (timerElement) {
                timerElement.classList.add('red');
            }
        }
    }, 1000);
}

// Функция остановки таймера победителя
function stopWinnerTimer() {
    if (winnerTimerInterval) {
        clearInterval(winnerTimerInterval);
        winnerTimerInterval = null;
    }
}

// Функция обновления отображения таймера в формате 00:00
function updateWinnerTimer() {
    const minutes = Math.floor(winnerSeconds / 60);
    const seconds = winnerSeconds % 60;
    
    // Форматируем как MM:SS
    const timerElement = document.getElementById('winnerTimer');
    if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Функция добавления участника
function addParticipant(username) {
    console.log('=== НАЧАЛО ФУНКЦИИ addParticipant ===');
    console.log('Добавление участника:', { username, currentKeyword, participants });
    
    // Проверяем, активен ли розыгрыш
    if (!giveawayActive || !currentKeyword) {
        console.log('Розыгрыш не активен или не задано ключевое слово');
        console.log('=== КОНЕЦ ФУНКЦИИ addParticipant ===');
        return;
    }
    
    // Проверяем, есть ли уже такой участник
    if (participants.includes(username)) {
        console.log('Участник уже в списке:', username);
        // Добавляем сообщение в чат о том, что участник уже в списке
        addChatMessage('already-participant', username, `Написал кодовое слово: "${currentKeyword}" (уже в списке)`);
        console.log('=== КОНЕЦ ФУНКЦИИ addParticipant ===');
        return;
    }
    
    // Добавляем участника
    console.log('Добавление участника в массив:', username);
    participants.push(username);
    console.log('Участник добавлен в массив:', { username, participantsCount: participants.length });
    updateParticipantsList();
    
    // Добавляем сообщение в чат
    console.log('Добавление сообщения в чат для участника:', username);
    addChatMessage('participant', username, `Написал кодовое слово: "${currentKeyword}"`);
    
    // Показываем уведомление
    console.log('Показ уведомления об добавлении участника:', username);
    showNotification(`Участник ${username} добавлен`, 'success');
    
    // Дополнительная отладочная информация
    console.log('Состояние после добавления участника:', { 
      giveawayActive: giveawayActive, 
      currentKeyword: currentKeyword, 
      participantsCount: participants.length,
      participants: [...participants]
    });
    
    console.log('=== КОНЕЦ ФУНКЦИИ addParticipant ===');
}

// Функция обновления списка участников
function updateParticipantsList() {
    console.log('=== НАЧАЛО ФУНКЦИИ updateParticipantsList ===');
    console.log('Обновление списка участников:', { participantsCount: participants.length, participants: [...participants] });
    
    // Обновляем счетчик
    participantsCount.textContent = `(${participants.length})`;
    
    // Если нет участников, показываем пустое состояние
    if (participants.length === 0) {
        console.log('Нет участников, показываем пустое состояние');
        participantsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <p>Участников пока нет</p>
            </div>
        `;
        console.log('=== КОНЕЦ ФУНКЦИИ updateParticipantsList ===');
        return;
    }
    
    // Создаем список участников
    console.log('Создание списка участников');
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
    
    console.log('Обновление HTML списка участников');
    participantsList.innerHTML = html;
    console.log('Список участников обновлен, HTML элементов:', participantsList.children.length);
    console.log('=== КОНЕЦ ФУНКЦИИ updateParticipantsList ===');
}

// Функция добавления сообщения в чат с поддержкой эмодзи
function addChatMessage(type, user, text) {
    console.log('=== НАЧАЛО ФУНКЦИИ addChatMessage ===');
    console.log('Добавление сообщения в чат:', { type, user, text });
    
    // Не показываем системные сообщения о подключении WebSocket
    if (type === 'system' && text.includes('WebSocket соединение установлено')) {
        console.log('Системное сообщение о подключении WebSocket, игнорируем');
        console.log('=== КОНЕЦ ФУНКЦИИ addChatMessage ===');
        return;
    }
    
    // Проверяем, есть ли пустое состояние в чате, и если да, то удаляем его
    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) {
        console.log('Удаление пустого состояния чата');
        emptyState.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    // Проверяем, есть ли пользователь уже в списке участников
    if (participants.includes(user) && (type === 'user' || type === 'participant-notification')) {
        console.log('Пользователь в списке участников, добавляем класс participant');
        messageDiv.classList.add('participant');
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
    
    // Добавляем data-атрибуты для возможности удаления сообщений
    messageDiv.setAttribute('data-username', user);
    messageDiv.setAttribute('data-time', timeString);
    
    console.log('Добавление сообщения в DOM');
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    console.log('=== КОНЕЦ ФУНКЦИИ addChatMessage ===');
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
    return string.replace(/[.*+?^${}()()|[\]\\]/g, '\\$&');
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    console.log('=== НАЧАЛО ФУНКЦИИ showNotification ===');
    console.log('Показ уведомления:', { message, type });
    
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    if (existingNotifications.length > 0) {
        console.log('Удаление предыдущих уведомлений:', existingNotifications.length);
        existingNotifications.forEach(notification => notification.remove());
    }
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : ''}
        ${type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : ''}
        ${type === 'info' ? '<i class="fas fa-info-circle"></i>' : ''}
        ${message}
    `;
    
    console.log('Добавление уведомления в DOM');
    document.body.appendChild(notification);
    
    // Автоматически удаляем уведомление через 5 секунд
    setTimeout(() => {
        console.log('Удаление уведомления по таймеру');
        notification.remove();
    }, 5000);
    
    console.log('=== КОНЕЦ ФУНКЦИИ showNotification ===');
}

// Функция добавления победителя в список
function addWinner(winnerName) {
    console.log('=== НАЧАЛО ФУНКЦИИ addWinner ===');
    console.log('Добавление победителя:', winnerName);
    
    // Проверяем, есть ли уже такой победитель в списке
    const existingWinner = winners.find(w => w.name === winnerName);
    if (existingWinner) {
        console.log('Победитель уже есть в списке:', winnerName);
        console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
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
    
    console.log('=== КОНЕЦ ФУНКЦИИ addWinner ===');
}

// Функция для обновления Telegram победителя
function updateWinnerTelegram(username, telegram) {
    console.log('Обновление Telegram для победителя:', { username, telegram });
    
    // Отправляем запрос на сервер для обновления Telegram
    fetch('/api/update-telegram', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, telegram })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Ошибка при обновлении Telegram');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Telegram успешно обновлен:', data.winner);
            showNotification(`Telegram для ${username} успешно обновлен`, 'success');
        } else {
            throw new Error(data.error || 'Ошибка при обновлении Telegram');
        }
    })
    .catch(error => {
        console.error('Ошибка при обновлении Telegram:', error);
        showNotification('Ошибка при обновлении Telegram: ' + error.message, 'error');
    });
}

// Функция для добавления тестового контента (только для тестирования выравнивания)
function addTestContent() {
  // Добавляем тестовых участников
  const participantsList = document.getElementById('participantsList');
  if (participantsList && participantsList.querySelector('.empty-state')) {
    participantsList.innerHTML = '';
    
    for (let i = 1; i <= 15; i++) {
      const participantItem = document.createElement('div');
      participantItem.className = 'participant-item';
      participantItem.innerHTML = `
        <span class="participant-name">Участник ${i}</span>
        <span class="participant-time">${new Date().toLocaleTimeString()}</span>
      `;
      participantsList.appendChild(participantItem);
    }
  }
  
  // Добавляем тестовые сообщения в чат
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    for (let i = 1; i <= 20; i++) {
      const chatMessage = document.createElement('div');
      chatMessage.className = 'chat-message user';
      chatMessage.innerHTML = `
        <span class="message-user">Пользователь ${i}</span>
        <span class="message-text">Тестовое сообщение ${i}</span>
        <span class="message-time">${new Date().toLocaleTimeString()}</span>
      `;
      chatMessages.appendChild(chatMessage);
    }
    
    // Прокручиваем чат вниз
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Добавляем тестовый контент после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== НАЧАЛО DOMContentLoaded ===');
    console.log('Веб-интерфейс загружен');
    
    // Проверяем, успешно ли прошла авторизация
    if (window.location.search.includes('auth=success')) {
        showNotification('Авторизация через Twitch прошла успешно!', 'success');
        window.history.replaceState({}, document.title, "/");
        isAuthenticated = true;
        updateAuthButtons(true);
    } else if (window.location.search.includes('logout=success')) {
        showNotification('Вы успешно вышли из системы', 'info');
        window.history.replaceState({}, document.title, "/");
        isAuthenticated = false;
        updateAuthButtons(false);
    } else {
        // Проверяем статус авторизации
        checkAuthStatus();
    }
    
    // Инициализируем WebSocket соединение
    initWebSocket();
    
    // Деактивируем кнопки управления по умолчанию
    startBtn.disabled = false;
    resetBtn.disabled = true;
    winnerBtn.style.display = 'none';
    
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
    
    // Добавляем тестовый контент для проверки выравнивания (только для тестирования)
    // setTimeout(addTestContent, 1000);
    
    console.log('=== КОНЕЦ DOMContentLoaded ===');
});

// Новая функция для добавления сообщений в чат модального окна
function addWinnerChatMessage(user, text) {
    console.log('=== НАЧАЛО ФУНКЦИИ addWinnerChatMessage ===');
    console.log('Добавление сообщения в чат модального окна:', { user, text });
    
    // Проверяем, что модальное окно открыто
    if (winnerSection.style.display !== 'block') {
        console.log('Модальное окно не открыто, игнорируем сообщение');
        console.log('=== КОНЕЦ ФУНКЦИИ addWinnerChatMessage ===');
        return;
    }
    
    // Добавляем сообщение в массив
    const message = {
        user: user,
        text: text,
        time: new Date()
    };
    winnerChatMessages.push(message);
    
    // Добавляем сообщение в чат модального окна
    const winnerChat = document.getElementById('winnerChat');
    if (winnerChat) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'winner-chat-message';
        
        // Если сообщение от победителя, добавляем специальный класс и останавливаем таймер
        if (user === currentWinner) {
            messageDiv.classList.add('winner-response');
            winnerResponded = true; // Победитель ответил
            stopWinnerTimer(); // Останавливаем таймер когда победитель пишет
        }
        
        // Формат времени 00:00:00
        const timeString = `${message.time.getHours().toString().padStart(2, '0')}:${message.time.getMinutes().toString().padStart(2, '0')}:${message.time.getSeconds().toString().padStart(2, '0')}`;
        
        messageDiv.innerHTML = `
            <span class="winner-chat-time">${timeString}</span>
            <span class="winner-chat-user">${user}:</span>
            <span class="winner-chat-text">${text}</span>
        `;
        
        winnerChat.appendChild(messageDiv);
        winnerChat.scrollTop = winnerChat.scrollHeight;
    }
    
    console.log('=== КОНЕЦ ФУНКЦИИ addWinnerChatMessage ===');
}
