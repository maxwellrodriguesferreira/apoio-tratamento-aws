interface GeminiRequest {
  action: 'generateSingle' | 'generateBatch' | 'testConnection';
  payload?: {
    nome?: string;
    medicamento?: string;
    drogaria?: string;
    farmaceutico?: string;
    observacao?: string;
    items?: Array<{
      id?: string | number;
      nome: string;
      medicamento: string;
      telefone?: string;
      observacao?: string;
    }>;
  };
  model?: string;
}

interface GeminiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const handler = async (event: GeminiRequest): Promise<GeminiResponse> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'GEMINI_API_KEY_PLACEHOLDER') {
    return {
      success: false,
      error: 'A chave GEMINI_API_KEY não foi configurada no AWS Secrets Manager.',
    };
  }

  const model = event.model || process.env.DEFAULT_MODEL || 'gemini-3.8-flash';
  const action = event.action;

  try {
    if (action === 'testConnection') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Falha na conexão com Google Gemini (${res.status}): ${errText}` };
      }

      return { success: true, data: { status: 'connected', model } };
    }

    if (action === 'generateSingle') {
      const { nome = '', medicamento = '', drogaria = 'Drogasil Mogilar', farmaceutico = 'Farmacêutico', observacao = '' } = event.payload || {};

      const prompt = `Você é um assistente farmacêutico de elite da rede ${drogaria}.
Gere 4 versões de mensagens de acompanhamento farmacêutico pelo WhatsApp para o cliente "${nome}", referente ao medicamento/serviço "${medicamento}".
Farmacêutico responsável: ${farmaceutico}.
Observação clínica / contexto: ${observacao || 'Uso regular conforme posologia médica'}.

Retorne ESTRITAMENTE um objeto JSON válido com as seguintes 4 chaves:
- "empatico": mensagem focada em acolhimento, cuidado e bem-estar.
- "atencioso": mensagem com foco clínico, posologia correta e prevenção de efeitos adversos.
- "descontraido": mensagem leve, rápida e amigável.
- "pos_tratamento": mensagem para acompanhamento após o término do tratamento ou procedimento.

Não inclua marcações markdown adicionais fora do JSON.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.text();
        return { success: false, error: `Erro na API do Gemini: ${errData}` };
      }

      const jsonResult = await res.json();
      const rawText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText);

      return { success: true, data: parsed };
    }

    if (action === 'generateBatch') {
      const items = event.payload?.items || [];
      if (!items.length) {
        return { success: false, error: 'Lista de itens em lote está vazia.' };
      }

      const prompt = `Você é um assistente farmacêutico de alta precisão.
Gere mensagens personalizadas e individualizadas para cada um dos seguintes atendimentos:
${JSON.stringify(items, null, 2)}

Retorne ESTRITAMENTE um array JSON contendo objetos no formato:
[
  {
    "id": 1,
    "mensagem": "Texto personalizado e acolhedor para WhatsApp..."
  }
]`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.text();
        return { success: false, error: `Erro na API do Gemini: ${errData}` };
      }

      const jsonResult = await res.json();
      const rawText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const parsed = JSON.parse(rawText);

      return { success: true, data: parsed };
    }

    return { success: false, error: `Ação não suportada: ${action}` };
  } catch (err: any) {
    console.error('Erro na função gemini-service:', err);
    return { success: false, error: err.message || 'Erro interno no processamento com a IA.' };
  }
};
