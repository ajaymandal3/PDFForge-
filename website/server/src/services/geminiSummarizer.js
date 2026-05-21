const { extractPdfText } = require('./pdfToolkit');

const MAX_INPUT_CHARS = 120000;
const DEFAULT_MODEL = 'gemini-2.0-flash';

const STYLE_PROMPTS = {
  brief: 'Write a concise summary in 2–4 short paragraphs.',
  detailed: 'Write a thorough summary covering main topics, arguments, and conclusions.',
  bullets: 'Summarize as clear bullet points grouped by topic.',
};

function getApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key?.trim()) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file in the project root.');
  }
  return key.trim();
}

function truncateText(text, maxChars = MAX_INPUT_CHARS) {
  if (!text || text.length <= maxChars) {
    return { text: text || '', truncated: false };
  }
  return {
    text: `${text.slice(0, maxChars)}\n\n[Document truncated for API limits — earlier content prioritized.]`,
    truncated: true,
  };
}

async function callGemini(prompt) {
  const apiKey = getApiKey();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || `Gemini API error (${response.status})`;
    throw new Error(message);
  }

  const summary = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();

  if (!summary) {
    throw new Error('Gemini returned an empty summary. The PDF may have little or no extractable text.');
  }

  return { summary, model };
}

async function summarizePdf(filePath, options = {}) {
  const rawText = await extractPdfText(filePath);
  const cleaned = rawText.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    throw new Error('No readable text found in this PDF. Scanned image-only PDFs are not supported yet.');
  }

  const { text, truncated } = truncateText(cleaned);
  const style = STYLE_PROMPTS[options.style] || STYLE_PROMPTS.brief;
  const focus = options.focus?.trim();

  const prompt = [
    'You are an expert document analyst. Summarize the following PDF text for a busy reader.',
    style,
    focus ? `Focus especially on: ${focus}` : '',
    'Use the same language as the document when possible.',
    '',
    '--- PDF TEXT ---',
    text,
    '--- END ---',
  ]
    .filter(Boolean)
    .join('\n');

  const { summary, model } = await callGemini(prompt);

  return {
    summary,
    model,
    characterCount: cleaned.length,
    truncated,
    style: options.style || 'brief',
  };
}

module.exports = {
  summarizePdf,
};
