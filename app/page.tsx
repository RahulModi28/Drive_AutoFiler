"use client"
import { useSession, signIn, signOut } from "next-auth/react"
import { useEffect, useRef, useState, useCallback } from "react"
import styles from "./page.module.css"

type LogEntry = {
  id: number
  filename: string
  decision: string
  folder_path: string | null
  confidence: string | null
  reason: string | null
  drive_link: string | null
  created_at: string
}

type Stats = {
  filedToday: number
  reviewToday: number
  totalFiled: number
  confidence: { confidence: string; count: string }[]
  topFolders: { folder_path: string; count: string }[]
  weekly: { day: string; filed: string; review: string }[]
}

type Folder = { id: string; name?: string; path?: string }
type FileResult = {
  decision: string
  folderPath: string | null
  confidence: string
  reason: string
  driveLink?: string
}

export default function Home() {
  const { data: session, status } = useSession()
  const [rootFolders, setRootFolders] = useState<Folder[]>([])
  const [rootFolderId, setRootFolderId] = useState("")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<FileResult[]>([])
  const [tab, setTab] = useState<"all" | "filed" | "review">("all")
  const [loadingData, setLoadingData] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch("/api/log"),
        fetch("/api/log?type=stats"),
      ])
      const logsData = await logsRes.json()
      const statsData = await statsRes.json()
      setLogs(logsData.logs ?? [])
      setStats(statsData)
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetch("/api/folders")
        .then((r) => r.json())
        .then((d) => setRootFolders(d.folders ?? []))
      loadData()
    }
  }, [session, loadData])

  async function handleFiles(files: FileList | null) {
    if (!files || !rootFolderId) return
    setUploading(true)
    const newResults: FileResult[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("rootFolderId", rootFolderId)
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        const data = await res.json()
        newResults.push({ ...data })
      } catch {
        newResults.push({ decision: "error", folderPath: null, confidence: "low", reason: "Upload failed" })
      }
    }
    setResults((p) => [...newResults, ...p])
    setUploading(false)
    loadData()
  }

  const filteredLogs = logs.filter((l) =>
    tab === "all" ? true : tab === "filed" ? l.decision === "filed" : l.decision === "needs_review"
  )

  const confidenceMap: Record<string, number> = {}
  stats?.confidence.forEach((c) => { confidenceMap[c.confidence] = Number(c.count) })
  const totalConf = Object.values(confidenceMap).reduce((a, b) => a + b, 0)
  const pct = (k: string) => totalConf ? Math.round((confidenceMap[k] ?? 0) / totalConf * 100) : 0

  const maxFolder = Math.max(...(stats?.topFolders.map((f) => Number(f.count)) ?? [1]), 1)

  if (status === "loading") return (
    <div className={styles.centered}><div className={styles.spinner}></div></div>
  )

  if (!session) return (
    <div className={styles.login}>
      <div className={styles.loginCard}>
        <div className={styles.loginIcon}>📂</div>
        <h1>Drive auto-filer</h1>
        <p>Sign in with Google to start filing documents automatically with AI.</p>
        <button className={styles.btnPrimary} onClick={() => signIn("google")}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
        <p className={styles.note}>Only accesses the Drive folders you select. No data is stored without your action.</p>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Drive Auto-Filer Dashboard</h1>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>📂</span>
          <span className={styles.logoText}>Drive auto-filer</span>
        </div>
        <div className={styles.headerRight}>
          <img src={session.user?.image ?? ""} alt="" className={styles.avatar} width={28} height={28} />
          <span className={styles.userName}>{session.user?.name}</span>
          <button className={styles.btnGhost} onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>

        {/* Folder picker */}
        <section className={styles.folderPicker}>
          <label className={styles.pickerLabel}>Root Drive folder to file into</label>
          <select
            className={styles.select}
            value={rootFolderId}
            onChange={(e) => setRootFolderId(e.target.value)}
          >
            <option value="">Select a folder…</option>
            {rootFolders.map((f) => (
              <option key={f.id} value={f.id}>{f.name ?? f.path}</option>
            ))}
          </select>
          {!rootFolderId && (
            <span className={styles.pickerHint}>Choose a folder first, then drop files below.</span>
          )}
        </section>

        {/* KPIs */}
        <div className={styles.kpiRow}>
          {[
            { label: "Filed today", value: stats?.filedToday ?? "—", color: "var(--accent)" },
            { label: "Needs review", value: stats?.reviewToday ?? "—", color: "var(--warning)" },
            { label: "Accuracy", value: totalConf ? `${pct("high") + pct("medium")}%` : "—", color: "var(--success)" },
            { label: "All time filed", value: stats?.totalFiled?.toLocaleString() ?? "—", color: "var(--text)" },
          ].map((k) => (
            <div key={k.label} className={styles.kpi}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiVal} style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className={styles.grid2}>
          {/* Drop zone */}
          <section>
            <div
              className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ""} ${!rootFolderId ? styles.dropzoneDisabled : ""}`}
              onDragOver={(e) => { e.preventDefault(); if (rootFolderId) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => rootFolderId && fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Drop files here or click to browse"
              onKeyDown={(e) => e.key === "Enter" && rootFolderId && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
              {uploading ? (
                <><div className={styles.spinner}></div><p>Classifying and filing…</p></>
              ) : (
                <>
                  <div className={styles.dropIcon}>📄</div>
                  <p className={styles.dropMain}>Drop files here</p>
                  <p className={styles.dropSub}>or click to browse · PDF, DOCX, TXT, XLSX supported</p>
                </>
              )}
            </div>

            {/* Upload results */}
            {results.length > 0 && (
              <div className={styles.resultsBox}>
                {results.slice(0, 5).map((r, i) => (
                  <div key={i} className={styles.resultRow}>
                    <span className={`${styles.badge} ${
                      r.decision === "filed" ? styles.badgeSuccess :
                      r.decision === "needs_review" ? styles.badgeWarning : styles.badgeDanger
                    }`}>
                      {r.decision === "filed" ? "✓ Filed" : r.decision === "needs_review" ? "⚠ Review" : "✕ Error"}
                    </span>
                    <span className={styles.resultPath}>{r.folderPath ?? r.reason}</span>
                    {r.driveLink && (
                      <a href={r.driveLink} target="_blank" rel="noreferrer" className={styles.driveLink}>Open ↗</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top folders */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Top folders by volume</h2>
            {(stats?.topFolders.length ?? 0) === 0 ? (
              <p className={styles.empty}>No filings yet — drop some files to get started.</p>
            ) : (
              stats?.topFolders.map((f) => (
                <div key={f.folder_path} className={styles.folderRow}>
                  <span className={styles.folderName}>📁 {f.folder_path?.split("/").pop()}</span>
                  <div className={styles.barBg}>
                    <div className={styles.barFill} style={{ width: `${Math.round(Number(f.count) / maxFolder * 100)}%` }}></div>
                  </div>
                  <span className={styles.folderCount}>{f.count}</span>
                </div>
              ))
            )}
          </section>
        </div>

        <div className={styles.grid2}>
          {/* Confidence */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Confidence breakdown</h2>
            {totalConf === 0 ? (
              <p className={styles.empty}>No data yet.</p>
            ) : (
              <>
                <div className={styles.confBar}>
                  {pct("high") > 0 && <div style={{ width: `${pct("high")}%`, background: "var(--accent)", height: "100%", borderRadius: "4px 0 0 4px" }}></div>}
                  {pct("medium") > 0 && <div style={{ width: `${pct("medium")}%`, background: "var(--success)", height: "100%" }}></div>}
                  {pct("low") > 0 && <div style={{ width: `${pct("low")}%`, background: "var(--warning)", height: "100%", borderRadius: "0 4px 4px 0" }}></div>}
                </div>
                <div className={styles.confLegend}>
                  {[["high","var(--accent)"],["medium","var(--success)"],["low","var(--warning)"]].map(([k,c]) => (
                    <span key={k} className={styles.confItem}>
                      <span className={styles.confDot} style={{ background: c }}></span>
                      {k.charAt(0).toUpperCase()+k.slice(1)} {pct(k)}%
                    </span>
                  ))}
                </div>
                <div className={styles.confNums}>
                  {[["High","high","var(--accent)"],["Medium","medium","var(--success)"],["Review","low","var(--warning)"]].map(([label,k,c]) => (
                    <div key={k} className={styles.confNum}>
                      <span className={styles.confNumVal} style={{ color: c }}>{pct(k)}%</span>
                      <span className={styles.confNumLabel}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Weekly */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Activity — last 7 days</h2>
            {(stats?.weekly.length ?? 0) === 0 ? (
              <p className={styles.empty}>No activity yet.</p>
            ) : (
              <div className={styles.weekChart}>
                {stats?.weekly.map((w) => {
                  const total = Number(w.filed) + Number(w.review)
                  const maxW = Math.max(...(stats?.weekly.map((x) => Number(x.filed) + Number(x.review)) ?? [1]), 1)
                  return (
                    <div key={w.day} className={styles.weekCol}>
                      <span className={styles.weekVal}>{total}</span>
                      <div className={styles.weekBar} style={{ height: `${Math.round(total / maxW * 80)}px` }}>
                        <div style={{ height: `${total ? Math.round(Number(w.review) / total * 100) : 0}%`, background: "var(--warning)", borderRadius: "3px 3px 0 0" }}></div>
                        <div style={{ flex: 1, background: "var(--accent)" }}></div>
                      </div>
                      <span className={styles.weekDay}>{w.day}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Log table */}
        <section className={styles.card}>
          <div className={styles.logHeader}>
            <h2 className={styles.cardTitle} style={{ margin: 0 }}>Filing log</h2>
            <div className={styles.tabs}>
              {(["all","filed","review"] as const).map((t) => (
                <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`} onClick={() => setTab(t)}>
                  {t === "all" ? "All" : t === "filed" ? "Filed" : "Needs review"}
                </button>
              ))}
            </div>
            <button className={styles.btnGhost} onClick={loadData} disabled={loadingData}>
              {loadingData ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {filteredLogs.length === 0 ? (
            <p className={styles.empty} style={{ textAlign: "center", padding: "2rem" }}>
              {tab === "review" ? "No items need review — great accuracy!" : "No filings yet. Drop some files above to get started."}
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Destination</th>
                    <th>Confidence</th>
                    <th>Reason</th>
                    <th>Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className={styles.fileExt}>{l.filename.split(".").pop()?.toUpperCase()}</span>
                        <span className={styles.fileName}>{l.filename}</span>
                      </td>
                      <td className={styles.folderCell}>{l.folder_path ?? "—"}</td>
                      <td>
                        <span className={`${styles.badge} ${
                          l.confidence === "high" ? styles.badgeSuccess :
                          l.confidence === "medium" ? styles.badgeAccent : styles.badgeWarning
                        }`}>{l.confidence ?? "—"}</span>
                      </td>
                      <td className={styles.reasonCell}>{l.reason ?? "—"}</td>
                      <td className={styles.timeCell}>
                        {new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>
                        {l.drive_link && (
                          <a href={l.drive_link} target="_blank" rel="noreferrer" className={styles.driveLink}>Open ↗</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
