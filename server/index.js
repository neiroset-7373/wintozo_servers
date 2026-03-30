/**
 * 🚀 WINTOZO MESSENGER SERVER
 * 
 * Это серверная часть мессенджера Wintozo.
 * Деплой на Render.com или любой Node.js хостинг.
 * 
 * ИНСТРУКЦИЯ ПО НАСТРОЙКЕ СЕРВЕРА:
 * 
 * 1. Создайте новый Web Service на Render.com
 * 2. Подключите ваш GitHub репозиторий
 * 3. Установите:
 *    - Build Command: npm install
 *    - Start Command: node server/index.js
 * 4. Добавьте переменные окружения:
 *    - JWT_SECRET: ваш секретный ключ
 *    - PORT: 3001 (или оставьте автоматически)
 * 
 * 5. После деплоя скопируйте URL сервера и замените
 *    SERVER_URL в фронтенде (src/config.ts)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// CORS настройки
app.use(cors({
  origin: '*', // В продакшене укажите конкретный домен
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Секретный ключ для JWT (ОБЯЗАТЕЛЬНО установите в переменных окружения!)
const JWT_SECRET = process.env.JWT_SECRET || 'wintozo-super-secret-key-change-me';

// Пароль админа (ОБЯЗАТЕЛЬНО установите в переменных окружения!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('⚠️  ВНИМАНИЕ: Переменная ADMIN_PASSWORD не установлена!');
  console.error('   Установите её в настройках Render или в .env файле');
}

// База данных в памяти (для продакшена используйте MongoDB/PostgreSQL)
const db = {
  users: new Map(),
  messages: new Map(),
  sessions: new Map(),
  bans: new Map(),
  wintozoProUsers: new Map(),
  emojiTeams: new Map(),
};

// Админ по умолчанию (пароль загружается из переменных окружения)
db.users.set('Admin', {
  id: 'admin_wintozo_official',
  odIu: '1',
  username: 'Admin',
  login: 'Admin',
  password: ADMIN_PASSWORD, // Загружается из ENV!
  displayName: 'Admin',
  avatarColor: 'from-blue-500 to-cyan-400',
  createdAt: Date.now(),
  isVerified: true,
  isAdmin: true,
  wintozoProUntil: 999999999999999,
});

// ========== API ENDPOINTS ==========

// Проверка здоровья сервера
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Wintozo Server v2.0.0',
    timestamp: Date.now()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API Health check (для фронтенда)
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: Date.now() });
});

// Регистрация
app.post('/api/register', (req, res) => {
  const { login, password, displayName, selectedEmoji } = req.body;

  if (!login || !password || !displayName) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  if (db.users.has(login.toLowerCase())) {
    return res.status(400).json({ error: 'Пользователь уже существует' });
  }

  const userId = String(db.users.size + 10).padStart(6, '0');
  const user = {
    id: `user_${Date.now()}`,
    odIu: userId,
    username: login.toLowerCase(),
    login: login.toLowerCase(),
    password, // В продакшене хэшируйте bcrypt!
    displayName,
    avatarColor: getRandomGradient(),
    createdAt: Date.now(),
    isVerified: false,
    isAdmin: false,
    selectedEmoji,
    wintozoProUntil: null,
  };

  db.users.set(login.toLowerCase(), user);

  // Добавляем в команду смайликов
  if (selectedEmoji) {
    if (!db.emojiTeams.has(selectedEmoji)) {
      db.emojiTeams.set(selectedEmoji, []);
    }
    db.emojiTeams.get(selectedEmoji).push(user.id);
  }

  const token = jwt.sign({ userId: user.id, login: user.login }, JWT_SECRET, { expiresIn: '30d' });

  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// Вход
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;

  const user = db.users.get(login.toLowerCase());

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  // Проверка бана
  const ban = db.bans.get(user.id);
  if (ban && (ban.until === 'infinity' || ban.until > Date.now())) {
    return res.status(403).json({ error: 'Вы забанены', until: ban.until });
  }

  const token = jwt.sign({ userId: user.id, login: user.login }, JWT_SECRET, { expiresIn: '30d' });

  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// Проверка токена
app.post('/api/verify', (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = Array.from(db.users.values()).find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch {
    res.status(401).json({ error: 'Невалидный токен' });
  }
});

// Получить историю сообщений
app.get('/api/messages/:chatId', authenticateToken, (req, res) => {
  const { chatId } = req.params;
  const messages = db.messages.get(chatId) || [];
  res.json({ messages });
});

// ========== WEBSOCKET ==========

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Требуется авторизация'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userLogin = decoded.login;
    next();
  } catch {
    next(new Error('Невалидный токен'));
  }
});

io.on('connection', (socket) => {
  console.log(`🟢 Пользователь подключен: ${socket.userLogin}`);

  // Присоединение к комнате
  socket.on('join', (chatId) => {
    socket.join(chatId);
    console.log(`📥 ${socket.userLogin} вошёл в чат ${chatId}`);
  });

  // Отправка сообщения
  socket.on('message', (data) => {
    const { chatId, text, messageType, attachment } = data;
    
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      chatId,
      senderId: socket.userId,
      senderLogin: socket.userLogin,
      text,
      messageType: messageType || 'text',
      attachment,
      timestamp: Date.now(),
      status: 'sent',
    };

    // Сохраняем в БД
    if (!db.messages.has(chatId)) {
      db.messages.set(chatId, []);
    }
    db.messages.get(chatId).push(message);

    // Отправляем всем в комнате
    io.to(chatId).emit('message', message);
  });

  // Печатает...
  socket.on('typing', (chatId) => {
    socket.to(chatId).emit('typing', { chatId, userId: socket.userId });
  });

  // Админ-команды
  socket.on('admin-command', (data) => {
    const user = db.users.get(socket.userLogin);
    
    if (!user?.isAdmin) {
      socket.emit('admin-response', { error: 'Недостаточно прав' });
      return;
    }

    const { command, args } = data;
    let result = '';

    switch (command) {
      case 'ban':
        const [banUser, duration] = args;
        const until = duration === 'infinity' ? 'infinity' : Date.now() + parseDuration(duration);
        db.bans.set(banUser, { until, by: socket.userId });
        result = `Пользователь ${banUser} забанен`;
        break;

      case 'unban':
        db.bans.delete(args[0]);
        result = `Пользователь ${args[0]} разбанен`;
        break;

      case 'give-pro':
        const [proUser, days] = args;
        const proUntil = Date.now() + (parseInt(days) || 14) * 24 * 60 * 60 * 1000;
        db.wintozoProUsers.set(proUser, proUntil);
        result = `Wintozo-Pro выдан ${proUser} на ${days} дней`;
        break;

      case 'stats':
        result = JSON.stringify({
          users: db.users.size,
          messages: Array.from(db.messages.values()).flat().length,
          onlineUsers: io.sockets.sockets.size,
        });
        break;

      default:
        result = 'Неизвестная команда';
    }

    socket.emit('admin-response', { result });
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`🔴 Пользователь отключен: ${socket.userLogin}`);
  });
});

// ========== HELPERS ==========

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется токен' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Невалидный токен' });
  }
}

function getRandomGradient() {
  const gradients = [
    'from-violet-500 to-indigo-600',
    'from-pink-500 to-rose-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-cyan-500 to-blue-600',
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
}

function parseDuration(str) {
  const match = str.match(/(\d+)\s*(day|hour|minute|min|h|d|m)/i);
  if (!match) return 24 * 60 * 60 * 1000; // default 1 day
  
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'day':
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    case 'hour':
    case 'h':
      return num * 60 * 60 * 1000;
    case 'minute':
    case 'min':
    case 'm':
      return num * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

// ========== START SERVER ==========

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║  🚀 WINTOZO SERVER v2.0.0             ║
  ║  🌐 http://localhost:${PORT}             ║
  ║  📡 WebSocket готов                   ║
  ╚═══════════════════════════════════════╝
  `);
});
