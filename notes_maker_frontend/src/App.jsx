import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'


const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  { code: 'od', name: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
]

// UI translations for each language
const UI_TEXT = {
  en: {
    title: 'Shantanu', online: 'Online',
    dropText: 'Hi please upload your data!', browse: 'browse',
    dropHint: 'Supports PDF, PPTX, PNG, JPG',
    addMore: '+ Add more',
    modeLabel: 'What type of notes do you want?',
    modes: [
      { value: 'detailed', label: 'Detailed Notes', desc: 'Full explanations, examples & definitions', emoji: '📖' },
      { value: 'important', label: 'MCQ Pointer Notes', desc: 'Bullet points for quick revision & MCQs', emoji: '🎯' },
      { value: 'mixed', label: 'Mixed', desc: 'Best of both — explanations + key points', emoji: '⚡' },
    ],
    langLabel: 'Notes Language',
    generateBtn: '✨ Generate Notes',
    generating: 'Generating notes...',
    readyTitle: 'Your Notes are Ready! 🎉',
    downloadPdf: '⬇ Download PDF',
    listenAudio: '🔊 Listen',
    noText: 'No text could be extracted from this file.',
    footer: 'Powered by Groq & Sarvam AI',
  },
  hi: {
    title: 'शंतनु', online: 'ऑनलाइन',
    dropText: 'फ़ाइलें यहाँ छोड़ें या', browse: 'ब्राउज़ करें',
    dropHint: 'PDF, PPTX, PNG, JPG समर्थित',
    addMore: '+ और जोड़ें',
    modeLabel: 'आप किस प्रकार के नोट्स चाहते हैं?',
    modes: [
      { value: 'detailed', label: 'विस्तृत नोट्स', desc: 'पूर्ण व्याख्या, उदाहरण और परिभाषाएं', emoji: '📖' },
      { value: 'important', label: 'MCQ पॉइंटर नोट्स', desc: 'त्वरित पुनरीक्षण के लिए बुलेट पॉइंट', emoji: '🎯' },
      { value: 'mixed', label: 'मिश्रित', desc: 'दोनों का सर्वश्रेष्ठ', emoji: '⚡' },
    ],
    langLabel: 'नोट्स की भाषा',
    generateBtn: '✨ नोट्स बनाएं',
    generating: 'नोट्स बन रहे हैं...',
    readyTitle: 'आपके नोट्स तैयार हैं! 🎉',
    downloadPdf: '⬇ PDF डाउनलोड करें',
    listenAudio: '🔊 सुनें',
    noText: 'इस फ़ाइल से कोई टेक्स्ट नहीं निकाला जा सका।',
    footer: 'Aditya V द्वारा ❤️ के साथ बनाया गया · Groq & Sarvam AI द्वारा संचालित',
  },
  ta: {
    title: 'சாந்தனு', online: 'ஆன்லைன்',
    dropText: 'கோப்புகளை இங்கே இடுங்கள் அல்லது', browse: 'உலாவுங்கள்',
    dropHint: 'PDF, PPTX, PNG, JPG ஆதரிக்கப்படுகிறது',
    addMore: '+ மேலும் சேர்க்கவும்',
    modeLabel: 'எந்த வகை குறிப்புகள் வேண்டும்?',
    modes: [
      { value: 'detailed', label: 'விரிவான குறிப்புகள்', desc: 'முழு விளக்கங்கள், எடுத்துக்காட்டுகள்', emoji: '📖' },
      { value: 'important', label: 'MCQ குறிப்புகள்', desc: 'விரைவு திருத்தத்திற்கான புள்ளிகள்', emoji: '🎯' },
      { value: 'mixed', label: 'கலவை', desc: 'இரண்டின் சிறந்தது', emoji: '⚡' },
    ],
    langLabel: 'குறிப்புகளின் மொழி',
    generateBtn: '✨ குறிப்புகள் உருவாக்கு',
    generating: 'குறிப்புகள் உருவாகின்றன...',
    readyTitle: 'உங்கள் குறிப்புகள் தயார்! 🎉',
    downloadPdf: '⬇ PDF பதிவிறக்கம்',
    listenAudio: '🔊 கேளுங்கள்',
    noText: 'இந்த கோப்பிலிருந்து உரை பிரிக்க முடியவில்லை.',
    footer: 'Aditya V ❤️ · Groq & Sarvam AI',
  },
}

