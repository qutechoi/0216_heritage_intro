export async function onRequestPost(context) {
  const { imageBase64, mimeType } = await context.request.json();
  const apiKey = context.env.GEMINI_API_KEY;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `이 이미지에 나오는 문화재나 유적지를 분석해주세요. 다음 JSON 형식으로만 응답해주세요:
{
  "title": "문화재 이름 (한글 및 영문)",
  "period": "시대 (예: 백제시대, 조선시대)",
  "location": "위치",
  "description": "간단한 설명 (2-3문장)",
  "keyPoints": ["특징1", "특징2", "특징3"],
  "culturalSignificance": "문화적 의의"
}
JSON만 반환하고 다른 텍스트는 포함하지 마세요.`,
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          period: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          culturalSignificance: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('JSON 파싱 실패:', err);
    parsed = { title: "파싱 오류", description: "응답을 처리할 수 없습니다.", raw: text };
  }

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json' },
  });
}
