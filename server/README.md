# 🚀 Wintozo Server

Серверная часть мессенджера Wintozo.

## Быстрый старт

```bash
cd server
npm install
npm start
```

## Деплой на Render.com

1. Создайте аккаунт на [Render.com](https://render.com)
2. Нажмите "New" → "Web Service"
3. Подключите ваш GitHub репозиторий
4. Настройте:
   - **Name**: wintozo-server
   - **Root Directory**: server
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Добавьте переменные окружения:
   - `JWT_SECRET`: ваш секретный ключ (любой длинный случайный текст)
   - `ADMIN_PASSWORD`: пароль для аккаунта @Admin (ОБЯЗАТЕЛЬНО!)
6. Нажмите "Create Web Service"

⚠️ **ВАЖНО**: Никогда не храните пароли в коде! Только через переменные окружения.

После деплоя вы получите URL вида: `https://wintozo-server.onrender.com`

## API Endpoints

### Авторизация

- `POST /api/register` - Регистрация
- `POST /api/login` - Вход
- `POST /api/verify` - Проверка токена

### Сообщения

- `GET /api/messages/:chatId` - Получить историю чата

## WebSocket Events

### Клиент → Сервер

- `join` - Присоединиться к чату
- `message` - Отправить сообщение
- `typing` - Индикатор печати
- `admin-command` - Админ-команда

### Сервер → Клиент

- `message` - Новое сообщение
- `typing` - Кто-то печатает
- `admin-response` - Ответ на команду

## Админ-команды

```
/ban "username" infinity     - Забанить навсегда
/ban "username" 7 days       - Забанить на 7 дней
/unban "username"            - Разбанить
/give-pro "username" 14      - Выдать Pro на 14 дней
/stats                       - Статистика сервера
```

## Wintozo-Pro

Подписка даёт:
- 💎 VIP значок
- 📝 Жирный ник
- 🆔 Смена ID
- 📢 Доступ в Wintozo Official

## Безопасность

⚠️ В продакшене:
- Используйте bcrypt для хэширования паролей
- Настройте HTTPS
- Ограничьте CORS только вашим доменом
- Используйте MongoDB/PostgreSQL вместо памяти
