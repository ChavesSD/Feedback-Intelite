const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const os = require('os');
const dns = require('dns').promises;
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
const VALID_SECTORS = ['Suporte', 'Comercial', 'RH', 'Geral'];
const VALID_ROLES = ['employee', 'supervisor'];
const VALID_FEEDBACK_TYPES = ['positive', 'negative', 'neutral'];
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const MAX_NAME_LEN = 120;
const MAX_USERNAME_LEN = 80;
const MAX_CONTENT_LEN = 4000;
const MAX_ATTACHMENT_LEN = 5_500_000;
const MIN_PASSWORD_LEN = 6;

if (!JWT_SECRET) {
  if (isProduction) {
    console.error('❌ JWT_SECRET é obrigatório em produção.');
    process.exit(1);
  }
  console.warn('⚠️ JWT_SECRET não definido. Defina no .env antes de ir para produção.');
}

const jwtSecret = JWT_SECRET || 'dev-only-insecure-secret';
app.disable('x-powered-by');

const isValidObjectId = (value) => typeof value === 'string' && OBJECT_ID_RE.test(value);
const asTrimmedString = (value, maxLen) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return maxLen ? trimmed.slice(0, maxLen) : trimmed;
};

const looksLikeImage = (buf) => {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  return false;
};

const isSafeAttachment = (value) => {
  if (!value) return true;
  if (typeof value !== 'string' || value.length > MAX_ATTACHMENT_LEN) return false;
  if (value.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isPrivateIPv4 = (host) => {
  const parts = host.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
};

const isBlockedHostname = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') return true;
  if (host.includes(':')) {
    if (host === '::1' || host === '::') return true;
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('::ffff:')) return true;
  }
  return isPrivateIPv4(host);
};

const assertPublicUrl = async (targetUrl) => {
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error('Protocolo não suportado');
  }
  const hostname = targetUrl.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new Error('Host não permitido');
  }
  const { address } = await dns.lookup(hostname);
  if (isBlockedHostname(address)) {
    throw new Error('Host não permitido');
  }
};

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const getClientKey = (req, username) => {
  const xf = req.headers['x-forwarded-for'];
  const ip = (typeof xf === 'string' && xf.split(',')[0].trim()) || req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${String(username || '').toLowerCase()}`;
};
const isLoginRateLimited = (key) => {
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return rec.count >= LOGIN_MAX_ATTEMPTS;
};
const recordLoginFailure = (key) => {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now });
    return;
  }
  rec.count += 1;
};

const authenticate = (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Não autenticado' });
    const payload = jwt.verify(token, jwtSecret);
    if (!payload?.id || !payload?.role) return res.status(401).json({ message: 'Token inválido ou expirado' });
    req.user = { id: String(payload.id), role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' });
  }
};

const requireSupervisor = (req, res, next) => {
  if (req.user?.role !== 'supervisor') return res.status(403).json({ message: 'Acesso negado' });
  return next();
};

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

// Middleware
const allowedOrigins = (() => {
  const list = [];
  if (process.env.RAILWAY_STATIC_URL) list.push(`https://${process.env.RAILWAY_STATIC_URL}`);
  if (process.env.FRONTEND_ORIGIN) list.push(process.env.FRONTEND_ORIGIN);
  list.push('http://localhost:8080', 'http://127.0.0.1:8080');
  return list;
})();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (process.env.NODE_ENV === 'development') return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '6mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.secure || (req.headers['x-forwarded-proto'] || '').includes('https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

// Serve static files from the frontend build
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI é obrigatório.');
  process.exit(1);
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
})
  .then(async () => {
    console.log('✅ Conectado ao MongoDB Atlas');
    // Chamar a criação de supervisores IMEDIATAMENTE após conectar
    await createInitialSupervisors();
  })
  .catch(err => {
    console.error('❌ Erro crítico ao conectar ao MongoDB:');
    console.error(`   Mensagem: ${err.message}`);
  });

// Desativar buffering para que as rotas retornem erro imediatamente se o banco estiver fora
mongoose.set('bufferCommands', false);

