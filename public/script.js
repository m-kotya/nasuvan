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
    // В реальной реализации здесь будет редирект на Twitch OAuth
    alert('Авторизация через Twitch будет реализована здесь');
}

// Функция добавления бота в канал
function handleJoinChannel() {
    const channelName = channelNameInput.value.trim();
    
    if (!channelName) {
        alert('Пожалуйста, введите имя канала');
        return;
    }
    
    fetch(`/api/channels/${channelName}/join`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(`Ошибка: ${data.error}`);
        } else {
            alert(data.message);
            loadGiveawaysHistory(channelName);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при добавлении бота в канал');
    });
}

// Функция удаления бота из канала
function handleLeaveChannel() {
    const channelName = channelNameInput.value.trim();
    
    if (!channelName) {
        alert('Пожалуйста, введите имя канала');
        return;
    }
    
    fetch(`/api/channels/${channelName}/leave`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(`Ошибка: ${data.error}`);
        } else {
            alert(data.message);
            activeGiveawaysList.innerHTML = '<p>Нет активных розыгрышей</p>';
            giveawaysHistory.innerHTML = '<p>История розыгрышей пуста</p>';
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при удалении бота из канала');
    });
}

// Функция начала розыгрыша
function handleStartGiveaway() {
    const channelName = channelNameInput.value.trim();
    const keyword = giveawayKeywordInput.value.trim();
    const prize = giveawayPrizeInput.value.trim();
    
    if (!channelName) {
        alert('Пожалуйста, введите имя канала');
        return;
    }
    
    if (!keyword) {
        alert('Пожалуйста, введите ключевое слово');
        return;
    }
    
    if (!prize) {
        alert('Пожалуйста, введите описание приза');
        return;
    }
    
    // В реальной реализации здесь будет отправка команды боту через Twitch чат
    alert(`Розыгрыш "${prize}" будет начат с ключевым словом "${keyword}" в канале ${channelName}`);
    
    // Очищаем форму
    giveawayKeywordInput.value = '';
    giveawayPrizeInput.value = '';
}

// Функция завершения розыгрыша
function handleEndGiveaway() {
    const channelName = channelNameInput.value.trim();
    
    if (!channelName) {
        alert('Пожалуйста, введите имя канала');
        return;
    }
    
    // В реальной реализации здесь будет отправка команды боту через Twitch чат
    alert(`Розыгрыш в канале ${channelName} будет завершен`);
}

// Загрузка истории розыгрышей
function loadGiveawaysHistory(channelName) {
    if (!channelName) return;
    
    fetch(`/api/giveaways/${channelName}`)
    .then(response => response.json())
    .then(giveaways => {
        if (giveaways.length === 0) {
            giveawaysHistory.innerHTML = '<p>История розыгрышей пуста</p>';
            return;
        }
        
        let html = '';
        giveaways.forEach(giveaway => {
            html += `
                <div class="giveaway-item">
                    <h3>${giveaway.prize}</h3>
                    <p><strong>Ключевое слово:</strong> ${giveaway.keyword}</p>
                    <p><strong>Дата начала:</strong> ${new Date(giveaway.started_at).toLocaleString()}</p>
                    <p><strong>Статус:</strong> ${giveaway.is_active ? 'Активен' : 'Завершен'}</p>
                    ${giveaway.winner ? `<p><strong>Победитель:</strong> <span class="winner">${giveaway.winner}</span></p>` : ''}
                    ${giveaway.ended_at ? `<p><strong>Дата завершения:</strong> ${new Date(giveaway.ended_at).toLocaleString()}</p>` : ''}
                </div>
            `;
        });
        
        giveawaysHistory.innerHTML = html;
    })
    .catch(error => {
        console.error('Ошибка загрузки истории:', error);
        giveawaysHistory.innerHTML = '<p>Ошибка загрузки истории розыгрышей</p>';
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Веб-интерфейс загружен');
});