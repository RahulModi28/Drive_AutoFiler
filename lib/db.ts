import { Pool } from "@neondatabase/serverless"

function getPool() {
  const url =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.NEXTAUTH_POSTGRES_URL_NON_POOLING ??
    process.env.NEXTAUTH_DATABASE_URL_UNPOOLED ??
    process.env.NEXTAUTH_POSTGRES_URL ??
    process.env.NEXTAUTH_DATABASE_URL
  if (!url) throw new Error("No Postgres connection string found.")
  return new Pool({ connectionString: url })
}

export async function initDB() {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS filing_log (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      filename TEXT NOT NULL,
      decision TEXT NOT NULL,
      folder_path TEXT,
      folder_id TEXT,
      confidence TEXT,
      reason TEXT,
      drive_link TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.end()
}

export async function insertLog(entry: {
  userEmail: string
  filename: string
  decision: string
  folderPath?: string
  folderId?: string
  confidence?: string
  reason?: string
  driveLink?: string
}) {
  const pool = getPool()
  await pool.query(
    `INSERT INTO filing_log
      (user_email, filename, decision, folder_path, folder_id, confidence, reason, drive_link)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      entry.userEmail, entry.filename, entry.decision,
      entry.folderPath ?? null, entry.folderId ?? null,
      entry.confidence ?? null, entry.reason ?? null, entry.driveLink ?? null,
    ]
  )
  await pool.end()
}

export async function getLogs(userEmail: string, limit = 50) {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT * FROM filing_log WHERE user_email = $1 ORDER BY created_at DESC LIMIT $2`,
    [userEmail, limit]
  )
  await pool.end()
  return rows
}

export async function getStats(userEmail: string) {
  const pool = getPool()

  const { rows: today } = await pool.query(
    `SELECT COUNT(*) as count FROM filing_log WHERE user_email=$1 AND decision='filed' AND created_at >= NOW() - INTERVAL '1 day'`,
    [userEmail]
  )
  const { rows: review } = await pool.query(
    `SELECT COUNT(*) as count FROM filing_log WHERE user_email=$1 AND decision='needs_review' AND created_at >= NOW() - INTERVAL '1 day'`,
    [userEmail]
  )
  const { rows: total } = await pool.query(
    `SELECT COUNT(*) as count FROM filing_log WHERE user_email=$1 AND decision='filed'`,
    [userEmail]
  )
  const { rows: conf } = await pool.query(
    `SELECT confidence, COUNT(*) as count FROM filing_log WHERE user_email=$1 AND decision='filed' GROUP BY confidence`,
    [userEmail]
  )
  const { rows: topFolders } = await pool.query(
    `SELECT folder_path, COUNT(*) as count FROM filing_log WHERE user_email=$1 AND decision='filed' GROUP BY folder_path ORDER BY count DESC LIMIT 6`,
    [userEmail]
  )
  const { rows: weekly } = await pool.query(
    `SELECT TO_CHAR(created_at,'Dy') as day,
       SUM(CASE WHEN decision='filed' THEN 1 ELSE 0 END) as filed,
       SUM(CASE WHEN decision='needs_review' THEN 1 ELSE 0 END) as review
     FROM filing_log WHERE user_email=$1 AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY TO_CHAR(created_at,'Dy'), DATE_TRUNC('day',created_at)
     ORDER BY DATE_TRUNC('day',created_at)`,
    [userEmail]
  )

  await pool.end()
  return {
    filedToday: Number(today[0]?.count ?? 0),
    reviewToday: Number(review[0]?.count ?? 0),
    totalFiled: Number(total[0]?.count ?? 0),
    confidence: conf,
    topFolders,
    weekly,
  }
}
