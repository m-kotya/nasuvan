# Используем официальный образ Node.js как базовый
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --omit=dev

# Копируем исходный код
COPY . .

# Открываем порт, который будет использовать приложение
EXPOSE $PORT

# Создаем непривилегированного пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Меняем владельца файлов на непривилегированного пользователя
USER nextjs

# Команда для запуска приложения
CMD ["npm", "start"]