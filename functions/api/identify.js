export async function onRequestPost(context) {
  const { imageBase64, mimeType } = await context.request.json();
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
  }

  const prompt = `이 이미지에 나오는 문화재나 유적지를 식별해주세요.

확신도(confidence)를 0~1 사이로 평가하세요.
- 확신도가 0.8 이상이면 confident: true, 후보 1개만 반환
- 확신도가 0.8 미만이면 confident: false, 가능성 있는 후보 2개 반환

각 후보에 대해:
- name: 한글 이름
- nameEn: 영문 이름
- era: 시대
- location: 위치
- brief: 왜 이 문화재라고 판단했는지 간단한 근거 (1문장)
- confidence: 0~1 사이 확신도`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.3,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          confident: { type: "boolean" },
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                nameEn: { type: "string" },
                era: { type: "string" },
                location: { type: "string" },
                brief: { type: "string" },
                confidence: { type: "number" },
              },
              required: ["name", "nameEn", "era", "location", "brief", "confidence"],
            },
          },
        },
        required: ["confident", "candidates"],
      },
    },
  };

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) {
        console.error(`[identify][${model}] API error:`, JSON.stringify(data.error));
        continue;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`[identify][${model}] Empty response`);
        continue;
      }

      const parsed = extractJson(text);
      if (parsed && parsed.candidates?.length > 0) {
        return jsonResponse(parsed);
      }

      console.error(`[identify][${model}] Invalid structure`);
      continue;
    } catch (err) {
      console.error(`[identify][${model}] Fetch error:`, err.message);
      continue;
    }
  }

  return jsonResponse({ error: "문화재를 식별할 수 없습니다. 다시 시도해 주세요." }, 502);
}

function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) { try { return JSON.parse(codeBlock[1].trim()); } catch {} }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
