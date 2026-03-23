const mongoose = require('mongoose');
require('dotenv').config();

async function clearFeedbacks() {
  try {
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