// --- Schemas & Models ---

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['employee', 'supervisor'], default: 'employee' },
  sector: { type: String, enum: ['Suporte', 'Comercial', 'RH', 'Geral'], default: 'Geral' },
  avatar: { type: String, default: '' },
  skills: {
    atendimento: { type: Number, default: 0, min: 0, max: 5 },
    proatividade: { type: Number, default: 0, min: 0, max: 5 },
    tratamento: { type: Number, default: 0, min: 0, max: 5 },
    agilidade: { type: Number, default: 0, min: 0, max: 5 },
    dificuldade: { type: Number, default: 0, min: 0, max: 5 }
  },
  resolutionRate: { type: Number, default: 0, min: 0, max: 100 },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

const feedbackSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  senderName: { type: String, default: 'Anônimo' },
  receiverId: { type: String, required: true }, // 'supervisor' or User ID
  receiverSector: { type: String, default: 'Geral' }, // Adicionado para facilitar filtros
  content: { type: String, required: true },
  attachment: { type: String, default: '' }, // URL ou Base64 da imagem anexada
  rating: { type: Number, required: true, min: 1, max: 5 },
  type: { type: String, enum: ['positive', 'negative', 'neutral'], default: 'neutral' },
  isAnonymous: { type: Boolean, default: true },
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// --- Routes ---

// 1. Auth & Users
app.post('/api/login', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Tentativa de login sem conexão com o banco de dados.');
      return res.status(503).json({
        message: 'Serviço temporariamente indisponível: Erro de conexão com o banco de dados (IP bloqueado no Atlas?)'
      });
    }

    const username = asTrimmedString(req.body?.username, MAX_USERNAME_LEN).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    const attemptKey = getClientKey(req, username);
    if (isLoginRateLimited(attemptKey)) {
      return res.status(429).json({ message: 'Muitas tentativas. Tente novamente em alguns minutos.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      recordLoginFailure(attemptKey);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      recordLoginFailure(attemptKey);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    loginAttempts.delete(attemptKey);
    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        sector: user.sector,
        avatar: user.avatar,
        skills: user.skills,
        resolutionRate: user.resolutionRate
      }
    });
  } catch (error) {
    console.error('💥 Erro no servidor durante login:', error);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/users/public', authenticate, async (req, res) => {
  try {
    const users = await User.find().select('_id name username role sector avatar skills resolutionRate');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/users', authenticate, requireSupervisor, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/users', authenticate, requireSupervisor, async (req, res) => {
  try {
    const name = asTrimmedString(req.body?.name, MAX_NAME_LEN);
    const username = asTrimmedString(req.body?.username, MAX_USERNAME_LEN).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar : '';
    const sector = VALID_SECTORS.includes(req.body?.sector) ? req.body.sector : 'Geral';

    if (!name || !username) {
      return res.status(400).json({ message: 'Nome e usuário são obrigatórios' });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ message: `A senha deve ter pelo menos ${MIN_PASSWORD_LEN} caracteres` });
    }
    if (avatar && !isSafeAttachment(avatar)) {
      return res.status(400).json({ message: 'Avatar inválido' });
    }

    const newUser = new User({
      name,
      username,
      role: 'employee',
      sector,
      password,
      avatar
    });
    await newUser.save();
    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role,
      sector: newUser.sector,
      avatar: newUser.avatar,
      skills: newUser.skills,
      resolutionRate: newUser.resolutionRate
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Nome de usuário já existe' });
    }
    res.status(400).json({ message: 'Erro ao criar usuário' });
  }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const isSelf = req.user.id === String(user._id);
    const isSupervisor = req.user.role === 'supervisor';

    if (!isSelf && !isSupervisor) return res.status(403).json({ message: 'Acesso negado' });

    const name = asTrimmedString(req.body?.name, MAX_NAME_LEN);
    const username = asTrimmedString(req.body?.username, MAX_USERNAME_LEN).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const avatar = req.body?.avatar;
    const sector = req.body?.sector;
    const role = req.body?.role;
    const skills = req.body?.skills;
    const resolutionRate = req.body?.resolutionRate;

    if (password && password.length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ message: `A senha deve ter pelo menos ${MIN_PASSWORD_LEN} caracteres` });
    }
    if (avatar !== undefined && avatar !== '' && !isSafeAttachment(avatar)) {
      return res.status(400).json({ message: 'Avatar inválido' });
    }

    if (isSelf) {
      if (name) user.name = name;
      if (avatar !== undefined) user.avatar = avatar;
      if (password) user.password = password;
    }

    if (isSupervisor) {
      if (name) user.name = name;
      if (username) user.username = username;
      if (avatar !== undefined) user.avatar = avatar;
      if (VALID_SECTORS.includes(sector)) user.sector = sector;
      if (VALID_ROLES.includes(role) && !(isSelf && role !== 'supervisor')) user.role = role;
      if (password) user.password = password;

      const toNumberOrNull = (value) => {
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : null;
      };
      const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

      if (skills && typeof skills === 'object') {
        const fields = ['atendimento', 'proatividade', 'tratamento', 'agilidade', 'dificuldade'];
        if (!user.skills) user.skills = {};
        for (const field of fields) {
          if (skills[field] !== undefined) {
            const n = toNumberOrNull(skills[field]);
            if (n !== null) user.skills[field] = clamp(n, 0, 5);
          }
        }
      }

      if (resolutionRate !== undefined) {
        const n = toNumberOrNull(resolutionRate);
        if (n !== null) user.resolutionRate = clamp(n, 0, 100);
      }
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      sector: user.sector,
      avatar: user.avatar,
      skills: user.skills,
      resolutionRate: user.resolutionRate
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Nome de usuário já existe' });
    }
    res.status(400).json({ message: 'Erro ao atualizar usuário' });
  }
});

