const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_NUMBER = '5591991815479';

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'marketing-diagnostico' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', qr => {
  console.log('QR code recebido. Use este código para autenticar o WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp client pronto.');
});

client.on('authenticated', () => {
  console.log('WhatsApp autenticado com sucesso.');
});

client.on('auth_failure', msg => {
  console.error('Falha na autenticação do WhatsApp:', msg);
});

client.on('disconnected', () => {
  console.log('WhatsApp desconectado. Reiniciando...');
  client.initialize();
});

function buildPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.font('Helvetica');
    doc.fontSize(20).fillColor('#0f1f3d').text('DIAGNÓSTICO DE MARKETING DIGITAL', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#333').text(`Data: ${payload.date} às ${payload.time}`);
    doc.moveDown();

    const renderSection = (title, rows) => {
      doc.fontSize(14).fillColor('#0f1f3d').text(title);
      doc.moveDown(0.3);
      rows.forEach(row => {
        doc.fontSize(12).fillColor('#000').text(`${row.label} `, { continued: true, underline: false });
        doc.font('Helvetica').text(row.value || '—');
        doc.moveDown(0.2);
      });
      doc.moveDown();
    };

    renderSection('BLOCO 1 — ESTRUTURA COMERCIAL', [
      { label: 'Produtos principais:', value: payload.answers.q1 },
      { label: 'Ticket médio:', value: payload.answers.q2 },
      { label: 'Público-alvo:', value: payload.answers.q3 },
      { label: 'Concorrentes:', value: payload.answers.q4 },
      { label: 'Meta 3 meses:', value: payload.answers.q5 }
    ]);

    renderSection('BLOCO 2 — INFRAESTRUTURA', [
      { label: 'Site/domínio:', value: payload.answers.q6 },
      { label: 'Atendimento online:', value: payload.answers.q7 },
      { label: 'Gestão de postagens:', value: payload.answers.q8 },
      { label: 'Frequência:', value: payload.answers.q8_freq || '—' },
      { label: 'Capacidade de atendimento:', value: payload.answers.q9 },
      { label: 'Cadastro de clientes:', value: payload.answers.q10 }
    ]);

    renderSection('BLOCO 3 — CANAIS E INVESTIMENTO', [
      { label: 'Histórico de anúncios:', value: payload.answers.q11 },
      { label: 'Google Meu Negócio:', value: payload.answers.q12 },
      { label: 'Meta Ads:', value: payload.answers.q13 },
      { label: 'Material visual:', value: payload.answers.q14 },
      { label: 'Orçamento para anúncios:', value: payload.answers.q15 }
    ]);

    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text('Formulário Preliminar de Marketing Digital — Eng. Luis Mota', {
      align: 'center'
    });
    doc.text(`WhatsApp: +55 91 99181-5479`, { align: 'center' });

    doc.end();
  });
}

app.post('/api/send-diagnostico', async (req, res) => {
  if (!client.info || !client.info.wid) {
    return res.status(503).json({ error: 'WhatsApp ainda não está conectado. Aguarde a autenticação.' });
  }

  try {
    const payload = req.body;
    const pdfBuffer = await buildPdfBuffer(payload);
    const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), `diagnostico_marketing_${payload.date.replace(/\//g, '-')}.pdf`);

    await client.sendMessage(`${WHATSAPP_NUMBER}@c.us`, media, {
      caption: `📋 Relatório em PDF enviado.\nData: ${payload.date} às ${payload.time}`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar diagnóstico:', error);
    res.status(500).json({ error: error.message || 'Erro ao enviar diagnóstico.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});

// Inicializa o cliente WhatsApp — exibe QR code no terminal na primeira vez
client.initialize();
