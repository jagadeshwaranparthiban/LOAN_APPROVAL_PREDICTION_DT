import { useState, useRef } from "react";

const API_URL = "http://localhost:8000";

const defaultForm = {
  gender: "Male",
  married: "Yes",
  dependents: 0,
  education: "Graduate",
  self_employed: "No",
  applicant_income: "",
  coapplicant_income: "",
  loan_amount: "",
  loan_amount_term: 360,
  credit_history: 1,
  employment_length: "",
  age: "",
  property_area: "Urban",
};

/* ── Field wrapper ─────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-slate-800/60 border border-slate-700/60 text-slate-100 text-sm px-3 py-2.5 rounded-lg " +
  "focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-all duration-200 " +
  "placeholder:text-slate-600";

function Input({ label, ...props }) {
  return (
    <Field label={label}>
      <input className={inputCls} {...props} />
    </Field>
  );
}

function Select({ label, options, ...props }) {
  return (
    <Field label={label}>
      <select className={inputCls + " cursor-pointer"} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-800">
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/* ── Animated confidence arc (SVG half-circle) ─────────── */
function ConfidenceArc({ value, approved }) {
  const pct = Math.round(value * 100);
  const circumference = Math.PI * 54;
  const dash = (pct / 100) * circumference;
  const color = approved ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="140" height="82" viewBox="0 0 140 82">
        <path d="M 10 76 A 60 60 0 0 1 130 76" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 10 76 A 60 60 0 0 1 130 76"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x="70" y="70" textAnchor="middle" fontSize="22" fontWeight="700"
          fill={color} fontFamily="Georgia, serif">
          {pct}%
        </text>
      </svg>
      <p className="text-[10px] tracking-widest text-slate-500 uppercase">Confidence</p>
    </div>
  );
}