app.delete('/api/users/:id', authenticate, requireSupervisor, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'Você não pode remover a si mesmo' });
    }
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Usuário removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

// 2. Feedbacks
app.get('/api/feedbacks/sent/:senderId', authenticate, async (req, res) => {
  try {
    const { senderId } = req.params;
    if (!isValidObjectId(senderId)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    if (req.user.role !== 'supervisor' && req.user.id !== senderId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    const feedbacks = await Feedback.find({ senderId }).sort({ date: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.delete('/api/feedbacks/:id', authenticate, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback não encontrado' });
    }

    const senderId = feedback.senderId ? feedback.senderId.toString() : '';
    const receiverId = feedback.receiverId ? feedback.receiverId.toString() : '';
    const requesterId = req.user.id;
    const isSupervisor = req.user.role === 'supervisor';
    const canDelete = isSupervisor || senderId === requesterId || receiverId === requesterId;
    if (!canDelete) {
      return res.status(403).json({ message: 'Sem permissão para excluir este feedback' });
    }

    await Feedback.deleteOne({ _id: feedback._id });
    res.json({ message: 'Feedback removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/feedbacks/:receiverId', authenticate, async (req, res) => {
  try {
    const { receiverId } = req.params;
    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    if (req.user.role !== 'supervisor' && req.user.id !== receiverId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    const feedbacks = await Feedback.find({ receiverId }).sort({ date: -1 });
    const safe = feedbacks.map((f) => {
      if (f.isAnonymous) {
        return {
          ...f.toObject(),
          senderId: undefined,
          senderName: 'Anônimo'
        };
      }
      return f;
    });
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/feedbacks', authenticate, async (req, res) => {
  try {
    const receiverId = asTrimmedString(req.body?.receiverId, 64);
    const content = asTrimmedString(req.body?.content, MAX_CONTENT_LEN);
    const rating = Number(req.body?.rating);
    const type = VALID_FEEDBACK_TYPES.includes(req.body?.type) ? req.body.type : 'neutral';
    const isAnonymous = Boolean(req.body?.isAnonymous);
    const attachment = typeof req.body?.attachment === 'string' ? req.body.attachment : '';

    if (!isValidObjectId(receiverId) || !content || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Dados do feedback inválidos' });
    }
    if (receiverId === req.user.id) {
      return res.status(400).json({ message: 'Não é possível enviar feedback para si mesmo' });
    }
    if (attachment && !isSafeAttachment(attachment)) {
      return res.status(400).json({ message: 'Anexo inválido' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Destinatário não encontrado' });
    }

    const sender = await User.findById(req.user.id);
    const newFeedback = new Feedback({
      senderId: req.user.id || null,
      senderName: isAnonymous ? 'Anônimo' : (sender?.name || 'Usuário'),
      receiverId,
      receiverSector: receiver.sector || 'Geral',
      content,
      rating,
      isAnonymous,
      type,
      attachment
    });
    await newFeedback.save();

    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao enviar feedback' });
  }
});

// 3. Stats & Dashboard
app.get('/api/stats/dashboard', authenticate, async (req, res) => {
  try {
    const { sector } = req.query;

    const topEmployees = await Feedback.aggregate([
      // Primeiro agrupa por quem recebeu o feedback
      {
        $group: {
          _id: '$receiverId',
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      },
      // Converte o ID para ObjectId para o lookup
      {
        $addFields: {
          userIdObj: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: "$_id" }, "string"] },
                  { $eq: [{ $strLenCP: "$_id" }, 24] },
                  { $regexMatch: { input: "$_id", regex: "^[0-9a-fA-F]{24}$" } }
                ]
              },
              then: { $toObjectId: "$_id" },
              else: {
                $cond: {
                  if: { $eq: [{ $type: "$_id" }, "objectId"] },
                  then: "$_id",
                  else: null
                }
              }
            }
          }
        }
      },
      // Busca informações do usuário
      {
        $lookup: {
          from: 'users',
          localField: 'userIdObj',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      // Filtra apenas funcionários e pelo setor se solicitado
      {
        $match: {
          'userInfo.role': 'employee',
          ...(sector && sector !== 'Todos' ? { 'userInfo.sector': sector } : {})
        }
      },
      // Ordena pelos melhores avaliados
      { $sort: { averageRating: -1, count: -1 } },
      { $limit: 3 },
      {
        $project: {
          name: '$userInfo.name',
          sector: '$userInfo.sector',
          avatar: '$userInfo.avatar',
          skills: '$userInfo.skills',
          resolutionRate: '$userInfo.resolutionRate',
          averageRating: 1,
          count: 1
        }
      }
    ]);

    const topSupervisors = await Feedback.aggregate([
      {
        $group: {
          _id: '$receiverId',
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      },
      {
        $addFields: {
          userIdObj: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: "$_id" }, "string"] },
                  { $eq: [{ $strLenCP: "$_id" }, 24] },
                  { $regexMatch: { input: "$_id", regex: "^[0-9a-fA-F]{24}$" } }
                ]
              },
              then: { $toObjectId: "$_id" },
              else: {
                $cond: {
                  if: { $eq: [{ $type: "$_id" }, "objectId"] },
                  then: "$_id",
                  else: null
                }
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdObj',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $match: {
          'userInfo.role': 'supervisor',
          ...(sector && sector !== 'Todos' ? { 'userInfo.sector': sector } : {})
        }
      },
      { $sort: { averageRating: -1, count: -1 } },
      { $limit: 3 },
      {
        $project: {
          name: '$userInfo.name',
          sector: '$userInfo.sector',
          avatar: '$userInfo.avatar',
          skills: '$userInfo.skills',
          resolutionRate: '$userInfo.resolutionRate',
          averageRating: 1,
          count: 1
        }
      }
    ]);

    // Feedbacks per Sector
    const sectorStats = await Feedback.aggregate([
      {
        $group: {
          _id: '$receiverSector',
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          name: { $ifNull: ['$_id', 'Geral'] },
          count: 1,
          averageRating: 1
        }
      }
    ]);

    // Feedbacks by Type (positive, negative, neutral)
    const typeMatch = {};
    if (sector && sector !== 'Todos') {
      typeMatch.receiverSector = sector;
    }

    const typeStats = await Feedback.aggregate([
      { $match: typeMatch },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          name: { $ifNull: ['$_id', 'neutral'] },
          value: '$count'
        }
      }
    ]);

    res.json({
      topEmployees,
      topSupervisors,
      sectorStats,
      typeStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

// Create initial supervisors if they don't exist
const createInitialSupervisors = async () => {
  try {
    const supervisorsToCreate = [
      {
        name: 'Deyvison (Suporte)',
        username: 'deyvison@intelite.com',
        role: 'supervisor',
        sector: 'Suporte',
        passwordEnv: 'SUPERVISOR_SUPORTE_PASSWORD'
      },
      {
        name: 'Hemelly (Comercial)',
        username: 'hemelly@intelite.com',
        role: 'supervisor',
        sector: 'Comercial',
        passwordEnv: 'SUPERVISOR_COMERCIAL_PASSWORD'
      },
      {
        name: 'Leticia (RH)',
        username: 'leticia@intelite.com',
        role: 'supervisor',
        sector: 'RH',
        passwordEnv: 'SUPERVISOR_RH_PASSWORD'
      }
    ];

    for (const s of supervisorsToCreate) {
      const exists = await User.findOne({ username: s.username });
      if (!exists) {
        const password = process.env[s.passwordEnv];
        if (!password || password.length < MIN_PASSWORD_LEN) {
          console.warn(`⚠️ Supervisor ${s.username} não criado. Defina ${s.passwordEnv} no .env`);
          continue;
        }
        await User.create({
          name: s.name,
          username: s.username,
          role: s.role,
          sector: s.sector,
          password
        });
        console.log(`👤 Supervisor criado: ${s.name} (${s.username})`);
      } else {
        let updated = false;
        if (exists.role !== 'supervisor') {
          exists.role = 'supervisor';
          updated = true;
        }
        if (exists.sector !== s.sector) {
          exists.sector = s.sector;
          updated = true;
        }
        if (exists.password && !exists.password.startsWith('$2')) {
          exists.markModified('password');
          updated = true;
        }

        if (updated) {
          await exists.save();
          console.log(`✅ Dados atualizados para o supervisor: ${s.name}`);
        }
      }
    }

    // Remover o supervisor antigo genérico se ele existir
    const oldSupervisor = await User.findOne({ username: 'supervisor' });
    if (oldSupervisor) {
      await User.deleteOne({ username: 'supervisor' });
      console.log('🗑️ Antigo usuário "supervisor" removido para segurança');
    }

  } catch (error) {
    console.error('❌ Erro ao inicializar supervisores:', error);
  }
};
// Remover chamada solta ao final e manter apenas dentro do .then() da conexão
// createInitialSupervisors();

app.get('/api/avatar', authenticate, async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!rawUrl) {
    res.status(400).json({ message: 'Parâmetro url é obrigatório' });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    res.status(400).json({ message: 'URL inválida' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let current = targetUrl;
    let response = null;
    for (let hop = 0; hop < 6; hop++) {
      await assertPublicUrl(current);
      response = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          res.status(502).json({ message: 'Falha ao buscar imagem' });
          return;
        }
        current = new URL(location, current);
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      res.status(502).json({ message: 'Falha ao buscar imagem' });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    const typeLooksImage =
      contentType.startsWith('image/') ||
      contentType === '' ||
      contentType.startsWith('application/octet-stream');

    res.setHeader('Cache-Control', 'private, max-age=3600');

    const MAX_BYTES = 5 * 1024 * 1024;
    let total = 0;
    let headerSent = false;
    const sendHeader = (chunk) => {
      const ok = typeLooksImage || looksLikeImage(chunk);
      if (!ok) return false;
      res.setHeader('Content-Type', contentType.startsWith('image/') ? contentType : 'application/octet-stream');
      headerSent = true;
      return true;
    };

    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = Buffer.from(value);
        total += chunk.byteLength;
        if (total > MAX_BYTES) {
          if (!headerSent) res.status(413);
          res.end();
          return;
        }
        if (!headerSent && !sendHeader(chunk)) {
          res.status(415).json({ message: 'Conteúdo não é uma imagem' });
          return;
        }
        res.write(chunk);
      }
      if (!headerSent) {
        res.status(415).json({ message: 'Conteúdo não é uma imagem' });
        return;
      }
      res.end();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > MAX_BYTES) {
      res.status(413).end();
      return;
    }
    if (!typeLooksImage && !looksLikeImage(buffer)) {
      res.status(415).json({ message: 'Conteúdo não é uma imagem' });
      return;
    }
    res.setHeader('Content-Type', contentType.startsWith('image/') ? contentType : 'application/octet-stream');
    res.end(buffer);
  } catch (error) {
    if (error?.message === 'Host não permitido' || error?.message === 'Protocolo não suportado') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(502).json({ message: 'Erro ao carregar imagem' });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('*all', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ message: 'JSON inválido' });
  }
  console.error('Erro não tratado:', err);
  return res.status(500).json({ message: 'Erro interno' });
});

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`🚀 Backend rodando em:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Rede:    http://${localIP}:${PORT}`);
});
