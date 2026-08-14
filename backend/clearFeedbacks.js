const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function clearFeedbacks() {
  if (process.argv[2] !== '--yes') {
    console.error('Este script apaga TODOS os feedbacks. Execute com: node clearFeedbacks.js --yes');
    process.exit(1);
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI não definido');
    }
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado!');

    const feedbackSchema = new mongoose.Schema({});
    const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);

    console.log('🗑️ Apagando todos os feedbacks...');
    const result = await Feedback.deleteMany({});
    console.log(`✨ Sucesso! ${result.deletedCount} feedbacks foram removidos.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao limpar feedbacks:', error);
    process.exit(1);
  }
}

clearFeedbacks();
