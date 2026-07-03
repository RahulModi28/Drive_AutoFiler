import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getLogs, getStats, initDB } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = (session as any)?.user?.email
  if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await initDB()

  const type = req.nextUrl.searchParams.get("type")

  if (type === "stats") {
    const stats = await getStats(userEmail)
    return NextResponse.json(stats)
  }

  const logs = await getLogs(userEmail, 50)
  return NextResponse.json({ logs })
}
