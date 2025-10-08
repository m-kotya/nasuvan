@echo off
echo Автоматическая загрузка изменений в репозиторий GitHub
echo ====================================================

cd /d "c:\Users\D\Desktop\Giveway Bot\twitch-giveaway-bot"

echo Добавление изменений в индекс...
git add .

echo Создание коммита...
git commit -m "Автоматическая загрузка изменений: %date% %time%"

echo Отправка изменений в удаленный репозиторий...
git push origin main

echo.
echo Загрузка изменений завершена!
pause