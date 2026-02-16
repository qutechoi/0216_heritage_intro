export async function onRequestPost(context) {
  const { imageBase64, mimeType } = await context.request.json();
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse({
      title: "설정 오류",
      description: "GEMINI_API_KEY가 설정되지 않았습니다.",
    }, 500);
  }

  const prompt = `이 이미지에 나오는 문화재나 유적지를 분석해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "title": "문화재 이름 (한글 및 영문)",
  "era": "시대",
  "location": "위치",
  "description": "역사적 배경과 의의를 포함한 상세한 설명 (4-6문장)",
  "keyPoints": ["핵심 특징 1", "핵심 특징 2", "핵심 특징 3"],
  "culturalSignificance": "문화적·역사적 가치 설명 (2-3문장)",
  "designation": "문화재 지정 정보 (예: 국보 제9호)",
  "disclaimer": "이 정보는 AI가 생성한 참고용이며, 정확한 정보는 문화재청을 확인하세요."
}

주의사항:
- keyPoints는 반드시 3~5개만 작성하세요.
- 각 keyPoints 항목은 핵심 특징만 간결하게 작성하세요.`;

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
          title: { type: "string" },
          era: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" }, maxItems: 5 },
          culturalSignificance: { type: "string" },
          designation: { type: "string" },
          disclaimer: { type: "string" },
        },
        required: ["title", "description", "era", "location"],
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
        console.error(`[${model}] API error:`, JSON.stringify(data.error));
        continue;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`[${model}] Empty response:`, JSON.stringify(data).slice(0, 500));
        continue;
      }

      const parsed = extractJson(text);
      if (parsed && parsed.title) {
        // keyPoints가 5개 초과면 잘라냄
        if (parsed.keyPoints && parsed.keyPoints.length > 5) {
          parsed.keyPoints = parsed.keyPoints.slice(0, 5);
        }
        return jsonResponse(parsed);
      }

      // JSON 파싱은 실패했지만 텍스트는 있는 경우
      return jsonResponse({
        title: "분석 결과",
        description: text.slice(0, 500),
        era: "-",
        location: "-",
        keyPoints: [],
      });

    } catch (err) {
      console.error(`[${model}] Fetch error:`, err.message);
      continue;
    }
  }

  return jsonResponse({
    title: "분석 실패",
    description: "Gemini API에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    era: "-",
    location: "-",
    keyPoints: [],
  }, 502);
}

function extractJson(text) {
  // 직접 파싱 시도
  try {
    return JSON.parse(text);
  } catch {}

  // 마크다운 코드블록 안의 JSON 추출
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch {}
  }

  // 중괄호로 감싸진 JSON 추출
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
