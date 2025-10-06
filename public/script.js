// Элементы DOM
const authBtn = document.getElementById('authBtn');
const channelNameInput = document.getElementById('channelName');
const joinChannelBtn = document.getElementById('joinChannelBtn');
const leaveChannelBtn = document.getElementById('leaveChannelBtn');
const giveawayKeywordInput = document.getElementById('giveawayKeyword');
const giveawayPrizeInput = document.getElementById('giveawayPrize');
const startGiveawayBtn = document.getElementById('startGiveawayBtn');
const endGiveawayBtn = document.getElementById('endGiveawayBtn');
const activeGiveawaysList = document.getElementById('activeGiveawaysList');
const giveawaysHistory = document.getElementById('giveawaysHistory');

// Обработчики событий
authBtn.addEventListener('click', handleAuth);
joinChannelBtn.addEventListener('click', handleJoinChannel);
leaveChannelBtn.addEventListener('click', handleLeaveChannel);
startGiveawayBtn.addEventListener('click', handleStartGiveaway);
endGiveawayBtn.addEventListener('click', handleEndGiveaway);

// Функция обработки авторизации
function handleAuth() {
    // Показываем индикатор загрузки
    const originalText = authBtn.innerHTML;
    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Перенаправление...';
    authBtn.disabled = true;
    
    // Перенаправляем на маршрут авторизации Twitch
    window.location.href = '/auth/twitch';
}