/* ── Key factor row ─────────────────────────────────────── */
function Factor({ label, positive }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/80 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${positive ? "bg-amber-400" : "bg-slate-600"}`} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className={`text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full border ${
        positive
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : "bg-slate-700/50 text-slate-500 border-slate-700"
      }`}>
        {positive ? "Positive" : "Negative"}
      </span>
    </div>
  );
}

/* ── Section heading with rule ──────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  );
}

/* ── Bouncing dot loader ─────────────────────────────────── */
function Loader() {
  return (
    <div className="flex items-center justify-center flex-1 py-24">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-amber-500/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Root component
═══════════════════════════════════════════════════════════════ */
export default function LoanPredictor() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setRevealed(false);

    try {
      const payload = {
        gender: form.gender,
        married: form.married,
        dependents: parseInt(form.dependents),
        education: form.education,
        self_employed: form.self_employed,
        applicant_income: parseFloat(form.applicant_income),
        coapplicant_income: parseFloat(form.coapplicant_income) || 0,
        loan_amount: parseFloat(form.loan_amount),
        loan_amount_term: parseFloat(form.loan_amount_term),
        credit_history: parseInt(form.credit_history),
        employment_length: parseInt(form.employment_length),
        age: parseInt(form.age),
        property_area: form.property_area,
      };

      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Prediction failed");
      }

      const data = await res.json();
      setResult(data);
      setTimeout(() => setRevealed(true), 60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const factors = result
    ? [
        { label: "Credit history", positive: form.credit_history == 1 },
        { label: "Graduate education", positive: form.education === "Graduate" },
        { label: "Co-applicant income present", positive: parseFloat(form.coapplicant_income) > 0 },
        { label: "Not self-employed", positive: form.self_employed === "No" },
        {
          label: "Loan-to-income ratio acceptable",
          positive: parseFloat(form.loan_amount) * 1000 < parseFloat(form.applicant_income) * 3,
        },
      ]
    : [];

  const totalIncome =
    (parseFloat(form.applicant_income) || 0) +
    (parseFloat(form.coapplicant_income) || 0);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Google font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>

      {/* ── Header ───────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-xl bg-amber-500/15 rotate-6" />
            <div className="relative w-9 h-9 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">LoanSight</p>
            <p className="text-[10px] text-slate-500 tracking-widest uppercase">Credit Assessment</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-500 border border-slate-800 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Decision Tree · Active
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — form panel */}
        <aside className="w-[46%] overflow-y-auto border-r border-slate-800/60 px-8 py-7">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Personal */}
            <section>
              <SectionLabel>Personal</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Gender" name="gender" value={form.gender} onChange={handleChange}
                  options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
                <Select label="Marital Status" name="married" value={form.married} onChange={handleChange}
                  options={[{ value: "Yes", label: "Married" }, { value: "No", label: "Single" }]} />
                <Input label="Age" name="age" type="number" value={form.age}
                  onChange={handleChange} placeholder="e.g. 32" min={18} />
                <Select label="Dependents" name="dependents" value={form.dependents} onChange={handleChange}
                  options={[0,1,2,3,4,5].map((n) => ({ value: n, label: n === 5 ? "5+" : String(n) }))} />
                <Select label="Education" name="education" value={form.education} onChange={handleChange}
                  options={[{ value: "Graduate", label: "Graduate" }, { value: "Not Graduate", label: "Not Graduate" }]} />
                <Select label="Self Employed" name="self_employed" value={form.self_employed} onChange={handleChange}
                  options={[{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]} />
              </div>
            </section>

            {/* Financial */}
            <section>
              <SectionLabel>Financial</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Applicant Income (₹)" name="applicant_income" type="number"
                  value={form.applicant_income} onChange={handleChange} placeholder="e.g. 5500" min={0} />
                <Input label="Co-applicant Income (₹)" name="coapplicant_income" type="number"
                  value={form.coapplicant_income} onChange={handleChange} placeholder="e.g. 1500" min={0} />
                <Input label="Employment Length (yrs)" name="employment_length" type="number"
                  value={form.employment_length} onChange={handleChange} placeholder="e.g. 6" min={0} />
                <Select label="Credit History" name="credit_history" value={form.credit_history} onChange={handleChange}
                  options={[{ value: 1, label: "Good (met guidelines)" }, { value: 0, label: "Bad (not met)" }]} />
              </div>
            </section>

            {/* Loan */}
            <section>
              <SectionLabel>Loan Details</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Loan Amount (₹000s)" name="loan_amount" type="number"
                  value={form.loan_amount} onChange={handleChange} placeholder="e.g. 150" min={1} />
                <Select label="Loan Term" name="loan_amount_term" value={form.loan_amount_term} onChange={handleChange}
                  options={[12,36,60,84,120,180,240,300,360,480].map((n) => ({ value: n, label: `${n} months` }))} />
                <div className="col-span-2">
                  <Select label="Property Area" name="property_area" value={form.property_area} onChange={handleChange}
                    options={[
                      { value: "Urban", label: "Urban" },
                      { value: "Semiurban", label: "Semiurban" },
                      { value: "Rural", label: "Rural" },
                    ]} />
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="pt-1 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide
                  bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-[0_0_28px_rgba(245,158,11,0.22)]"
              >
                {loading ? "Analysing…" : "Run Credit Assessment →"}
              </button>

              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          </form>
        </aside>

        {/* RIGHT — result panel */}
        <main className="w-[54%] overflow-y-auto bg-slate-950 px-8 py-7 flex flex-col gap-5">

          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-24">
              <div className="w-16 h-16 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Awaiting assessment</p>
                <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                  Fill in the applicant's profile and run the assessment to see the credit decision here.
                </p>
              </div>
            </div>
          )}

          {loading && <Loader />}

          {result && (
            <div
              className="flex flex-col gap-4"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(14px)",
                transition: "opacity 0.45s ease, transform 0.45s ease",
              }}
            >
              {/* Verdict banner */}
              <div className={`relative overflow-hidden rounded-2xl border px-7 py-6 ${
                result.approved
                  ? "bg-gradient-to-br from-amber-950/30 to-slate-900/60 border-amber-500/25"
                  : "bg-gradient-to-br from-red-950/30 to-slate-900/60 border-red-500/20"
              }`}>
                <div className={`absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl opacity-15 ${
                  result.approved ? "bg-amber-400" : "bg-red-500"
                }`} />
                <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-slate-500 mb-1.5">
                  Loan Decision
                </p>
                <p
                  className={`text-5xl font-bold tracking-tight leading-none ${
                    result.approved ? "text-amber-400" : "text-red-400"
                  }`}
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {result.label}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  Decision Tree Classifier ·{" "}
                  {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {/* Confidence + stats row */}
              <div className="grid grid-cols-5 gap-4">
                {/* Arc — spans 2 cols */}
                <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center py-5">
                  <ConfidenceArc value={result.confidence} approved={result.approved} />
                </div>

                {/* 2×2 stat cards — spans 3 cols */}
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "Total Income", value: `₹${totalIncome.toLocaleString("en-IN")}` },
                    { label: "Loan Amount", value: `₹${(parseFloat(form.loan_amount) * 1000).toLocaleString("en-IN")}` },
                    { label: "Term", value: `${form.loan_amount_term} months` },
                    { label: "Property Area", value: form.property_area },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                      <p className="text-[10px] tracking-widest text-slate-500 uppercase mb-1">{label}</p>
                      <p className="text-sm font-semibold text-slate-200">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key factors */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-5">
                <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-slate-500 mb-1">
                  Key Factors
                </p>
                <div>
                  {factors.map((f) => (
                    <Factor key={f.label} label={f.label} positive={f.positive} />
                  ))}
                </div>
              </div>

              {/* Applicant snapshot */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4">
                <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-slate-500 mb-3">
                  Applicant Snapshot
                </p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                  {[
                    { label: "Age", value: `${form.age} yrs` },
                    { label: "Education", value: form.education },
                    { label: "Dependents", value: form.dependents },
                    { label: "Marital", value: form.married === "Yes" ? "Married" : "Single" },
                    { label: "Credit", value: form.credit_history == 1 ? "Good" : "Bad" },
                    { label: "Employment", value: `${form.employment_length} yrs` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-slate-600 mb-0.5">{label}</p>
                      <p className="text-xs font-medium text-slate-300">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={() => { setResult(null); setForm(defaultForm); setRevealed(false); }}
                className="w-full py-3 text-xs font-semibold tracking-widest uppercase text-slate-500
                  border border-slate-800 rounded-xl hover:border-slate-700 hover:text-slate-300
                  transition-all duration-200"
              >
                New Assessment
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}