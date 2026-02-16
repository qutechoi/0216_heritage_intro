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
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
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

  return (
    <div className="container">
      <header>
        <h1>Heritage Intro</h1>
        <p>문화재 사진을 올리면 역사적 배경과 가치를 알려드립니다.</p>
      </header>

      <section className="card upload-card">
        <div className="upload">
          <label className="file-label">
            사진 선택
            <input type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
          {file && <span className="file-name">{file.name}</span>}
        </div>
        {preview && <img className="preview" src={preview} alt="preview" />}
        <button disabled={!canAnalyze} onClick={analyze}>
          {loading ? '분석 중...' : '분석하기'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="report">
          <div className="report-header">
            <h2 className="report-title">{result.title}</h2>
            {result.designation && (
              <span className="badge">{result.designation}</span>
            )}
          </div>

          <div className="report-meta">
            <div className="meta-item">
              <span className="meta-label">시대</span>
              <span className="meta-value">{result.era}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">위치</span>
              <span className="meta-value">{result.location}</span>
            </div>
          </div>

          <div className="report-section">
            <h3>개요</h3>
            <p>{result.description}</p>
          </div>

          {result.keyPoints?.length > 0 && (
            <div className="report-section">
              <h3>주요 특징</h3>
              <ul className="key-points">
                {result.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {result.culturalSignificance && (
            <div className="report-section">
              <h3>문화적 가치</h3>
              <p>{result.culturalSignificance}</p>
            </div>
          )}

          {result.disclaimer && (
            <p className="disclaimer">{result.disclaimer}</p>
          )}
        </section>
      )}

      <footer>
        <small>&copy; 2026 Heritage Intro &mdash; 비공식 참고용</small>
      </footer>
    </div>
  );
}
