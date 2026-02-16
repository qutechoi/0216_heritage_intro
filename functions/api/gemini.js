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
  "era": "시대 (예: 백제시대, 조선시대)",
  "location": "위치",
  "description": "간단한 설명 (2-3문장)",
  "keyPoints": ["특징1", "특징2", "특징3"],
  "culturalSignificance": "문화적 의의",
  "disclaimer": "이 정보는 참고용이며, 정확한 정보는 문화재청을 확인하세요."
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
          era: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          culturalSignificance: { type: "string" },
          disclaimer: { type: "string" },
        },
        required: ["title", "description", "era", "location"],
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
  let rawText = text;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('JSON 파싱 실패:', err, '\n원문:', text);
    parsed = {
      title: "파싱 오류",
      description: "응답을 처리할 수 없습니다.",
      era: "알 수 없음",
      location: "알 수 없음",
      keyPoints: [],
      disclaimer: "오류가 발생했습니다.",
    };
  }

  // 디버깅용으로 항상 raw 포함
  parsed.raw = rawText;

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json' },
  });
}
