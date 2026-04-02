const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const os = require('os');
const https = require('https');
const cron = require('node-cron');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to get system base URL for WhatsApp notifications
const getSystemUrl = () => {
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`;
  }
  if (process.env.SYSTEM_URL) {
    return process.env.SYSTEM_URL;
  }
  const localIp = getLocalIP();
  return `http://${localIp}:8080`;
};

// Function to get local IP
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
app.use(cors({
  origin: '*', // Permitir acesso de qualquer origem
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from the frontend build
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

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
  phone: { type: String, default: '' }, // Adicionado para notificações WhatsApp
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

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  attachment: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  recognized: { type: Boolean, default: false },
  recognizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  recognizedAt: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now }
});

const messageTemplateSchema = new mongoose.Schema({
  welcome: {
    type: String,
    default:
      `*Bem-vindo ao Sistema de Feedback!* 🚀\n\n` +
      `Olá {name},\n` +
      `Suas credenciais de acesso foram criadas:\n\n` +
      `🔗 *Acesse:* {systemUrl}\n` +
      `👤 *Login:* {username}\n` +
      `🔑 *Senha:* (A senha definida pelo seu supervisor)\n\n` +
      `Acesse agora para começar a enviar e receber feedbacks!`
  },
  feedback: {
    type: String,
    default:
      `*Novo Feedback Recebido!* 🚀\n\n` +
      `Olá {name},\n` +
      `Você acabou de receber um novo feedback ({type}).\n\n` +
      `*Comentário:* "{content}"\n\n` +
      `Acesse o sistema para ver mais detalhes: {systemUrl}`
  },
  reminder: {
    type: String,
    default:
      `*Lembrete de Reunião de Feedback!* 📅\n\n` +
      `Olá time,\n` +
      `Lembrando que hoje às {meetingTime} teremos nossa reunião semanal de feedback.\n\n` +
      `Preparem seus pontos e nos vemos em breve! 🚀`
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const Event = mongoose.model('Event', eventSchema);
const MessageTemplate = mongoose.model('MessageTemplate', messageTemplateSchema);

const getMessageTemplates = async () => {
  let doc = await MessageTemplate.findOne();
  if (!doc) doc = await MessageTemplate.create({});
  return doc;
};

const renderTemplate = (template, variables) => {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? match : String(value);
  });
};

// --- Routes ---

// 1. Auth & Users
app.post('/api/login', async (req, res) => {
  try {
    // Verificar se o banco está conectado antes de qualquer operação
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Tentativa de login sem conexão com o banco de dados.');
      return res.status(503).json({ 
        message: 'Serviço temporariamente indisponível: Erro de conexão com o banco de dados (IP bloqueado no Atlas?)' 
      });
    }

    const { username, password } = req.body;
    console.log(`🔑 Tentativa de login para: ${username}`);
    
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      console.log(`❌ Usuário não encontrado: ${username}`);
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ Senha incorreta para: ${username}`);
      return res.status(401).json({ message: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ Login bem-sucedido: ${username}`);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        sector: user.sector,
        avatar: user.avatar,
        phone: user.phone || ''
      }
    });
  } catch (error) {
    console.error('💥 Erro no servidor durante login:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, username, role, password, avatar, sector, phone } = req.body;
    const newUser = new User({ 
      name, 
      username: username.toLowerCase(), 
      role,
      sector: sector || 'Geral',
      password: password || process.env.DEFAULT_EMPLOYEE_PASSWORD || 'mudar123',
      avatar: avatar || '',
      phone: phone || ''
    });
    await newUser.save();
    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role,
      sector: newUser.sector,
      avatar: newUser.avatar,
      phone: newUser.phone
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, username, password, avatar, sector, role, phone } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    // Atualizar apenas os campos fornecidos
    if (name) user.name = name;
    if (username) user.username = username.toLowerCase();
    if (avatar !== undefined) user.avatar = avatar;
    if (sector) user.sector = sector;
    if (role) user.role = role;
    if (password) user.password = password;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      sector: user.sector,
      avatar: user.avatar,
      phone: user.phone
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Usuário removido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Feedbacks
app.get('/api/feedbacks/:receiverId', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ receiverId: req.params.receiverId }).sort({ date: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/feedbacks', async (req, res) => {
  try {
    const { senderId, senderName, receiverId, content, rating, isAnonymous, type, attachment } = req.body;
    
    let receiverSector = 'Geral';
    
    // Tentar encontrar o setor do destinatário (seja ele supervisor ou funcionário)
    try {
      const receiver = await User.findById(receiverId);
      if (receiver) {
        receiverSector = receiver.sector;
      }
    } catch (e) {
      // Se receiverId não for um ID válido (ex: 'supervisor' antigo), mantém 'Geral'
      console.log('ℹ️ Destinatário não é um ID de usuário válido ou não encontrado.');
    }

    const newFeedback = new Feedback({
      senderId: isAnonymous ? null : senderId,
      senderName: isAnonymous ? 'Anônimo' : senderName,
      receiverId,
      receiverSector,
      content,
      rating,
      isAnonymous,
      type: type || 'neutral',
      attachment: attachment || ''
    });
    await newFeedback.save();

    // Notificar o destinatário via WhatsApp se ele tiver telefone cadastrado
    try {
      const receiverUser = await User.findById(receiverId);
      if (receiverUser && receiverUser.phone) {
        sendWhatsAppFeedback(receiverUser, newFeedback);
      }
    } catch (err) {
      console.error('ℹ️ Erro ao buscar usuário para notificação WhatsApp');
    }

    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { viewerId } = req.query;
    const viewer = viewerId ? await User.findById(viewerId) : null;
    const isRhViewer = viewer?.sector === 'RH';
    const events = await Event.find().sort({ createdAt: -1 }).populate('recognizedBy', 'name');

    const response = events.map((event) => ({
      _id: event._id,
      title: event.title,
      content: event.content,
      attachment: event.attachment || '',
      createdByName: event.createdByName,
      recognized: event.recognized,
      recognizedAt: event.recognizedAt,
      createdAt: event.createdAt,
      recognizedByName: isRhViewer && event.recognizedBy ? event.recognizedBy.name : undefined
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, content, attachment, creatorId } = req.body;
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ message: 'Usuário criador não encontrado' });
    }
    if (creator.sector !== 'RH') {
      return res.status(403).json({ message: 'Apenas usuários de RH podem criar eventos' });
    }

    const newEvent = new Event({
      title,
      content,
      attachment: attachment || '',
      createdBy: creator._id,
      createdByName: creator.name
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/events/:id/recognize', async (req, res) => {
  try {
    const { userId } = req.body;
    const recognizer = await User.findById(userId);
    if (!recognizer) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    if (event.recognized) {
      return res.status(409).json({ message: 'Este evento já foi reconhecido' });
    }

    event.recognized = true;
    event.recognizedBy = recognizer._id;
    event.recognizedAt = new Date();
    await event.save();

    const feedback = new Feedback({
      senderId: null,
      senderName: 'Sistema de Eventos',
      receiverId: recognizer._id.toString(),
      receiverSector: recognizer.sector || 'Geral',
      content: `Reconhecimento do evento: ${event.title}`,
      rating: 1,
      isAnonymous: false,
      type: 'negative',
      attachment: ''
    });
    await feedback.save();

    res.json({ message: 'Evento reconhecido com sucesso' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Stats & Dashboard
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const { sector } = req.query;

    // Top 3 Employees (based on average rating)
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
      sectorStats,
      typeStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Evolution API WhatsApp Proxy ---
const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'FeedbackSystem';

const evolutionBaseUrl = EVOLUTION_URL ? new URL(EVOLUTION_URL) : null;
const EVOLUTION_ORIGIN = evolutionBaseUrl ? evolutionBaseUrl.origin : '';
const EVOLUTION_BASE_PATH = evolutionBaseUrl ? evolutionBaseUrl.pathname.replace(/\/$/, '') : '';

let API_BASE_PATH = EVOLUTION_BASE_PATH;
let qrCache = { payload: null, fetchedAt: 0 };

if (!EVOLUTION_URL || !EVOLUTION_KEY) {
  console.warn('⚠️ ATENÇÃO: EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados no .env');
}

// Helper para fazer requisições HTTPS
const evolutionRequest = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    if (!EVOLUTION_ORIGIN) {
      reject({ status: 500, data: { message: 'EVOLUTION_API_URL não configurada' } });
      return;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${EVOLUTION_ORIGIN}${API_BASE_PATH}${cleanPath}`;
    
    console.log(`🌐 Chamando Evolution API: [${method}] ${fullUrl}`);

    const url = new URL(fullUrl);
    const options = {
      method: method,
      headers: {
        'apikey': EVOLUTION_KEY,
        'Content-Type': 'application/json',
        'accept': '*/*'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, data: parsed });
          }
        } catch (e) {
          reject({ status: res.statusCode, error: 'JSON_PARSE_ERROR', body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) {
      const postData = JSON.stringify(data);
      req.setHeader('Content-Length', Buffer.byteLength(postData));
      req.write(postData);
    }
    req.end();
  });
};

const buildApiBasePathCandidates = (basePath) => {
  const normalized = basePath === '/' ? '' : basePath;
  const candidates = new Set();

  const add = (p) => {
    const value = p.replace(/\/+$/, '');
    candidates.add(value === '/' ? '' : value);
  };

  add(normalized);

  if (!normalized) {
    add('/api');
    add('/api/v1');
    add('/api/v2');
    add('/v1');
    add('/v2');
  }

  if (normalized === '/api') {
    add('/api/v1');
    add('/api/v2');
  }

  if (normalized === '/v1') add('/v2');

  return Array.from(candidates);
};

const detectApiBasePath = async () => {
  if (!EVOLUTION_ORIGIN) return;

  const candidates = buildApiBasePathCandidates(EVOLUTION_BASE_PATH);
  for (const candidate of candidates) {
    try {
      API_BASE_PATH = candidate;
      await evolutionRequest('GET', '/instance/fetchInstances');
      console.log(`✅ Evolution API detectada com sucesso em: "${API_BASE_PATH || '(root)'}"`);
      return;
    } catch (e) {
      console.log(`ℹ️ Testando base "${candidate || '(root)'}": Falhou (${e.status || 'erro'})`);
    }
  }

  API_BASE_PATH = EVOLUTION_BASE_PATH;
  console.warn('⚠️ Não foi possível detectar a base path da Evolution API automaticamente.');
};

detectApiBasePath();

const getInstanceByName = async () => {
  const instances = await evolutionRequest('GET', '/instance/fetchInstances');
  if (!Array.isArray(instances)) return null;
  return instances.find((i) => i.name === INSTANCE_NAME) || null;
};

const createWhatsAppInstance = async () => {
  const createBody = {
    instanceName: INSTANCE_NAME,
    token: process.env.EVOLUTION_INSTANCE_TOKEN || INSTANCE_NAME,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS'
  };

  if (process.env.WHATSAPP_NUMBER) {
    createBody.number = process.env.WHATSAPP_NUMBER;
  }

  await evolutionRequest('POST', '/instance/create', createBody);
};

const deleteWhatsAppInstance = async () => {
  try {
    await evolutionRequest('DELETE', `/instance/delete/${INSTANCE_NAME}`);
    return;
  } catch (_) {
  }
  await evolutionRequest('POST', `/instance/delete/${INSTANCE_NAME}`);
};

const ensureInstance = async () => {
  let instance = await getInstanceByName();

  const hasPlaceholderNumber = instance?.number === '0000000000@temp' || instance?.number === '0000000000@c.us';

  if (instance && hasPlaceholderNumber) {
    await deleteWhatsAppInstance();
    instance = null;
  }

  if (!instance) {
    console.log(`🚀 Criando nova instância WhatsApp: ${INSTANCE_NAME}`);
    await createWhatsAppInstance();
    instance = await getInstanceByName();
  }

  return instance;
};

const mapConnectionStatus = (status) => {
  if (status === 'open') return 'open';
  if (status === 'connecting') return 'connecting';
  if (status === 'CONNECTED') return 'open';
  if (status === 'CONNECTING') return 'connecting';
  return 'close';
};

const normalizeWhatsAppNumber = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes('@')) return raw;

  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Brasil: se vier sem DDI, assumir 55
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  return digits;
};

const ensureSendableNumber = (value) => {
  const normalized = normalizeWhatsAppNumber(value);
  if (!normalized) {
    throw new Error('Número de WhatsApp inválido ou ausente.');
  }
  if (!normalized.includes('@') && normalized.length < 12) {
    throw new Error('Número de WhatsApp inválido. Use DDI + DDD + número.');
  }
  return normalized;
};

const sendWhatsAppText = async (number, text, options = { delay: 1200, presence: 'composing', linkPreview: false }) => {
  const primaryPayload = {
    number,
    text,
    options
  };

  try {
    return await evolutionRequest('POST', `/message/sendText/${INSTANCE_NAME}`, primaryPayload);
  } catch (error) {
    const fallbackPayload = {
      number,
      options,
      textMessage: { text }
    };
    return await evolutionRequest('POST', `/message/sendText/${INSTANCE_NAME}`, fallbackPayload);
  }
};

app.get('/api/whatsapp/status', async (req, res) => {
  try {
    console.log(`🔍 Verificando status do WhatsApp para: ${INSTANCE_NAME}`);
    await ensureInstance();

    const instance = await getInstanceByName();
    if (!instance) {
      return res.status(404).json({ message: 'Instância não encontrada na Evolution API' });
    }

    const state = mapConnectionStatus(instance.connectionStatus);
    if (state === 'open') {
      qrCache = { payload: null, fetchedAt: 0 };
    }
    res.json({
      instance: {
        instanceName: INSTANCE_NAME,
        status: state,
        owner: instance.ownerJid,
        profileName: instance.profileName,
        profilePictureUrl: instance.profilePicUrl
      }
    });
  } catch (error) {
    console.error('❌ Erro final na rota de status WhatsApp:');
    if (error.status) {
      console.error(`   Status: ${error.status}`);
      console.error(`   Dados:`, JSON.stringify(error.data, null, 2));
    } else {
      console.error(`   Erro:`, error.message || error);
    }
    res.status(500).json({ message: 'Erro ao conectar com Evolution API. Verifique os logs do servidor.' });
  }
});

app.get('/api/whatsapp/qrcode', async (req, res) => {
  try {
    await ensureInstance();
    const now = Date.now();
    if (qrCache.payload && (now - qrCache.fetchedAt) < 35000) {
      return res.json(qrCache.payload);
    }
    const paths = [
      `/instance/qrCode/${INSTANCE_NAME}`,
      `/instance/qrcode/${INSTANCE_NAME}`,
      `/instance/connect/${INSTANCE_NAME}`
    ];
    let data;
    let lastErr;
    for (const p of paths) {
      try {
        data = await evolutionRequest('GET', p);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    // Se nenhum GET funcionou, tentar POST /instance/connect/{name}
    if (!data) {
      try {
        data = await evolutionRequest('POST', `/instance/connect/${INSTANCE_NAME}`);
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) {
      throw lastErr || { status: 500, data: { message: 'QR endpoints failed' } };
    }
    qrCache = { payload: data, fetchedAt: Date.now() };
    res.json(data);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ 
        message: 'A instância pode já estar conectada ou em estado inválido para QR. Reinicie a instância e tente novamente.',
        details: error.data 
      });
    }
    res.status(500).json({ message: 'Erro ao buscar QR Code', details: error.data || error.message });
  }
});

app.post('/api/whatsapp/restart', async (req, res) => {
  try {
    await evolutionRequest('POST', `/instance/restart/${INSTANCE_NAME}`);
    res.json({ message: 'Instância reiniciada' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao reiniciar instância' });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    await ensureInstance();
    const attempts = [
      { method: 'POST', path: `/instance/logout/${INSTANCE_NAME}` },
      { method: 'DELETE', path: `/instance/logout/${INSTANCE_NAME}` },
      { method: 'POST', path: `/instance/disconnect/${INSTANCE_NAME}` },
      { method: 'DELETE', path: `/instance/disconnect/${INSTANCE_NAME}` }
    ];

    let ok = false;
    let lastError = null;

    for (const attempt of attempts) {
      try {
        await evolutionRequest(attempt.method, attempt.path);
        ok = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!ok) {
      throw lastError || new Error('Falha ao desconectar instância');
    }

    qrCache = { payload: null, fetchedAt: 0 };
    res.json({ message: 'Instância desconectada' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar instância', details: error.data || error.message });
  }
});

app.get('/api/whatsapp/templates', async (req, res) => {
  try {
    const templates = await getMessageTemplates();
    res.json({
      welcome: templates.welcome,
      feedback: templates.feedback,
      reminder: templates.reminder
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar templates' });
  }
});

app.put('/api/whatsapp/templates', async (req, res) => {
  try {
    const { welcome, feedback, reminder } = req.body || {};
    const templates = await getMessageTemplates();
    if (typeof welcome === 'string') templates.welcome = welcome;
    if (typeof feedback === 'string') templates.feedback = feedback;
    if (typeof reminder === 'string') templates.reminder = reminder;
    await templates.save();
    res.json({
      welcome: templates.welcome,
      feedback: templates.feedback,
      reminder: templates.reminder
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao salvar templates' });
  }
});

// Enviar Mensagem de Bem-Vindo
app.post('/api/whatsapp/send-welcome', async (req, res) => {
  const { userId } = req.body;
  try {
    await ensureInstance();
    const instance = await getInstanceByName();
    const connectionState = mapConnectionStatus(instance?.connectionStatus);
    if (connectionState !== 'open') {
      return res.status(409).json({ message: 'WhatsApp não está conectado. Conecte a instância antes de enviar mensagens.' });
    }

    const user = await User.findById(userId);
    if (!user || !user.phone) {
      return res.status(400).json({ message: 'Usuário não encontrado ou sem WhatsApp' });
    }

    const recipientNumber = ensureSendableNumber(user.phone);
    const systemUrl = getSystemUrl();

    const templates = await getMessageTemplates();
    const message = renderTemplate(templates.welcome, {
      name: user.name,
      username: user.username,
      systemUrl
    });

    await sendWhatsAppText(recipientNumber, message, { delay: 1200, presence: 'composing', linkPreview: false });

    res.json({ message: 'Mensagem de boas-vindas enviada!' });
  } catch (error) {
    console.error('❌ Erro ao enviar boas-vindas:', error);
    if (error?.status) {
      return res.status(500).json({ message: 'Falha na Evolution API ao enviar mensagem.', details: error.data || error.message });
    }
    res.status(500).json({ message: error.message || 'Erro ao enviar mensagem via WhatsApp' });
  }
});

// Lembrete de Reunião - Agendado para toda Sexta-feira às 10:00
cron.schedule('0 10 * * 5', async () => {
  console.log('⏰ Iniciando envio de lembretes de reunião...');
  try {
    const users = await User.find({ phone: { $exists: true, $ne: '' } });
    const systemUrl = getSystemUrl();
    const templates = await getMessageTemplates();
    const message = renderTemplate(templates.reminder, {
      systemUrl,
      meetingTime: '11:00'
    });

    for (const user of users) {
      try {
        const recipientNumber = ensureSendableNumber(user.phone);
        await sendWhatsAppText(recipientNumber, message, { delay: 500, presence: 'composing', linkPreview: false });
        console.log(`✅ Lembrete enviado para: ${user.name}`);
      } catch (err) {
        console.error(`❌ Erro ao enviar lembrete para ${user.name}:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ Erro no agendamento de lembretes:', error);
  }
});

// Enviar notificação de feedback via WhatsApp
const sendWhatsAppFeedback = async (receiver, feedback) => {
  if (!receiver.phone) return;
  
  try {
    const recipientNumber = ensureSendableNumber(receiver.phone);
    const systemUrl = getSystemUrl();
    const templates = await getMessageTemplates();
    const message = renderTemplate(templates.feedback, {
      name: receiver.name,
      type: feedback.type,
      content: feedback.content,
      systemUrl
    });

    await sendWhatsAppText(recipientNumber, message, { delay: 1200, presence: 'composing', linkPreview: false });
    console.log(`📱 Notificação WhatsApp enviada para: ${receiver.name}`);
  } catch (error) {
    console.error('❌ Falha ao enviar WhatsApp:', error);
  }
};

// Create initial supervisors if they don't exist
const createInitialSupervisors = async () => {
  try {
    const supervisorsToCreate = [
      {
        name: 'Deyvison (Suporte)',
        username: 'deyvison@intelite.com',
        role: 'supervisor',
        sector: 'Suporte',
        password: 'dev18021992'
      },
      {
        name: 'Hemelly (Comercial)',
        username: 'hemelly@intelite.com',
        role: 'supervisor',
        sector: 'Comercial',
        password: 'hemelly123'
      },
      {
        name: 'Leticia (RH)',
        username: 'leticia@intelite.com',
        role: 'supervisor',
        sector: 'RH',
        password: 'leticia123'
      }
    ];

    for (const s of supervisorsToCreate) {
      const exists = await User.findOne({ username: s.username });
      if (!exists) {
        await User.create(s);
        console.log(`👤 Supervisor criado: ${s.name} (${s.username})`);
      } else {
        // Garantir que o cargo e o setor estejam corretos se já existir
        let updated = false;
        if (exists.role !== 'supervisor') {
          exists.role = 'supervisor';
          updated = true;
        }
        if (exists.sector !== s.sector) {
          exists.sector = s.sector;
          updated = true;
        }
        
        // Se a senha não for um hash, criptografar (para compatibilidade)
        if (!exists.password.startsWith('$2')) {
          exists.password = s.password;
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

// Handle SPA routing: serve index.html for all non-API routes
app.get('/api/avatar', async (req, res) => {
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

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    res.status(400).json({ message: 'Protocolo não suportado' });
    return;
  }

  const hostname = targetUrl.hostname.toLowerCase();
  const isPrivateIp = (host) => {
    const parts = host.split('.').map(n => Number(n));
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  };

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || isPrivateIp(hostname)) {
    res.status(400).json({ message: 'Host não permitido' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'FeedbackApp/1.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': `${targetUrl.origin}/`,
        'Origin': targetUrl.origin
      }
    });

    if (!response.ok) {
      res.status(502).json({ message: 'Falha ao buscar imagem' });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    const isImageLike =
      contentType.startsWith('image/') ||
      contentType === '' ||
      contentType.startsWith('application/octet-stream');
    if (!isImageLike) {
      res.status(415).json({ message: 'Conteúdo não é uma imagem' });
      return;
    }

    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const MAX_BYTES = 5 * 1024 * 1024;
    let total = 0;

    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          res.status(413).end();
          return;
        }
        res.write(Buffer.from(value));
      }
      res.end();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      res.status(413).end();
      return;
    }
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    res.status(502).json({ message: 'Erro ao carregar imagem' });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('*all', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`🚀 Backend rodando em:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Rede:    http://${localIP}:${PORT}`);
});
