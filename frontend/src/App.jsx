import { useState, useRef, useCallback, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || 
  (window.location.hostname === "localhost" 
    ? "http://localhost:5000/api" 
    : "https://legal-doc-translator-india.onrender.com/api");

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
  const [pdfSupport, setPdfSupport] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [progress, setProgress]     = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.json())
      .then(d => { setBackendOk(true); setPdfSupport(d.pdf_support || false); })
      .catch(() => setBackendOk(false));
    fetch(`${API}/languages`)
      .then(r => r.json())
      .then(d => setLanguages(d.languages || []))
      .catch(() => {});
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setFileName(file.name);
    setError("");
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (isPdf) {
      setExtracting(true);
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
        const res = await fetch(`${API}/extract-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64 }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error + (data.hint ? `\n${data.hint}` : ""));
        setDocText(data.text);
        setDetectedTerms(data.detected_terms || []);
        setStep("configure");
      } catch (err) {
        setError(`PDF extraction failed: ${err.message}`);
      } finally {
        setExtracting(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = e => { setDocText(e.target.result); setStep("configure"); extractTerms(e.target.result); };
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file);
    }
  }, []);

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

  const translate = async () => {
    if (!targetLang || !docText) return;
    setTranslating(true);
    setError("");
    setProgress(0);
    const phases = [
      [15,  "Layer 1 — Running Legal NER…"],
      [35,  "Layer 2 — Pre-processing & protecting terms…"],
      [70,  "Layer 3 — Translating with Groq LLaMA…"],
      [90,  "Layer 4 — Re-injecting legal terms…"],
      [100, "Finalising output…"],
    ];
    let pi = 0;
    const interval = setInterval(() => {
      if (pi < phases.length) { setProgress(phases[pi][0]); setProgressLabel(phases[pi][1]); pi++; }
    }, 900);
    try {
      const res = await fetch(`${API}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: docText, target_lang: targetLang, doc_type: docType }),
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok || data.error) throw new Error(data.error || "Translation failed");
      setProgress(100);
      setProgressLabel("Done!");
      setTimeout(() => { setResult(data); setStep("result"); setTranslating(false); }, 600);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setTranslating(false);
      setStep("configure");
    }
  };

  const reset = () => {
    setStep("upload"); setDocText(""); setFileName(""); setTargetLang(null);
    setDetectedTerms([]); setResult(null); setError(""); setProgress(0); setExtracting(false);
  };

  const langObj = languages.find(l => l.code === targetLang);

  const S = {
    page:   { minHeight:"100vh", background:"linear-gradient(135deg,#0a0e1a 0%,#0d1528 60%,#0a1520 100%)", color:"#e8dcc8", fontFamily:"Georgia,serif" },
    header: { borderBottom:"1px solid rgba(200,169,110,0.2)", background:"rgba(10,14,26,0.9)", backdropFilter:"blur(20px)", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
    badge:  (c) => ({ padding:"4px 12px", borderRadius:20, border:`1px solid ${c}`, fontSize:11, letterSpacing:"0.08em" }),
    main:   { maxWidth:1100, margin:"0 auto", padding:"32px 24px" },
    card:   { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(200,169,110,0.15)", borderRadius:16, padding:20 },
    btn:    (gold) => ({ padding:"10px 24px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13, letterSpacing:"0.05em",
      background: gold ? "linear-gradient(135deg,#c8a96e,#8b6914)" : "rgba(200,169,110,0.1)",
      color: gold ? "#0a0e1a" : "#c8a96e",
      boxShadow: gold ? "0 4px 20px rgba(200,169,110,0.25)" : "none" }),
    tag:    { display:"inline-block", padding:"4px 14px", borderRadius:20, border:"1px solid rgba(200,169,110,0.35)", background:"rgba(200,169,110,0.08)", fontSize:11, color:"#c8a96e", letterSpacing:"0.12em", marginBottom:10 },
  };

  return (
    <div style={S.page}>

      {/* HEADER */}
      <header style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#c8a96e,#8b6914)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 20px rgba(200,169,110,0.3)"}}>⚖️</div>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#c8a96e",letterSpacing:"0.02em"}}>NyayaVaani</div>
            <div style={{fontSize:11,color:"#5a6a7a",letterSpacing:"0.1em"}}>AI LEGAL TRANSLATOR · 12 LANGUAGES · FREE</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{...S.badge("rgba(200,169,110,0.4)"),color:"#c8a96e",background:"rgba(200,169,110,0.08)"}}>Groq LLaMA 3.3</span>
          <span style={{...S.badge("rgba(80,200,100,0.4)"), color:"#50c864",background:"rgba(80,200,100,0.08)"}}>Custom NER</span>
          {pdfSupport && <span style={{...S.badge("rgba(100,150,255,0.4)"),color:"#8ab4ff",background:"rgba(100,150,255,0.08)"}}>PDF ✓</span>}
          {backendOk === true  && <span style={{...S.badge("rgba(80,200,100,0.4)"), color:"#50c864",background:"rgba(80,200,100,0.08)"}}>● Backend OK</span>}
          {backendOk === false && <span style={{...S.badge("rgba(255,80,80,0.4)"),  color:"#ff8080",background:"rgba(255,80,80,0.08)"}}>● Offline</span>}
        </div>
      </header>

      {/* STEP INDICATOR */}
      <div style={{background:"rgba(0,0,0,0.2)",borderBottom:"1px solid rgba(200,169,110,0.1)",padding:"10px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",gap:0}}>
          {["Upload","Configure","Translating","Result"].map((s,i) => {
            const key = ["upload","configure","translating","result"][i];
            const active = key === step;
            const done   = ["upload","configure","translating","result"].indexOf(step) > i;
            return (
              <div key={s} style={{display:"flex",alignItems:"center",flex:i<3?1:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,opacity:active||done?1:0.3}}>
                  <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"monospace",
                    background:active?"#c8a96e":done?"rgba(200,169,110,0.3)":"rgba(200,169,110,0.08)",
                    color:active?"#0a0e1a":"#c8a96e",border:"1px solid rgba(200,169,110,0.3)",transition:"all 0.3s"}}>{i+1}</div>
                  <span style={{fontSize:11,color:active?"#c8a96e":"#5a6a7a"}}>{s}</span>
                </div>
                {i<3 && <div style={{flex:1,height:1,margin:"0 10px",background:"rgba(200,169,110,0.12)"}}/>}
              </div>
            );
          })}
        </div>
      </div>

      {/* PDF EXTRACTING OVERLAY */}
      {extracting && (
        <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(10,14,26,0.95)",backdropFilter:"blur(12px)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
          <div style={{fontSize:56}}>📄</div>
          <div style={{fontSize:20,color:"#c8a96e",fontWeight:600}}>Extracting PDF Text…</div>
          <div style={{fontSize:13,color:"#5a6a7a",maxWidth:360,textAlign:"center",lineHeight:1.7}}>
            Reading your legal document and extracting text from all pages.
          </div>
          <div style={{width:220,height:5,borderRadius:3,background:"rgba(200,169,110,0.1)",overflow:"hidden"}}>
            <div style={{height:"100%",width:"60%",borderRadius:3,background:"linear-gradient(90deg,#8b6914,#c8a96e)",animation:"slide 1.2s ease-in-out infinite"}}/>
          </div>
          <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}`}</style>
        </div>
      )}

      <main style={S.main}>

        {/* BACKEND OFFLINE */}
        {backendOk === false && (
          <div style={{padding:16,borderRadius:12,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",marginBottom:24,fontSize:13,color:"#ff9090"}}>
            <strong>⚠️ Backend not running.</strong> Open a terminal in the <code>backend/</code> folder and run:
            <code style={{display:"block",marginTop:8,padding:"8px 14px",borderRadius:6,background:"rgba(0,0,0,0.4)",color:"#80ff80",fontFamily:"monospace",fontSize:12}}>python3 app.py</code>
          </div>
        )}

        {/* PDF NOT SUPPORTED */}
        {backendOk && !pdfSupport && (
          <div style={{padding:14,borderRadius:10,background:"rgba(255,200,50,0.07)",border:"1px solid rgba(255,200,50,0.3)",marginBottom:20,fontSize:12,color:"#d4b84a"}}>
            ⚠️ PDF support not enabled. Install pdfplumber:
            <code style={{display:"block",marginTop:6,padding:"6px 12px",borderRadius:6,background:"rgba(0,0,0,0.3)",color:"#80ff80",fontFamily:"monospace",fontSize:11}}>pip install pdfplumber</code>
            Then restart <code style={{color:"#80ff80"}}>python3 app.py</code>
          </div>
        )}

        {/* ═══════ UPLOAD ═══════ */}
        {step === "upload" && (
          <div>
            <div style={{textAlign:"center",marginBottom:44}}>
              <h1 style={{fontSize:"clamp(24px,4vw,42px)",fontWeight:400,color:"#e8dcc8",marginBottom:12}}>
                Translate Legal Documents<br/>
                <span style={{color:"#c8a96e",fontStyle:"italic"}}>Into 12 Indian Regional Languages</span>
              </h1>
              <p style={{color:"#6a7a8a",fontSize:15,maxWidth:520,margin:"0 auto",lineHeight:1.8}}>
                Free to use. No subscriptions. Custom NER pipeline + Groq LLaMA 3.3 — legal terms preserved in English with regional translations in brackets.
              </p>
            </div>

            {/* Pipeline badges */}
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:36}}>
              {[
                {icon:"🧠", label:"Layer 1 · Legal NER"},
                {icon:"⚙️", label:"Layer 2 · Pre-processor"},
                {icon:"🔤", label:"Layer 3 · Groq LLaMA 3.3"},
                {icon:"⚖️", label:"Layer 4 · Post-processor"},
              ].map((b,i) => (
                <div key={i} style={{padding:"6px 16px",borderRadius:24,border:"1px solid rgba(200,169,110,0.25)",background:"rgba(200,169,110,0.05)",fontSize:12,color:"#a09070",display:"flex",gap:6,alignItems:"center"}}>
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
              style={{border:`2px dashed ${dragOver?"#c8a96e":"rgba(200,169,110,0.3)"}`,borderRadius:18,padding:"48px 32px",textAlign:"center",
                cursor:"pointer",background:dragOver?"rgba(200,169,110,0.06)":"rgba(200,169,110,0.02)",transition:"all 0.3s",marginBottom:20}}>
              <div style={{fontSize:50,marginBottom:12}}>📂</div>
              <div style={{fontSize:17,color:"#c8a96e",marginBottom:6}}>Drop your legal document here</div>
              <div style={{fontSize:13,color:"#4a5a6a",marginBottom:18}}>
                {pdfSupport ? "Supports .pdf and .txt files" : "Supports .txt files (install pdfplumber for PDF)"}
              </div>
              <div style={{display:"inline-block",...S.btn(true)}}>Browse Files</div>
              <input ref={fileRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            </div>

            {error && (
              <div style={{marginBottom:18,padding:14,borderRadius:10,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",fontSize:13,color:"#ff9090"}}>
                ⚠️ {error}
              </div>
            )}

            {/* Paste text */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:"#4a5a6a",textAlign:"center",marginBottom:12,letterSpacing:"0.1em"}}>— OR PASTE TEXT DIRECTLY —</div>
              <textarea
                placeholder="Paste your court order, petition or judgment text here..."
                value={docText}
                onChange={e=>setDocText(e.target.value)}
                style={{width:"100%",minHeight:150,padding:16,borderRadius:12,background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(200,169,110,0.2)",color:"#e8dcc8",fontSize:14,resize:"vertical",
                  outline:"none",fontFamily:"monospace",lineHeight:1.7,boxSizing:"border-box"}}
              />
              {docText.length > 50 && (
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                  <button onClick={()=>goToConfigure(docText)} style={S.btn(true)}>Continue →</button>
                </div>
              )}
            </div>

            {/* Sample */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,color:"#4a5a6a",marginBottom:12,letterSpacing:"0.1em"}}>— TRY SAMPLE —</div>
              <button onClick={()=>{setFileName("sample_order.txt");goToConfigure(SAMPLE_TEXT);}} style={S.btn(false)}>
                📋 Load Sample Court Order
              </button>
            </div>
          </div>
        )}

        {/* ═══════ CONFIGURE ═══════ */}
        {step === "configure" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
              <button onClick={reset} style={{...S.btn(false),padding:"6px 14px",fontSize:12}}>← Back</button>
              <span style={{fontSize:13,color:"#5a6a7a"}}>📄 {fileName||"pasted text"} · {docText.length.toLocaleString()} chars</span>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>

              {/* LEFT */}
              <div>
                <div style={S.tag}>DOCUMENT PREVIEW</div>
                <div style={{...S.card,height:280,overflow:"auto",fontSize:13,lineHeight:1.9,color:"#8a9aaa",fontFamily:"monospace",whiteSpace:"pre-wrap",marginBottom:18}}>
                  {docText}
                </div>

                <div style={S.tag}>🧠 LAYER 1 — NER RESULTS ({detectedTerms.length} terms found)</div>
                {detectedTerms.length > 0 ? (
                  <div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {detectedTerms.map((t,i) => {
                        const c = LABEL_COLORS[t.label] || LABEL_COLORS.ROLE;
                        return (
                          <span key={i} style={{padding:"3px 10px",borderRadius:16,border:`1px solid ${c.border}`,background:c.bg,fontSize:11,color:c.text}}>
                            {t.normalized}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{padding:12,borderRadius:8,background:"rgba(200,169,110,0.04)",border:"1px solid rgba(200,169,110,0.15)",fontSize:12,color:"#7a8a9a",lineHeight:1.7}}>
                      💡 These terms will be <strong style={{color:"#c8a96e"}}>preserved in English</strong> with regional translation in brackets.<br/>
                      Example: <span style={{color:"#c8a96e"}}>Petitioner [యాచికదారుడు]</span>
                    </div>
                  </div>
                ) : (
                  <div style={{fontSize:12,color:"#4a5a6a",padding:12,borderRadius:8,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(200,169,110,0.1)"}}>
                    No legal terms detected yet.
                  </div>
                )}

                <div style={{marginTop:16}}>
                  <div style={S.tag}>DOCUMENT TYPE</div>
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

              {/* RIGHT */}
              <div>
                <div style={S.tag}>SELECT TARGET LANGUAGE</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
                  {languages.map(lang => (
                    <button key={lang.code} onClick={()=>setTargetLang(lang.code)} style={{padding:"12px 14px",borderRadius:10,cursor:"pointer",
                      background:targetLang===lang.code?"rgba(200,169,110,0.15)":"rgba(255,255,255,0.02)",
                      border:`1px solid ${targetLang===lang.code?"#c8a96e":"rgba(200,169,110,0.15)"}`,
                      color:targetLang===lang.code?"#c8a96e":"#7a8a9a",
                      display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,textAlign:"left"}}>{lang.name}</div>
                        <div style={{fontSize:12,opacity:0.7,marginTop:2}}>{lang.native}</div>
                      </div>
                      <span>🇮🇳</span>
                    </button>
                  ))}
                </div>

                {/* Pipeline info */}
                <div style={{...S.card,marginBottom:16,border:"1px solid rgba(80,200,100,0.2)"}}>
                  <div style={{fontSize:12,color:"#50c864",marginBottom:10}}>⚙️ 4-Layer NLP Pipeline</div>
                  {[
                    {n:"01",color:"#c8a96e",label:"LegalNER",       desc:"100+ Indian legal terms detected"},
                    {n:"02",color:"#8ab4ff",label:"PreProcessor",   desc:"UUID token protection"},
                    {n:"03",color:"#50c864",label:"Groq LLaMA 3.3", desc:"Free — 500k tokens/day"},
                    {n:"04",color:"#ff9650",label:"PostProcessor",  desc:"Term [translation] inject"},
                  ].map(l => (
                    <div key={l.n} style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                      <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:9,fontWeight:700,background:"rgba(255,255,255,0.05)",color:l.color,
                        border:`1px solid ${l.color}`,flexShrink:0}}>{l.n}</div>
                      <div style={{flex:1}}>
                        <span style={{fontSize:12,fontWeight:700,color:l.color}}>{l.label}</span>
                        <span style={{fontSize:11,color:"#5a6a7a",marginLeft:6}}>{l.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <div style={{padding:12,borderRadius:8,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",fontSize:12,color:"#ff9090",marginBottom:12}}>⚠️ {error}</div>}

                <button onClick={translate} disabled={!targetLang||!backendOk}
                  style={{width:"100%",padding:14,borderRadius:10,border:"none",fontWeight:700,fontSize:15,letterSpacing:"0.05em",
                    background:targetLang&&backendOk?"linear-gradient(135deg,#c8a96e,#8b6914)":"rgba(200,169,110,0.1)",
                    color:targetLang&&backendOk?"#0a0e1a":"#4a5a6a",
                    cursor:targetLang&&backendOk?"pointer":"not-allowed",
                    boxShadow:targetLang&&backendOk?"0 4px 20px rgba(200,169,110,0.25)":"none",transition:"all 0.2s"}}>
                  {targetLang ? `Translate to ${langObj?.name} →` : "Select a language to continue"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TRANSLATING ═══════ */}
        {step === "translating" && translating && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",textAlign:"center"}}>
            <div style={{fontSize:60,marginBottom:24,animation:"spin 2s linear infinite"}}>⚙️</div>
            <h2 style={{fontSize:26,color:"#e8dcc8",marginBottom:10,fontWeight:400}}>Pipeline Running</h2>
            <p style={{color:"#5a6a7a",fontSize:15,marginBottom:36,maxWidth:420,lineHeight:1.8}}>
              Translating to <strong style={{color:"#c8a96e"}}>{langObj?.name}</strong> through the 4-layer NLP pipeline.
            </p>
            <div style={{width:"100%",maxWidth:440,marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,color:"#5a6a7a"}}>{progressLabel}</span>
                <span style={{fontSize:12,color:"#c8a96e"}}>{progress}%</span>
              </div>
              <div style={{height:5,borderRadius:3,background:"rgba(200,169,110,0.1)",overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,width:`${progress}%`,background:"linear-gradient(90deg,#8b6914,#c8a96e)",transition:"width 0.8s ease"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              {["NER Detection","Token Protection","LLM Translation","Bracket Injection"].map((p,i) => (
                <div key={i} style={{padding:"5px 14px",borderRadius:20,fontSize:12,
                  background:progress>(i+1)*20?"rgba(80,200,100,0.1)":"rgba(200,169,110,0.05)",
                  border:`1px solid ${progress>(i+1)*20?"rgba(80,200,100,0.4)":"rgba(200,169,110,0.15)"}`,
                  color:progress>(i+1)*20?"#50c864":"#5a6a7a",transition:"all 0.5s"}}>
                  {progress>(i+1)*20?"✓ ":""}{p}
                </div>
              ))}
            </div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ═══════ RESULT ═══════ */}
        {step === "result" && result && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderRadius:14,marginBottom:18,
              background:"rgba(80,200,100,0.05)",border:"1px solid rgba(80,200,100,0.2)"}}>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <span style={{fontSize:34}}>✅</span>
                <div>
                  <div style={{fontSize:16,color:"#80e880",fontWeight:600}}>Translation Complete</div>
                  <div style={{fontSize:12,color:"#5a6a7a",marginTop:3}}>
                    {result.detected_terms?.length||0} terms detected · {result.confidence?.terms_preserved||0} preserved · {result.processing_time_sec}s
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>navigator.clipboard.writeText(result.translated)} style={S.btn(false)}>📋 Copy</button>
                <button onClick={()=>{const b=new Blob([result.translated],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`translated_${targetLang}.txt`;a.click();}} style={S.btn(true)}>⬇ Download</button>
                <button onClick={reset} style={{...S.btn(false),color:"#5a6a7a"}}>New</button>
              </div>
            </div>

            {/* Confidence */}
            {result.confidence && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"Confidence",  val:`${result.confidence.overall}%`,        color:"#c8a96e"},
                  {label:"Terms Found", val:result.confidence.terms_found,           color:"#8ab4ff"},
                  {label:"Preserved",   val:result.confidence.terms_preserved,       color:"#50c864"},
                  {label:"Structure",   val:`${result.confidence.structure_score}%`, color:"#ff9650"},
                ].map((m,i)=>(
                  <div key={i} style={{...S.card,textAlign:"center",padding:"12px 8px"}}>
                    <div style={{fontSize:26,fontWeight:700,color:m.color,fontFamily:"Georgia"}}>{m.val}</div>
                    <div style={{fontSize:11,color:"#5a6a7a",marginTop:4}}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Side by side — INCREASED FONT SIZES HERE */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <div style={{padding:"4px 14px",borderRadius:20,display:"inline-block",marginBottom:10,
                  background:"rgba(100,150,255,0.1)",border:"1px solid rgba(100,150,255,0.3)",
                  fontSize:11,color:"#8ab4ff",letterSpacing:"0.1em"}}>ORIGINAL · ENGLISH</div>
                <div style={{...S.card,height:480,overflow:"auto",
                  fontSize:15,
                  lineHeight:2,
                  color:"#b0c0d0",
                  fontFamily:"Georgia,serif",
                  whiteSpace:"pre-wrap",
                  border:"1px solid rgba(100,150,255,0.15)"}}>
                  {result.original}
                </div>
              </div>
              <div>
                <div style={{padding:"4px 14px",borderRadius:20,display:"inline-block",marginBottom:10,
                  background:"rgba(200,169,110,0.1)",border:"1px solid rgba(200,169,110,0.35)",
                  fontSize:11,color:"#c8a96e",letterSpacing:"0.1em"}}>
                  TRANSLATED · {langObj?.name?.toUpperCase()} · {langObj?.native}
                </div>
                <div style={{...S.card,height:480,overflow:"auto",
                  fontSize:16,
                  lineHeight:2.2,
                  color:"#f0e4c8",
                  whiteSpace:"pre-wrap",
                  border:"1px solid rgba(200,169,110,0.2)"}}>
                  {result.translated}
                </div>
              </div>
            </div>

            {/* Layers used */}
            <div style={{...S.card,marginTop:14,border:"1px solid rgba(80,200,100,0.15)"}}>
              <div style={{fontSize:12,color:"#50c864",marginBottom:8}}>⚙️ Layers Used in This Translation</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(result.layers_used||[]).map((l,i)=>(
                  <span key={i} style={{padding:"3px 12px",borderRadius:16,background:"rgba(80,200,100,0.07)",border:"1px solid rgba(80,200,100,0.25)",fontSize:11,color:"#70d870"}}>✓ {l}</span>
                ))}
              </div>
            </div>

            <div style={{marginTop:12,padding:12,borderRadius:8,background:"rgba(255,150,50,0.05)",border:"1px solid rgba(255,150,50,0.2)",fontSize:12,color:"#8a7a6a"}}>
              ⚠️ <strong style={{color:"#c0a060"}}>Legal Disclaimer:</strong> AI-generated for accessibility only. For official court proceedings, obtain a certified legal translation.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}