# Heritage Intro

문화재 사진을 업로드하면 역사적 배경과 가치 설명을 제공하는 웹앱.

## 실행
```bash
npm install
npm run dev
```

## Cloudflare Pages Functions
- `functions/api/gemini.js`
- 클라이언트는 `/api/gemini` 호출

## 환경변수
Cloudflare Pages → Settings → Environment Variables
```
GEMINI_API_KEY=YOUR_KEY
```
