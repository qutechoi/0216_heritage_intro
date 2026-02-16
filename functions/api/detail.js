export async function onRequestPost(context) {
  const { name, nameEn } = await context.request.json();
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
  }

  if (!name) {
    return jsonResponse({ error: "문화재 이름이 필요합니다." }, 400);
  }

  const prompt = `"${name}" (${nameEn || name})에 대해 인터넷에서 검색하여 정확한 정보를 조사한 뒤, 아래 JSON 형식으로 응답하세요.

반드시 검색 결과를 기반으로 사실에 근거한 정보만 작성하세요.

{
  "title": "문화재 이름 (한글 및 영문)",
  "era": "시대 (구체적인 연도 포함)",
  "location": "위치 (시/도, 구/군 포함)",
  "description": "역사적 배경과 의의를 포함한 상세한 설명 (4-6문장, 검색 결과 기반)",
  "keyPoints": ["핵심 특징 1", "핵심 특징 2", "핵심 특징 3"],
  "culturalSignificance": "문화적·역사적 가치 설명 (2-3문장)",
  "designation": "문화재 지정 정보 (예: 국보 제9호)",
  "disclaimer": "이 정보는 AI가 인터넷 검색을 기반으로 생성한 참고용이며, 정확한 정보는 문화재청을 확인하세요."
}

주의사항:
- keyPoints는 반드시 3~5개만 작성하세요.
- 검색에서 확인되지 않은 정보는 추측하지 말고 "확인 필요"로 표기하세요.
- JSON만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

  // google_search 도구와 responseMimeType은 동시 사용 불가 → 텍스트에서 JSON 추출
  const payload = {
    contents: [{
      parts: [{ text: prompt }],
    }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[detail] API error:", JSON.stringify(data.error));
      return jsonResponse({ error: "상세 정보를 가져올 수 없습니다." }, 502);
    }

    // google_search 사용 시 여러 parts가 올 수 있음 — 텍스트 파트만 합침
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter(p => p.text).map(p => p.text);
    const fullText = textParts.join("\n");

    if (!fullText) {
      console.error("[detail] Empty response:", JSON.stringify(data).slice(0, 500));
      return jsonResponse({ error: "응답이 비어 있습니다." }, 502);
    }

    const parsed = extractJson(fullText);
    if (parsed && parsed.title) {
      if (parsed.keyPoints && parsed.keyPoints.length > 5) {
        parsed.keyPoints = parsed.keyPoints.slice(0, 5);
      }
      return jsonResponse(parsed);
    }

    // JSON 파싱 실패 시 텍스트로 폴백
    return jsonResponse({
      title: name,
      description: fullText.slice(0, 800),
      era: "-",
      location: "-",
      keyPoints: [],
      disclaimer: "AI가 생성한 참고용 정보입니다.",
    });
  } catch (err) {
    console.error("[detail] Fetch error:", err.message);
    return jsonResponse({ error: "상세 정보를 가져올 수 없습니다." }, 502);
  }
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
