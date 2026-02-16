import { useMemo, useState } from 'react';
import './App.css';

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const canAnalyze = useMemo(() => !!file && !loading, [file, loading]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const base64 = preview.split(',')[1];
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/png' }),
      });
      const data = await resp.json();
      if (data.title) {
        setResult(data);
      } else {
        setError('분석 결과를 받지 못했어요. 다시 시도해 주세요.');
      }
    } catch (e) {
      setError('분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const display = result;

  return (
    <div className="container">
      <header>
        <h1>Heritage Intro</h1>
        <p>문화재 사진을 올리면 역사적 배경과 가치 설명을 제공합니다.</p>
      </header>

      <section className="card">
        <div className="upload">
          <input type="file" accept="image/*" onChange={handleFile} />
          {preview && <img className="preview" src={preview} alt="preview" />}
        </div>
        <button disabled={!canAnalyze} onClick={analyze}>
          {loading ? '분석 중...' : '사진 분석하기'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {display && (
        <section className="card">
          <h2>{display.title}</h2>
          <div className="meta">
            <span>시대: {display.era}</span>
            <span>위치: {display.location}</span>
          </div>
          <p className="desc">{display.description}</p>
          {display.keyPoints?.length > 0 && (
            <>
              <h3>핵심 포인트</h3>
              <ul>
                {display.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </>
          )}
          {display.culturalSignificance && (
            <p className="significance">{display.culturalSignificance}</p>
          )}
          {display.disclaimer && (
            <p className="disclaimer">{display.disclaimer}</p>
          )}
        </section>
      )}

      <footer>
        <small>© 2026 Heritage Intro — 비공식 참고용</small>
      </footer>
    </div>
  );
}
