import { useMemo, useState } from 'react';
import './App.css';

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | identifying | candidates | detailing | result
  const [candidates, setCandidates] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const canAnalyze = useMemo(() => !!file && phase === 'idle', [file, phase]);
  const isLoading = phase === 'identifying' || phase === 'detailing';

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setCandidates([]);
    setError('');
    setPhase('idle');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const fetchDetail = async (candidate) => {
    setPhase('detailing');
    setError('');
    try {
      const resp = await fetch('/api/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: candidate.name, nameEn: candidate.nameEn }),
      });
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
        setPhase('candidates');
        return;
      }
      if (data.title) {
        setResult(data);
        setPhase('result');
      } else {
        setError('상세 정보를 받지 못했어요. 다시 시도해 주세요.');
        setPhase('candidates');
      }
    } catch {
      setError('상세 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');
      setPhase('candidates');
    }
  };

  const analyze = async () => {
    if (!file) return;
    setPhase('identifying');
    setError('');
    setResult(null);
    setCandidates([]);
    try {
      const base64 = preview.split(',')[1];
      const resp = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/png' }),
      });
      const data = await resp.json();

      if (data.error) {
        setError(data.error);
        setPhase('idle');
        return;
      }

      if (!data.candidates?.length) {
        setError('문화재를 식별하지 못했어요. 다른 사진으로 시도해 주세요.');
        setPhase('idle');
        return;
      }

      if (data.confident && data.candidates.length === 1) {
        // 확신도 높음 → 바로 상세 조회
        await fetchDetail(data.candidates[0]);
      } else {
        // 확신도 낮음 → 후보 선택
        setCandidates(data.candidates);
        setPhase('candidates');
      }
    } catch {
      setError('분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setPhase('idle');
    }
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setCandidates([]);
    setError('');
  };

  const phaseLabel = {
    identifying: '이미지 분석 중...',
    detailing: '인터넷에서 검증 중...',
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
          {isLoading ? phaseLabel[phase] : '분석하기'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {/* 후보 선택 UI */}
      {phase === 'candidates' && candidates.length > 0 && (
        <section className="candidates-section">
          <h2 className="candidates-title">어떤 문화재일까요?</h2>
          <p className="candidates-subtitle">AI가 식별한 후보입니다. 하나를 선택해 주세요.</p>
          <div className="candidates-grid">
            {candidates.map((c, i) => (
              <button
                key={i}
                className="candidate-card"
                onClick={() => fetchDetail(c)}
              >
                <div className="candidate-name">{c.name}</div>
                <div className="candidate-name-en">{c.nameEn}</div>
                <div className="candidate-meta">
                  <span>{c.era}</span>
                  <span>{c.location}</span>
                </div>
                <p className="candidate-brief">{c.brief}</p>
                <div className="candidate-confidence">
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${Math.round(c.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="confidence-label">
                    확신도 {Math.round(c.confidence * 100)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 로딩 표시 */}
      {phase === 'detailing' && (
        <section className="loading-section">
          <div className="loading-spinner" />
          <p className="loading-text">인터넷에서 정확한 정보를 검증하고 있습니다...</p>
        </section>
      )}

      {/* 결과 */}
      {phase === 'result' && result && (
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

          <button className="reset-btn" onClick={reset}>
            다른 문화재 분석하기
          </button>
        </section>
      )}

      <footer>
        <small>&copy; 2026 Heritage Intro &mdash; 비공식 참고용</small>
      </footer>
    </div>
  );
}
