const PDFDocument = require('pdfkit');

// Configuração da Z-API — preencha com seus dados do painel em https://app.z-api.io
// Adicione essas variáveis de ambiente no painel da Vercel (Settings > Environment Variables)
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;   // Ex: "3ABC123"
const ZAPI_TOKEN    = process.env.ZAPI_TOKEN;       // Token do painel Z-API
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN; // Client-Token do painel Z-API
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5591991815479';

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
        doc.fontSize(11).fillColor('#000').text(`${row.label} `, { continued: true });
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
    doc.fontSize(10).fillColor('#555').text('Formulário Preliminar de Marketing Digital — Eng. Luis Mota', { align: 'center' });
    doc.text(`WhatsApp: +55 91 99181-5479`, { align: 'center' });

    doc.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verifica configuração
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    return res.status(503).json({
      error: 'Serviço de WhatsApp não configurado. Adicione as variáveis de ambiente ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN no painel da Vercel.'
    });
  }

  try {
    const payload = req.body;
    const pdfBuffer = await buildPdfBuffer(payload);
    const pdfBase64 = pdfBuffer.toString('base64');
    const fileName = `diagnostico_marketing_${payload.date.replace(/\//g, '-')}.pdf`;

    // Envia o PDF via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-document/pdf`;

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      body: JSON.stringify({
        phone: WHATSAPP_NUMBER,
        document: `data:application/pdf;base64,${pdfBase64}`,
        fileName: fileName,
        caption: `📋 Diagnóstico de Marketing Digital\n📅 Data: ${payload.date} às ${payload.time}`
      })
    });

    if (!zapiResponse.ok) {
      const errText = await zapiResponse.text();
      throw new Error(`Z-API retornou erro: ${errText}`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao enviar diagnóstico:', error);
    res.status(500).json({ error: error.message || 'Erro ao enviar diagnóstico.' });
  }
};