// Функция добавления бота в канал
function handleJoinChannel() {
    const channelName = channelNameInput.value.trim();
    
    if (!channelName) {
        showNotification('Пожалуйста, введите имя канала', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = joinChannelBtn.innerHTML;
    joinChannelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Добавление...';
    joinChannelBtn.disabled = true;
    
    fetch(`/api/channels/${channelName}/join`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showNotification(`Ошибка: ${data.error}`, 'error');
        } else {
            showNotification(data.message, 'success');
            loadGiveawaysHistory(channelName);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showNotification('Произошла ошибка при добавлении бота в канал', 'error');
    })
    .finally(() => {
        // Восстанавливаем кнопку
        joinChannelBtn.innerHTML = originalText;
        joinChannelBtn.disabled = false;
    });
}

// Функция удаления бота из канала
function handleLeaveChannel() {
    const channelName = channelNameInput.value.trim();
    
    if (!channelName) {
        showNotification('Пожалуйста, введите имя канала', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = leaveChannelBtn.innerHTML;
    leaveChannelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
    leaveChannelBtn.disabled = true;
    
    fetch(`/api/channels/${channelName}/leave`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showNotification(`Ошибка: ${data.error}`, 'error');
        } else {
            showNotification(data.message, 'success');
            activeGiveawaysList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gifts"></i>
                    <p>Нет активных розыгрышей</p>
                </div>
            `;
            giveawaysHistory.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>История розыгрышей пуста</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showNotification('Произошла ошибка при удалении бота из канала', 'error');
    })
    .finally(() => {
        // Восстанавливаем кнопку
        leaveChannelBtn.innerHTML = originalText;
        leaveChannelBtn.disabled = false;
    });
}

// Функция начала розыгрыша
function handleStartGiveaway() {
    const channelName = channelNameInput.value.trim();
    const keyword = giveawayKeywordInput.value.trim();
    const prize = giveawayPrizeInput.value.trim();
    
    if (!channelName) {
        showNotification('Пожалуйста, введите имя канала', 'error');
        return;
    }
    
    if (!keyword) {
        showNotification('Пожалуйста, введите ключевое слово', 'error');
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
    
    // В реальной реализации здесь будет отправка команды боту через Twitch чат
    setTimeout(() => {
        showNotification(`Розыгрыш "${prize}" начат с ключевым словом "${keyword}" в канале ${channelName}`, 'success');
        
        // Добавляем розыгрыш в список активных
        const giveawayItem = document.createElement('div');
        giveawayItem.className = 'giveaway-item';
        giveawayItem.innerHTML = `
            <h3>${prize}</h3>
            <p><strong>Ключевое слово:</strong> ${keyword}</p>
            <p><strong>Канал:</strong> ${channelName}</p>
            <p><strong>Статус:</strong> <span style="color: #28a745;">Активен</span></p>
            <p><strong>Дата начала:</strong> ${new Date().toLocaleString()}</p>
        `;
        
        // Удаляем пустое состояние, если оно есть
        if (activeGiveawaysList.querySelector('.empty-state')) {
            activeGiveawaysList.innerHTML = '';
        }
        
        activeGiveawaysList.prepend(giveawayItem);
        
        // Очищаем форму
        giveawayKeywordInput.value = '';
        giveawayPrizeInput.value = '';
        
        // Восстанавливаем кнопку
        startGiveawayBtn.innerHTML = originalText;
        startGiveawayBtn.disabled = false;
    }, 1000);
}

// Функция завершения розыгрыша
function handleEndGiveaway() {
    const channelName = channelNameInput.value.trim();
    
    if (!channelName) {
        showNotification('Пожалуйста, введите имя канала', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const originalText = endGiveawayBtn.innerHTML;
    endGiveawayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Завершение...';
    endGiveawayBtn.disabled = true;
    
    // В реальной реализации здесь будет отправка команды боту через Twitch чат
    setTimeout(() => {
        showNotification(`Розыгрыш в канале ${channelName} завершен. Победитель: User123`, 'success');
        
        // Перемещаем активные розыгрыши в историю
        const activeItems = activeGiveawaysList.querySelectorAll('.giveaway-item');
        if (activeItems.length > 0) {
            // Удаляем пустое состояние из истории, если оно есть
            if (giveawaysHistory.querySelector('.empty-state')) {
                giveawaysHistory.innerHTML = '';
            }
            
            // Перемещаем все активные розыгрыши в историю
            activeItems.forEach(item => {
                // Добавляем информацию о победителе
                const winnerInfo = document.createElement('p');
                winnerInfo.innerHTML = '<strong>Победитель:</strong> <span class="winner">User123</span>';
                item.appendChild(winnerInfo);
                
                giveawaysHistory.prepend(item);
            });
            
            // Показываем пустое состояние для активных розыгрышей
            activeGiveawaysList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gifts"></i>
                    <p>Нет активных розыгрышей</p>
                </div>
            `;
        }
        
        // Восстанавливаем кнопку
        endGiveawayBtn.innerHTML = originalText;
        endGiveawayBtn.disabled = false;
    }, 1000);
}

// Загрузка истории розыгрышей
function loadGiveawaysHistory(channelName) {
    if (!channelName) return;
    
    // Показываем индикатор загрузки
    giveawaysHistory.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="fas fa-spinner fa-spin"></i> Загрузка истории...
        </div>
    `;
    
    fetch(`/api/giveaways/${channelName}`)
    .then(response => response.json())
    .then(giveaways => {
        if (giveaways.length === 0) {
            giveawaysHistory.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>История розыгрышей пуста</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        giveaways.forEach(giveaway => {
            html += `
                <div class="giveaway-item">
                    <h3>${giveaway.prize}</h3>
                    <p><strong>Ключевое слово:</strong> ${giveaway.keyword}</p>
                    <p><strong>Дата начала:</strong> ${new Date(giveaway.started_at).toLocaleString()}</p>
                    <p><strong>Статус:</strong> ${giveaway.is_active ? '<span style="color: #28a745;">Активен</span>' : '<span style="color: #dc3545;">Завершен</span>'}</p>
                    ${giveaway.winner ? `<p><strong>Победитель:</strong> <span class="winner">${giveaway.winner}</span></p>` : ''}
                    ${giveaway.ended_at ? `<p><strong>Дата завершения:</strong> ${new Date(giveaway.ended_at).toLocaleString()}</p>` : ''}
                </div>
            `;
        });
        
        giveawaysHistory.innerHTML = html;
    })
    .catch(error => {
        console.error('Ошибка загрузки истории:', error);
        giveawaysHistory.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки истории розыгрышей</p>
            </div>
        `;
    });
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
});