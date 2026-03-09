import { useState, useRef, useCallback, useEffect } from "react";

const API = "http://localhost:5000/api";

const DOC_TYPES = [
  { id: "order",    label: "Court Order",   icon: "⚖️" },
  { id: "petition", label: "Petition",      icon: "📜" },
  { id: "judgment", label: "Judgment",      icon: "🏛️" },
  { id: "affidavit",label: "Affidavit",     icon: "✍️" },
  { id: "notice",   label: "Legal Notice",  icon: "📋" },
  { id: "fir",      label: "FIR",           icon: "🚨" },
];

const LABEL_COLORS = {
  ROLE:  { bg: "rgba(200,169,110,0.15)", border: "rgba(200,169,110,0.5)", text: "#c8a96e" },
  WRIT:  { bg: "rgba(80,200,100,0.1)",  border: "rgba(80,200,100,0.4)",  text: "#50c864" },
  LATIN: { bg: "rgba(100,150,255,0.1)", border: "rgba(100,150,255,0.4)", text: "#8ab4ff" },
  COURT: { bg: "rgba(255,150,80,0.1)",  border: "rgba(255,150,80,0.4)",  text: "#ff9650" },
  DOC:   { bg: "rgba(200,80,200,0.1)",  border: "rgba(200,80,200,0.4)",  text: "#e070e0" },
  PROC:  { bg: "rgba(80,200,200,0.1)",  border: "rgba(80,200,200,0.4)",  text: "#50c8c8" },
  CONST: { bg: "rgba(255,200,80,0.1)",  border: "rgba(255,200,80,0.4)",  text: "#ffc850" },
};

const SAMPLE_TEXT = `IN THE HIGH COURT OF ANDHRA PRADESH AT AMARAVATI

WRIT PETITION No. 10667 OF 2025

BETWEEN:
Sri Ramesh Kumar, S/o Late Venkat Rao
                                        ...PETITIONER

AND

The State of Andhra Pradesh, rep. by its Principal Secretary
                                        ...RESPONDENT

ORDER

This Writ Petition has been filed under Article 226 of the Constitution of India seeking a Writ of Mandamus.

Heard the learned counsel for the Petitioner. The Respondent is directed to appear on the next date.

Prima Facie, the court is satisfied. The Accused persons are granted Bail pending further orders from the Trial Court.

List the matter on 10.12.2025.

                                        JUDGE`;

