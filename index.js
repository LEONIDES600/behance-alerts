require('dotenv').config();

const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;

const bot = new TelegramBot(TOKEN, { polling: false });

const KEYWORDS = [
  'ai', 'social media', 'creative designer', 'branding', 'motion',
  'content creator', 'advertising', 'ecommerce', 'amazon',
  'product images', 'product video', 'short videos', 'reels',
  'tiktok', 'instagram', 'youtube shorts', 'video ads'
];

const seen = new Set();

async function generateProposal(job) {
  const prompt = `
Actúa como experto en propuestas freelance para Behance.

Crea una propuesta ganadora para Leo Gomez Silva.

Perfil:
Founder & Creative Designer at Leo Visual
Portfolio: https://leovisual.nl/
Behance: https://www.behance.net/leostudiocreative
Instagram: https://instagram.com/leovisual.nl

Especialidades:
AI Creative Design, Social Media Design, Amazon product images, ecommerce creatives, product videos, reels, TikTok videos, branding, advertising visuals.

Oferta:
Título: ${job.title}
Link: ${job.url}
Keywords: ${job.matches.join(', ')}

Entrega:
1. Descripción del trabajo
2. Mensaje personal al cliente
3. Precio recomendado
4. Versión corta para aplicar rápido

Tono: profesional, creativo, directo, premium y personalizado.
`;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );

  return response.data.content[0].text;
}

async function sendAlert(job) {
  const proposal = await generateProposal(job);

  const text = `
🚨 NUEVA OFERTA DETECTADA

Título:
${job.title}

Link:
${job.url}

Keywords:
${job.matches.join(', ')}

PROPUESTA CLAUDE:
${proposal}
`;

  await bot.sendMessage(CHAT_ID, text);
}

async function checkBehance() {
  console.log('Buscando ofertas en Behance...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.behance.net/joblist', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({
          title: a.innerText.trim(),
          url: a.href
        }))
        .filter(item => item.title.length > 8 && item.url.includes('behance.net'));
    });

    for (const job of jobs) {
      const text = `${job.title} ${job.url}`.toLowerCase();
      const matches = KEYWORDS.filter(k => text.includes(k.toLowerCase()));

      if (matches.length > 0 && !seen.has(job.url)) {
        seen.add(job.url);
        await sendAlert({ ...job, matches });
      }
    }

    console.log(`Revisión completa. Ofertas encontradas: ${jobs.length}`);
  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

checkBehance();
setInterval(checkBehance, 30000);