// Fallback to English for languages without full UI translation
function getUI(lang) {
  return UI_TEXT[lang] || UI_TEXT['en']
}

export default function App() {
  const [files, setFiles] = useState([])
  const [mode, setMode] = useState('detailed')
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [speaking, setSpeaking] = useState({})

  // ── Quiz state ──────────────────────────────────────────────────────────────
  // quizData: { [resultIndex]: { quiz_title, questions } | null }
  const [quizData, setQuizData] = useState({})
  // quizLoading: { [resultIndex]: boolean }
  const [quizLoading, setQuizLoading] = useState({})
  // quizError: { [resultIndex]: string | null }
  const [quizError, setQuizError] = useState({})
  // activeQuiz: { [resultIndex]: { current: number, selected: string|null, submitted: boolean, score: number } }
  const [activeQuiz, setActiveQuiz] = useState({})

  // Map language codes to BCP-47 for Web Speech API
  const LANG_BCP47 = {
    en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', gu: 'gu-IN',
    kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', od: 'or-IN',
    pa: 'pa-IN', ta: 'ta-IN', te: 'te-IN',
  }

  function cleanForSpeech(text) {
    return text
      .replace(/#{1,6}\s*/g, '')        // remove ## headings
      .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold** -> bold
      .replace(/\*(.+?)\*/g, '$1')      // *italic* -> italic
      .replace(/^[-*]\s+/gm, '')        // bullet points
      .replace(/^\d+\.\s+/gm, '')       // numbered lists
      .replace(/`(.+?)`/g, '$1')        // inline code
      .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // __underline__
      .replace(/\n{3,}/g, '\n\n')       // excess newlines
      .trim()
  }

  function speakText(text, lang, index) {
    if (!window.speechSynthesis) return
    if (speaking[index]) {
      window.speechSynthesis.cancel()
      setSpeaking(s => ({ ...s, [index]: false }))
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text).slice(0, 3000))
    utterance.lang = LANG_BCP47[lang] || 'en-IN'
    utterance.rate = 0.9
    utterance.onend = () => setSpeaking(s => ({ ...s, [index]: false }))
    utterance.onerror = () => setSpeaking(s => ({ ...s, [index]: false }))
    setSpeaking(s => ({ ...s, [index]: true }))
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => window.speechSynthesis?.cancel()
  }, [])

  // Keep Render alive — ping every 10 minutes to prevent spin-down
  useEffect(() => {
    const ping = () => fetch(`${API_BASE}/`).catch(() => {})
    ping()
    const id = setInterval(ping, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const ui = getUI(language)

  function handleFileChange(e) {
    setFiles(Array.from(e.target.files))
    setResults(null)
    setError(null)
    // Reset quiz state when new files are selected
    setQuizData({})
    setQuizLoading({})
    setQuizError({})
    setActiveQuiz({})
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    setFiles(Array.from(e.dataTransfer.files))
    setResults(null)
    setError(null)
    // Reset quiz state when new files are dropped
    setQuizData({})
    setQuizLoading({})
    setQuizError({})
    setActiveQuiz({})
  }

  function removeFile(index) {
    setFiles(files.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!files.length) return

    setLoading(true)
    setError(null)
    setResults(null)
    // Reset quiz state on every new notes generation
    setQuizData({})
    setQuizLoading({})
    setQuizError({})
    setActiveQuiz({})

    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    formData.append('mode', mode)
    formData.append('language', language)

    try {
      const res = await fetch(`${API_BASE}/generate-notes`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Something went wrong')
      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function downloadPdf(pdfUrl, filename) {
    const a = document.createElement('a')
    a.href = `${API_BASE}${pdfUrl}`
    a.download = filename
    a.click()
  }

  // ── Quiz: fetch quiz for a specific result card ────────────────────────────
  async function handleGenerateQuiz(resultIndex, filename) {
    const fileObj = files.find(f => f.name === filename)
    if (!fileObj) return

    setQuizLoading(s => ({ ...s, [resultIndex]: true }))
    setQuizError(s => ({ ...s, [resultIndex]: null }))
    setQuizData(s => ({ ...s, [resultIndex]: null }))
    setActiveQuiz(s => ({ ...s, [resultIndex]: null }))

    const formData = new FormData()
    formData.append('files', fileObj)

    try {
      const res = await fetch(`${API_BASE}/generate-quiz`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Quiz generation failed')

      const fileResult = data.results?.[0]
      if (fileResult?.error) throw new Error(fileResult.error)
      if (!fileResult?.quiz) throw new Error('No quiz returned')

      setQuizData(s => ({ ...s, [resultIndex]: fileResult.quiz }))
      setActiveQuiz(s => ({
        ...s,
        [resultIndex]: { current: 0, selected: null, submitted: false, score: 0, answers: [] }
      }))
    } catch (err) {
      setQuizError(s => ({ ...s, [resultIndex]: err.message }))
    } finally {
      setQuizLoading(s => ({ ...s, [resultIndex]: false }))
    }
  }

  function handleSelectOption(resultIndex, option) {
    setActiveQuiz(s => {
      const q = s[resultIndex]
      if (!q || q.submitted) return s
      return { ...s, [resultIndex]: { ...q, selected: option } }
    })
  }

  function handleSubmitAnswer(resultIndex) {
    setActiveQuiz(s => {
      const q = s[resultIndex]
      const quiz = quizData[resultIndex]
      if (!q || q.submitted || !q.selected) return s
      const correct = quiz.questions[q.current].correct_answer
      const isCorrect = q.selected === correct
      const newAnswers = [...q.answers, { selected: q.selected, correct, isCorrect }]
      return {
        ...s,
        [resultIndex]: { ...q, submitted: true, score: isCorrect ? q.score + 1 : q.score, answers: newAnswers }
      }
    })
  }

  function handleNextQuestion(resultIndex) {
    setActiveQuiz(s => {
      const q = s[resultIndex]
      const quiz = quizData[resultIndex]
      if (!q) return s
      const nextIndex = q.current + 1
      if (nextIndex >= quiz.questions.length) {
        return { ...s, [resultIndex]: { ...q, current: nextIndex, submitted: true } }
      }
      return { ...s, [resultIndex]: { ...q, current: nextIndex, selected: null, submitted: false } }
    })
  }

  function handleRetakeQuiz(resultIndex, filename) {
    // Fetch a brand-new set of questions from the API
    handleGenerateQuiz(resultIndex, filename)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <h1 className="bot-name">AI Notes Generator</h1>
          {/* Language selector in header */}
          <div className="lang-selector-header">
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value); setResults(null) }}
              className="lang-select"
              aria-label="Select language"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="main">
        <form onSubmit={handleSubmit} className="upload-form">

          {/* Drop zone */}
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''} ${files.length ? 'has-files' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".pdf,.pptx,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {files.length === 0 ? (
              <>
                <div className="drop-icon">📂</div>
                <p className="drop-text">{ui.dropText} <span className="drop-link">{ui.browse}</span></p>
                <p className="drop-hint">{ui.dropHint}</p>
              </>
            ) : (
              <div className="file-list" onClick={(e) => e.stopPropagation()}>
                {files.map((f, i) => (
                  <div key={i} className="file-chip">
                    <span className="file-icon">{fileIcon(f.name)}</span>
                    <span className="file-name">{f.name}</span>
                    <button type="button" className="file-remove" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
                <button type="button" className="add-more"
                  onClick={() => document.getElementById('file-input').click()}>
                  {ui.addMore}
                </button>
              </div>
            )}
          </div>

          {/* Mode selector */}
          <div className="mode-section">
            <p className="mode-label">{ui.modeLabel}</p>
            <div className="mode-cards">
              {ui.modes.map((m) => (
                <label key={m.value} className={`mode-card ${mode === m.value ? 'selected' : ''}`}>
                  <input type="radio" name="mode" value={m.value}
                    checked={mode === m.value} onChange={() => setMode(m.value)} />
                  <span className="mode-emoji">{m.emoji}</span>
                  <span className="mode-title">{m.label}</span>
                  <span className="mode-desc">{m.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading || files.length === 0}>
            {loading ? <><span className="spinner" /> {ui.generating}</> : ui.generateBtn}
          </button>
        </form>

        {error && <div className="error-box"><span>⚠️</span> {error}</div>}

        {results && (
          <div className="results">
            <h2 className="results-title">{ui.readyTitle}</h2>
            {results.map((r, i) => (
              <div key={i} className="result-card">
                <div className="result-header">
                  <span className="result-filename">{fileIcon(r.file)} {r.file}</span>
                  <div className="result-actions">
                    {r.pdf_url && (
                      <button className="download-btn"
                        onClick={() => downloadPdf(r.pdf_url, r.file.replace(/\.[^.]+$/, '') + '_notes.pdf')}>
                        {ui.downloadPdf}
                      </button>
                    )}
                    {r.notes && (
                      <button
                        className={`audio-btn ${speaking[i] ? 'speaking' : ''}`}
                        onClick={() => speakText(r.notes, r.language || language, i)}
                      >
                        {speaking[i] ? '⏹ Stop' : ui.listenAudio}
                      </button>
                    )}
                    {r.audio_url && (
                      <audio src={`${API_BASE}${r.audio_url}`} controls style={{ height: '32px' }} />
                    )}
                    {/* ── Practice MCQs button — only show when notes exist ── */}
                    {r.notes && !quizData[i] && (
                      <button
                        className="quiz-btn"
                        onClick={() => handleGenerateQuiz(i, r.file)}
                        disabled={quizLoading[i]}
                      >
                        {quizLoading[i]
                          ? <><span className="spinner" /> Generating Quiz…</>
                          : '🧠 Practice MCQs'}
                      </button>
                    )}
                    {/* Re-generate quiz button once a quiz is already loaded */}
                    {quizData[i] && (
                      <button
                        className="quiz-btn"
                        onClick={() => handleGenerateQuiz(i, r.file)}
                        disabled={quizLoading[i]}
                      >
                        {quizLoading[i] ? <><span className="spinner" /> Regenerating…</> : '🔄 New Quiz'}
                      </button>
                    )}
                  </div>
                </div>
                {r.warning && <p className="result-warning">⚠️ {r.warning}</p>}
                {r.notes && <pre className="result-notes">{r.notes}</pre>}

                {/* ── Quiz error ─────────────────────────────────────────── */}
                {quizError[i] && (
                  <div className="error-box" style={{ margin: '0 20px 16px' }}>
                    <span>⚠️</span> {quizError[i]}
                  </div>
                )}

                {/* ── Quiz panel ─────────────────────────────────────────── */}
                {quizData[i] && activeQuiz[i] && (
                  <QuizPanel
                    quiz={quizData[i]}
                    session={activeQuiz[i]}
                    onSelect={(opt) => handleSelectOption(i, opt)}
                    onSubmit={() => handleSubmitAnswer(i)}
                    onNext={() => handleNextQuestion(i)}
                    onRetake={() => handleRetakeQuiz(i, r.file)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="promo-banner">
          <span className="promo-msg">👉 Go to these websites for more amazing notes!</span>
          <div className="promo-links">
            <a href="https://www.notego.in/" target="_blank" rel="noopener noreferrer" className="promo-link">
              🗒️ NoteGo
            </a>
            <a href="https://exnote.vercel.app/" target="_blank" rel="noopener noreferrer" className="promo-link">
              ✏️ ExNote
            </a>
          </div>
        </div>
        <div className="footer-main">{ui.footer}</div>
      </footer>
    </div>
  )
}

function fileIcon(name) {
  if (name.endsWith('.pdf')) return '📄'
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return '📊'
  if (name.match(/\.(png|jpg|jpeg)$/i)) return '🖼️'
  return '📁'
}

// ── QuizPanel component ───────────────────────────────────────────────────────
// Renders inside an existing result-card. Uses only existing CSS classes plus
// quiz-specific classes defined in App.css. No layout changes to the outer app.
function QuizPanel({ quiz, session, onSelect, onSubmit, onNext, onRetake }) {
  const { questions, quiz_title } = quiz
  const { current, selected, submitted, score, answers } = session
  const isFinished = current >= questions.length

  // ── Finished screen ─────────────────────────────────────────────────────────
  if (isFinished) {
    const total = questions.length
    const pct = Math.round((score / total) * 100)
    return (
      <div className="quiz-panel">
        <div className="quiz-score-screen">
          <div className="quiz-score-emoji">
            {pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}
          </div>
          <h3 className="quiz-score-title">Quiz Complete!</h3>
          <p className="quiz-score-value">{score} / {total} correct ({pct}%)</p>

          {/* Answer review */}
          <div className="quiz-review">
            {questions.map((q, idx) => {
              const ans = answers[idx]
              return (
                <div key={idx} className={`quiz-review-item ${ans?.isCorrect ? 'correct' : 'wrong'}`}>
                  <p className="quiz-review-q">
                    <span className="quiz-review-badge">{ans?.isCorrect ? '✓' : '✗'}</span>
                    {q.question}
                  </p>
                  {!ans?.isCorrect && (
                    <p className="quiz-review-answer">
                      Your answer: <span className="quiz-wrong-ans">{ans?.selected}</span><br />
                      Correct: <span className="quiz-correct-ans">{q.correct_answer}</span>
                    </p>
                  )}
                  {q.explanation && (
                    <p className="quiz-explanation">💡 {q.explanation}</p>
                  )}
                </div>
              )
            })}
          </div>

          <button className="quiz-btn quiz-retake-btn" onClick={onRetake}>
            🔁 Retake Quiz
          </button>
        </div>
      </div>
    )
  }

  // ── Active question screen ──────────────────────────────────────────────────
  const q = questions[current]
  const diffColor = { easy: '#4ade80', medium: '#fbbf24', hard: '#f87171' }

  return (
    <div className="quiz-panel">
      {/* Quiz header */}
      <div className="quiz-header">
        <span className="quiz-title">🧠 {quiz_title}</span>
        <span className="quiz-progress">{current + 1} / {questions.length}</span>
      </div>

      {/* Difficulty badge */}
      <span className="quiz-difficulty" style={{ color: diffColor[q.difficulty] || '#a78bfa' }}>
        {q.difficulty?.toUpperCase()}
      </span>

      {/* Question */}
      <p className="quiz-question">{q.question}</p>

      {/* Options */}
      <div className="quiz-options">
        {q.options.map((opt, oi) => {
          let cls = 'quiz-option'
          if (submitted) {
            if (opt === q.correct_answer) cls += ' quiz-option-correct'
            else if (opt === selected && opt !== q.correct_answer) cls += ' quiz-option-wrong'
          } else if (opt === selected) {
            cls += ' quiz-option-selected'
          }
          return (
            <button
              key={oi}
              className={cls}
              onClick={() => onSelect(opt)}
              disabled={submitted}
            >
              <span className="quiz-option-letter">{String.fromCharCode(65 + oi)}</span>
              {opt}
            </button>
          )
        })}
      </div>

      {/* Explanation after submit */}
      {submitted && q.explanation && (
        <p className="quiz-explanation">💡 {q.explanation}</p>
      )}

      {/* Action buttons */}
      <div className="quiz-actions">
        {!submitted ? (
          <button
            className="submit-btn"
            style={{ padding: '10px 24px', fontSize: '14px' }}
            onClick={onSubmit}
            disabled={!selected}
          >
            Submit Answer
          </button>
        ) : (
          <button
            className="submit-btn"
            style={{ padding: '10px 24px', fontSize: '14px' }}
            onClick={onNext}
          >
            {current + 1 < questions.length ? 'Next Question →' : 'See Results 🏁'}
          </button>
        )}
      </div>
    </div>
  )
}