export default function App() {
  const [step, setStep]             = useState("upload");
  const [docText, setDocText]       = useState("");
  const [docType, setDocType]       = useState("order");
  const [fileName, setFileName]     = useState("");
  const [languages, setLanguages]   = useState([]);
  const [targetLang, setTargetLang] = useState(null);
  const [detectedTerms, setDetectedTerms] = useState([]);
  const [translating, setTranslating]     = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState("");
  const [backendOk, setBackendOk]   = useState(null);
  const [dragOver, setDragOver]     = useState(false);
  const [progress, setProgress]     = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const fileRef = useRef(null);

  // ── Check backend health on load ──────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.json())
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));

    fetch(`${API}/languages`)
      .then(r => r.json())
      .then(d => setLanguages(d.languages || []))
      .catch(() => {});
  }, []);

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    setError("");
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await fetch(`${API}/extract-pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: e.target.result }),
          });
          const data = await res.json();
          if (data.error) { setError(data.error); return; }
          goToConfigure(data.text);
        } catch {
          setError("PDF extraction failed. Make sure the backend is running.");
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = e => goToConfigure(e.target.result);
      reader.readAsText(file);
    }
  }, []);

  // ── Extract terms preview ─────────────────────────────────────────────────
  const extractTerms = async (text) => {
    try {
      const res = await fetch(`${API}/extract-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setDetectedTerms(data.terms || []);
    } catch { setDetectedTerms([]); }
  };

  const goToConfigure = (text) => {
    setDocText(text);
    setStep("configure");
    extractTerms(text);
  };

  // ── Main translation pipeline call ───────────────────────────────────────
  const translate = async () => {
    if (!targetLang || !docText) return;
    setTranslating(true);
    setError("");
    setProgress(0);

    const phases = [
      [15, "Layer 1 — Running Legal NER…"],
      [35, "Layer 2 — Pre-processing & protecting terms…"],
      [70, "Layer 3 — Translating…"],
      [90, "Layer 4 — Re-injecting legal terms…"],
      [100,"Finalising output…"],
    ];

    let pi = 0;
    const interval = setInterval(() => {
      if (pi < phases.length) {
        setProgress(phases[pi][0]);
        setProgressLabel(phases[pi][1]);
        pi++;
      }
    }, 900);

    try {
      const res = await fetch(`${API}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: docText,
          target_lang: targetLang,
          doc_type: docType,
        }),
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok || data.error) throw new Error(data.error || "Translation failed");
      setProgress(100);
      setProgressLabel("Done!");
      setTimeout(() => {
        setResult(data);
        setStep("result");
        setTranslating(false);
      }, 600);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setTranslating(false);
      setStep("configure");
    }
  };

  const reset = () => {
    setStep("upload"); setDocText(""); setFileName(""); setTargetLang(null);
    setDetectedTerms([]); setResult(null); setError(""); setProgress(0);
  };

  const langObj = languages.find(l => l.code === targetLang);

  // ── STYLES ────────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight:"100vh", background:"linear-gradient(135deg,#0a0e1a 0%,#0d1528 60%,#0a1520 100%)", color:"#e8dcc8", fontFamily:"Georgia,serif" },
    header: { borderBottom:"1px solid rgba(200,169,110,0.2)", background:"rgba(10,14,26,0.9)", backdropFilter:"blur(20px)", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
    logo: { display:"flex", alignItems:"center", gap:14 },
    logoIcon: { width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#c8a96e,#8b6914)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 20px rgba(200,169,110,0.3)" },
    badge: (color) => ({ padding:"4px 12px",borderRadius:20,border:`1px solid ${color}`,fontSize:11,letterSpacing:"0.08em" }),
    main: { maxWidth:1100,margin:"0 auto",padding:"32px 24px" },
    card: { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(200,169,110,0.15)",borderRadius:16,padding:20 },
    btn: (gold) => ({ padding:"10px 24px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,letterSpacing:"0.05em",
      background: gold ? "linear-gradient(135deg,#c8a96e,#8b6914)" : "rgba(200,169,110,0.1)",
      color: gold ? "#0a0e1a" : "#c8a96e",
      boxShadow: gold ? "0 4px 20px rgba(200,169,110,0.25)" : "none" }),
    sectionTag: { display:"inline-block",padding:"4px 14px",borderRadius:20,border:"1px solid rgba(200,169,110,0.35)",background:"rgba(200,169,110,0.08)",fontSize:11,color:"#c8a96e",letterSpacing:"0.12em",marginBottom:10 },
    h2: { fontSize:28,fontWeight:700,color:"#e8dcc8",marginBottom:20 },
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>⚖️</div>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#c8a96e",letterSpacing:"0.02em"}}>NyayaVaani</div>
            <div style={{fontSize:11,color:"#5a6a7a",letterSpacing:"0.1em"}}>ML LEGAL TRANSLATOR · NO API · OPEN SOURCE</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <span style={{...S.badge("rgba(200,169,110,0.4)"),color:"#c8a96e",background:"rgba(200,169,110,0.08)"}}>Groq LLaMA</span>
          <span style={{...S.badge("rgba(80,200,100,0.4)"),color:"#50c864",background:"rgba(80,200,100,0.08)"}}>spaCy NER</span>
          {backendOk === true  && <span style={{...S.badge("rgba(80,200,100,0.4)"),color:"#50c864",background:"rgba(80,200,100,0.08)"}}>● Backend Connected</span>}
          {backendOk === false && <span style={{...S.badge("rgba(255,80,80,0.4)"), color:"#ff8080",background:"rgba(255,80,80,0.08)"}}>● Backend Offline</span>}
        </div>
      </header>

      {/* ── STEP INDICATOR ─────────────────────────────────────────────── */}
      <div style={{background:"rgba(0,0,0,0.2)",borderBottom:"1px solid rgba(200,169,110,0.1)",padding:"10px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",gap:0}}>
          {["Upload","Configure","Translating","Result"].map((s,i) => {
            const active = ["upload","configure","translating","result"][i] === step;
            const done   = ["upload","configure","translating","result"].indexOf(step) > i;
            return (
              <div key={s} style={{display:"flex",alignItems:"center",flex:i<3?1:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,opacity:active||done?1:0.3}}>
                  <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"monospace",
                    background:active?"#c8a96e":done?"rgba(200,169,110,0.3)":"rgba(200,169,110,0.08)",
                    color:active?"#0a0e1a":"#c8a96e",border:"1px solid rgba(200,169,110,0.3)",transition:"all 0.3s"}}>{i+1}</div>
                  <span style={{fontSize:11,color:active?"#c8a96e":"#5a6a7a",letterSpacing:"0.05em"}}>{s}</span>
                </div>
                {i<3 && <div style={{flex:1,height:1,margin:"0 10px",background:"rgba(200,169,110,0.12)"}}/>}
              </div>
            );
          })}
        </div>
      </div>

      <main style={S.main}>

        {/* ── BACKEND OFFLINE WARNING ──────────────────────────────────── */}
        {backendOk === false && (
          <div style={{padding:16,borderRadius:12,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",marginBottom:24,fontSize:13,color:"#ff9090"}}>
            <strong>⚠️ Backend not running.</strong> Open a terminal and run:
            <code style={{display:"block",marginTop:8,padding:"8px 14px",borderRadius:6,background:"rgba(0,0,0,0.4)",color:"#80ff80",fontFamily:"monospace",fontSize:12}}>
              cd nyayavaani-ml/backend && pip install -r requirements.txt && python app.py
            </code>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 1: UPLOAD                                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <div>
            <div style={{textAlign:"center",marginBottom:48}}>
              <h1 style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:400,color:"#e8dcc8",marginBottom:12}}>
                Translate Legal Documents<br/>
                <span style={{color:"#c8a96e",fontStyle:"italic"}}>Powered by Open-Source ML</span>
              </h1>
              <p style={{color:"#6a7a8a",fontSize:15,maxWidth:540,margin:"0 auto",lineHeight:1.8}}>
                Free Groq API + custom NER pipeline. Translates Indian court documents into 12 regional languages while preserving legal terminology.
              </p>
            </div>

            {/* ML Pipeline badges */}
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:40}}>
              {[
                {icon:"🧠",label:"Layer 1 · Legal NER (spaCy rules)"},
                {icon:"⚙️",label:"Layer 2 · Pre-processor (yours)"},
                {icon:"🔤",label:"Layer 3 · Groq LLaMA 3.3 (free API)"},
                {icon:"⚖️",label:"Layer 4 · Post-processor (yours)"},
                {icon:"⚛️", label:"Layer 5 · React Frontend (yours)"},
              ].map((b,i) => (
                <div key={i} style={{padding:"7px 16px",borderRadius:24,border:"1px solid rgba(200,169,110,0.25)",background:"rgba(200,169,110,0.05)",fontSize:11,color:"#a0906a",display:"flex",gap:6,alignItems:"center"}}>
                  <span>{b.icon}</span>{b.label}
                </div>
              ))}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}}
              onClick={()=>fileRef.current?.click()}
              style={{border:`2px dashed ${dragOver?"#c8a96e":"rgba(200,169,110,0.3)"}`,borderRadius:18,padding:"52px 32px",textAlign:"center",cursor:"pointer",
                background:dragOver?"rgba(200,169,110,0.06)":"rgba(200,169,110,0.02)",transition:"all 0.3s",marginBottom:24}}>
              <div style={{fontSize:52,marginBottom:14}}>📄</div>
              <div style={{fontSize:17,color:"#c8a96e",marginBottom:6}}>Drop your legal document here</div>
              <div style={{fontSize:12,color:"#4a5a6a",marginBottom:18}}>Supports .txt files</div>
              <div style={{display:"inline-block",...S.btn(true)}}>Browse Files</div>
              <input ref={fileRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            </div>

            {/* Paste area */}
            <div style={{marginBottom:28}}>
              <div style={{fontSize:11,color:"#4a5a6a",textAlign:"center",marginBottom:14,letterSpacing:"0.1em"}}>— OR PASTE TEXT —</div>
              <textarea
                placeholder="Paste your court order, petition or judgment here..."
                value={docText}
                onChange={e=>setDocText(e.target.value)}
                style={{width:"100%",minHeight:160,padding:18,borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(200,169,110,0.2)",
                  color:"#e8dcc8",fontSize:13,resize:"vertical",outline:"none",fontFamily:"monospace",lineHeight:1.7,boxSizing:"border-box"}}
              />
              {docText.length > 50 && (
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                  <button onClick={()=>goToConfigure(docText)} style={S.btn(true)}>Continue →</button>
                </div>
              )}
            </div>

            {/* Sample */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,color:"#4a5a6a",marginBottom:14,letterSpacing:"0.1em"}}>— TRY SAMPLE DOCUMENT —</div>
              <button onClick={()=>{setFileName("sample_order.txt");goToConfigure(SAMPLE_TEXT);}} style={S.btn(false)}>
                📋 Load Sample Court Order
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 2: CONFIGURE                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === "configure" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <button onClick={reset} style={{...S.btn(false),padding:"6px 14px",fontSize:12}}>← Back</button>
              <span style={{fontSize:13,color:"#5a6a7a"}}>📄 {fileName || "pasted text"} · {docText.length.toLocaleString()} chars</span>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>

              {/* Left: Preview + NER results */}
              <div>
                <div style={S.sectionTag}>DOCUMENT PREVIEW</div>
                <div style={{...S.card,height:280,overflow:"auto",fontSize:11.5,lineHeight:1.8,color:"#8a9aaa",fontFamily:"monospace",whiteSpace:"pre-wrap",marginBottom:20}}>
                  {docText}
                </div>

                {/* Layer 1 NER Results */}
                <div style={S.sectionTag}>🧠 LAYER 1 — NER RESULTS ({detectedTerms.length} terms found)</div>
                {detectedTerms.length > 0 ? (
                  <div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                      {detectedTerms.map((t,i) => {
                        const c = LABEL_COLORS[t.label] || LABEL_COLORS.ROLE;
                        return (
                          <span key={i} style={{padding:"3px 10px",borderRadius:16,border:`1px solid ${c.border}`,background:c.bg,fontSize:10.5,color:c.text}}>
                            {t.normalized}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{padding:12,borderRadius:8,background:"rgba(200,169,110,0.04)",border:"1px solid rgba(200,169,110,0.15)",fontSize:11,color:"#7a8a9a",lineHeight:1.7}}>
                      💡 These terms will be <strong style={{color:"#c8a96e"}}>preserved in English</strong> with regional translation in brackets.<br/>
                      Example: <span style={{color:"#c8a96e"}}>Petitioner [याचिकाकर्ता]</span>
                    </div>
                  </div>
                ) : (
                  <div style={{fontSize:12,color:"#4a5a6a",padding:12}}>No terms detected yet. Configure and translate to run the full pipeline.</div>
                )}

                {/* Doc type */}
                <div style={{marginTop:18}}>
                  <div style={S.sectionTag}>DOCUMENT TYPE</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {DOC_TYPES.map(dt => (
                      <button key={dt.id} onClick={()=>setDocType(dt.id)} style={{padding:"8px 6px",borderRadius:8,cursor:"pointer",fontSize:11,
                        background:docType===dt.id?"rgba(200,169,110,0.18)":"rgba(200,169,110,0.04)",
                        border:`1px solid ${docType===dt.id?"rgba(200,169,110,0.6)":"rgba(200,169,110,0.15)"}`,
                        color:docType===dt.id?"#c8a96e":"#6a7a8a",transition:"all 0.2s"}}>
                        {dt.icon} {dt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Language selection */}
              <div>
                <div style={S.sectionTag}>SELECT TARGET LANGUAGE</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
                  {languages.map(lang => (
                    <button key={lang.code} onClick={()=>setTargetLang(lang.code)} style={{padding:"12px 14px",borderRadius:10,cursor:"pointer",
                      background:targetLang===lang.code?"rgba(200,169,110,0.15)":"rgba(255,255,255,0.02)",
                      border:`1px solid ${targetLang===lang.code?"#c8a96e":"rgba(200,169,110,0.15)"}`,
                      color:targetLang===lang.code?"#c8a96e":"#7a8a9a",
                      display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,textAlign:"left"}}>{lang.name}</div>
                        <div style={{fontSize:11,opacity:0.65,marginTop:2}}>{lang.native}</div>
                      </div>
                      <span style={{fontSize:18}}>🇮🇳</span>
                    </button>
                  ))}
                </div>

                {/* ML pipeline info */}
                <div style={{...S.card,marginBottom:18,border:"1px solid rgba(80,200,100,0.2)"}}>
                  <div style={{fontSize:12,color:"#50c864",marginBottom:10}}>⚙️ ML Pipeline (your layers)</div>
                  {[
                    {n:"01",color:"#c8a96e", label:"LegalNER",       desc:"Detects 100+ Indian legal terms"},
                    {n:"02",color:"#8ab4ff", label:"PreProcessor",   desc:"Protects terms with placeholders"},
                    {n:"03",color:"#50c864", label:"Groq LLaMA",     desc:"Free LLM translation engine"},
                    {n:"04",color:"#ff9650", label:"PostProcessor",  desc:"Re-injects term [translation]"},
                  ].map(l => (
                    <div key={l.n} style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                      <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,background:`rgba(${l.color.slice(1).match(/../g).map(x=>parseInt(x,16)).join(",")},0.2)`,color:l.color,border:`1px solid ${l.color}`,flexShrink:0}}>{l.n}</div>
                      <div style={{flex:1}}>
                        <span style={{fontSize:11,fontWeight:700,color:l.color}}>{l.label}</span>
                        <span style={{fontSize:10,color:"#5a6a7a",marginLeft:6}}>{l.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <div style={{padding:12,borderRadius:8,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",fontSize:12,color:"#ff9090",marginBottom:14}}>⚠️ {error}</div>}

                <button onClick={translate} disabled={!targetLang || !backendOk} style={{width:"100%",padding:14,borderRadius:10,...S.btn(true && targetLang && backendOk),
                  opacity:(!targetLang||!backendOk)?0.4:1,cursor:(!targetLang||!backendOk)?"not-allowed":"pointer"}}>
                  {targetLang ? `Translate to ${langObj?.name} →` : "Select a language to continue"}
                </button>
                {!backendOk && <div style={{fontSize:11,color:"#ff8080",marginTop:8,textAlign:"center"}}>Start the Python backend first</div>}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 3: TRANSLATING                                             */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === "translating" && translating && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",textAlign:"center"}}>
            <div style={{fontSize:64,marginBottom:28,animation:"spin 3s linear infinite"}}>⚙️</div>
            <h2 style={{fontSize:26,color:"#e8dcc8",marginBottom:10,fontWeight:400}}>ML Pipeline Running</h2>
            <p style={{color:"#5a6a7a",fontSize:14,marginBottom:40,maxWidth:440,lineHeight:1.8}}>
              Processing your document through the 4-layer NLP pipeline.<br/>
              <strong style={{color:"#c8a96e"}}>Legal terms are preserved</strong> with regional translations in brackets.
            </p>

            <div style={{width:"100%",maxWidth:460,marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:11,color:"#5a6a7a"}}>{progressLabel}</span>
                <span style={{fontSize:11,color:"#c8a96e"}}>{progress}%</span>
              </div>
              <div style={{height:5,borderRadius:3,background:"rgba(200,169,110,0.1)",overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,width:`${progress}%`,background:"linear-gradient(90deg,#8b6914,#c8a96e)",transition:"width 0.8s ease"}}/>
              </div>
            </div>

            <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
              {["NER Detection","Term Protection","LLM Translation","Bracket Injection"].map((p,i) => (
                <div key={i} style={{padding:"6px 14px",borderRadius:20,fontSize:11,
                  background:progress > (i+1)*20?"rgba(80,200,100,0.1)":"rgba(200,169,110,0.05)",
                  border:`1px solid ${progress>(i+1)*20?"rgba(80,200,100,0.4)":"rgba(200,169,110,0.15)"}`,
                  color:progress>(i+1)*20?"#50c864":"#5a6a7a",transition:"all 0.5s"}}>
                  {progress>(i+1)*20?"✓ ":""}{p}
                </div>
              ))}
            </div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 4: RESULT                                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === "result" && result && (
          <div>
            {/* Success bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderRadius:14,marginBottom:20,
              background:"rgba(80,200,100,0.05)",border:"1px solid rgba(80,200,100,0.2)"}}>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <span style={{fontSize:36}}>✅</span>
                <div>
                  <div style={{fontSize:16,color:"#80e880",fontWeight:600}}>Translation Complete</div>
                  <div style={{fontSize:11,color:"#5a6a7a",marginTop:3}}>
                    {result.detected_terms?.length || 0} legal terms detected · {result.confidence?.terms_preserved || 0} preserved with brackets · {result.processing_time_sec}s
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>navigator.clipboard.writeText(result.translated)} style={S.btn(false)}>📋 Copy</button>
                <button onClick={()=>{const b=new Blob([result.translated],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`translated_${targetLang}.txt`;a.click();}} style={S.btn(true)}>⬇ Download</button>
                <button onClick={reset} style={{...S.btn(false),color:"#5a6a7a"}}>New</button>
              </div>
            </div>

            {/* Confidence panel */}
            {result.confidence && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[
                  {label:"Confidence", val:`${result.confidence.overall}%`,   color:"#c8a96e"},
                  {label:"Terms Found",val:result.confidence.terms_found,      color:"#8ab4ff"},
                  {label:"Preserved",  val:result.confidence.terms_preserved,  color:"#50c864"},
                  {label:"Struct Score",val:`${result.confidence.structure_score}%`,color:"#ff9650"},
                ].map((m,i) => (
                  <div key={i} style={{...S.card,textAlign:"center",padding:"14px 10px"}}>
                    <div style={{fontSize:24,fontWeight:700,color:m.color,fontFamily:"Georgia"}}>{m.val}</div>
                    <div style={{fontSize:10,color:"#5a6a7a",marginTop:4}}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Side-by-side */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <div style={{padding:"5px 14px",borderRadius:20,display:"inline-block",marginBottom:10,background:"rgba(100,150,255,0.1)",border:"1px solid rgba(100,150,255,0.3)",fontSize:10,color:"#8ab4ff",letterSpacing:"0.1em"}}>ORIGINAL · ENGLISH</div>
                <div style={{...S.card,height:480,overflow:"auto",fontSize:12,lineHeight:1.9,color:"#8a9aaa",fontFamily:"monospace",whiteSpace:"pre-wrap",border:"1px solid rgba(100,150,255,0.15)"}}>
                  {result.original}
                </div>
              </div>
              <div>
                <div style={{padding:"5px 14px",borderRadius:20,display:"inline-block",marginBottom:10,background:"rgba(200,169,110,0.1)",border:"1px solid rgba(200,169,110,0.35)",fontSize:10,color:"#c8a96e",letterSpacing:"0.1em"}}>
                  TRANSLATED · {langObj?.name?.toUpperCase()} {langObj?.native}
                </div>
                <div style={{...S.card,height:480,overflow:"auto",fontSize:13,lineHeight:2,color:"#e0d4b8",whiteSpace:"pre-wrap",border:"1px solid rgba(200,169,110,0.2)"}}>
                  {result.translated}
                </div>
              </div>
            </div>

            {/* ML Layers used */}
            <div style={{...S.card,marginTop:16,border:"1px solid rgba(80,200,100,0.15)"}}>
              <div style={{fontSize:12,color:"#50c864",marginBottom:10}}>⚙️ Layers Used in This Translation</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {(result.layers_used||[]).map((l,i) => (
                  <span key={i} style={{padding:"4px 12px",borderRadius:16,background:"rgba(80,200,100,0.07)",border:"1px solid rgba(80,200,100,0.25)",fontSize:11,color:"#70d870"}}>✓ {l}</span>
                ))}
              </div>
            </div>

            {/* Legal disclaimer */}
            <div style={{marginTop:14,padding:14,borderRadius:8,background:"rgba(255,150,50,0.05)",border:"1px solid rgba(255,150,50,0.2)",fontSize:11,color:"#8a7a6a"}}>
              ⚠️ <strong style={{color:"#c0a060"}}>Legal Disclaimer:</strong> AI-generated translation for accessibility only. For official proceedings, obtain a certified legal translation.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
