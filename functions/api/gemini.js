export async function onRequestPost(context) {
  const { imageBase64, mimeType } = await context.request.json();
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({
      title: "설정 오류",
      description: "GEMINI_API_KEY가 설정되지 않았습니다.",
      era: "-", location: "-", keyPoints: [],
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `이 이미지에 나오는 문화재나 유적지를 분석해주세요. 반드시 아래 JSON 형식으로만 응답하세요.

{
  "title": "문화재 이름 (한글 및 영문)",
  "era": "시대 (예: 백제시대, 조선시대)",
  "location": "위치",
  "description": "간단한 설명 (2-3문장)",
  "keyPoints": ["특징1", "특징2", "특징3"],
  "culturalSignificance": "문화적 의의",
  "disclaimer": "이 정보는 AI가 생성한 참고용이며, 정확한 정보는 문화재청을 확인하세요."
}`,
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

  // 안정적인 모델 우선, 실패 시 폴백
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      // API 에러 체크
      if (data.error) {
        console.error(`[${model}] API 에러:`, JSON.stringify(data.error));
        continue; // 다음 모델 시도
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error(`[${model}] 빈 응답. 전체 데이터:`, JSON.stringify(data).slice(0, 500));
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        // JSON 파싱 실패 — 텍스트에서 JSON 추출 시도
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
          try {
            parsed = JSON.parse(text.slice(start, end + 1));
          } catch {
            parsed = null;
          }
        }
      }

      if (parsed && parsed.title) {
        return new Response(JSON.stringify(parsed), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 파싱은 됐지만 title이 없는 경우
      return new Response(JSON.stringify({
        title: "분석 결과",
        description: text,
        era: "-",
        location: "-",
        keyPoints: [],
        raw: text,
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
      console.error(`[${model}] fetch 에러:`, err.message);
      continue;
    }
  }

  // 모든 모델 실패
  return new Response(JSON.stringify({
    title: "분석 실패",
    description: "Gemini API에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    era: "-",
    location: "-",
    keyPoints: [],
  }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
