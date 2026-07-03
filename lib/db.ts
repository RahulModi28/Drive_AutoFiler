import { neon } from "@neondatabase/serverless"

function getSQL() {
  const url =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.NEXTAUTH_POSTGRES_URL ??
    process.env.NEXTAUTH_DATABASE_URL
  if (!url) throw new Error("No Postgres connection string found.")
  return neon(url)
}

export async function initDB() {
  const sql = getSQL()
  await sql`
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
  `
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
  const sql = getSQL()
  await sql`
    INSERT INTO filing_log
      (user_email, filename, decision, folder_path, folder_id, confidence, reason, drive_link)
    VALUES
      (${entry.userEmail}, ${entry.filename}, ${entry.decision},
       ${entry.folderPath ?? null}, ${entry.folderId ?? null},
       ${entry.confidence ?? null}, ${entry.reason ?? null}, ${entry.driveLink ?? null})
  `
}

export async function getLogs(userEmail: string, limit = 50) {
  const sql = getSQL()
  const rows = await sql`
    SELECT * FROM filing_log
    WHERE user_email = ${userEmail}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows
}

export async function getStats(userEmail: string) {
  const sql = getSQL()

  const today = await sql`
    SELECT COUNT(*) as count FROM filing_log
    WHERE user_email = ${userEmail}
      AND decision = 'filed'
      AND created_at >= NOW() - INTERVAL '1 day'
  `
  const review = await sql`
    SELECT COUNT(*) as count FROM filing_log
    WHERE user_email = ${userEmail} AND decision = 'needs_review'
      AND created_at >= NOW() - INTERVAL '1 day'
  `
  const total = await sql`
    SELECT COUNT(*) as count FROM filing_log
    WHERE user_email = ${userEmail} AND decision = 'filed'
  `
  const conf = await sql`
    SELECT confidence, COUNT(*) as count FROM filing_log
    WHERE user_email = ${userEmail} AND decision = 'filed'
    GROUP BY confidence
  `
  const topFolders = await sql`
    SELECT folder_path, COUNT(*) as count FROM filing_log
    WHERE user_email = ${userEmail} AND decision = 'filed'
    GROUP BY folder_path ORDER BY count DESC LIMIT 6
  `
  const weekly = await sql`
    SELECT
      TO_CHAR(created_at, 'Dy') as day,
      SUM(CASE WHEN decision='filed' THEN 1 ELSE 0 END) as filed,
      SUM(CASE WHEN decision='needs_review' THEN 1 ELSE 0 END) as review
    FROM filing_log
    WHERE user_email = ${userEmail}
      AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY TO_CHAR(created_at, 'Dy'), DATE_TRUNC('day', created_at)
    ORDER BY DATE_TRUNC('day', created_at)
  `
  return {
    filedToday: Number(today[0]?.count ?? 0),
    reviewToday: Number(review[0]?.count ?? 0),
    totalFiled: Number(total[0]?.count ?? 0),
    confidence: conf,
    topFolders,
    weekly,
  }
}
