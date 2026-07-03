import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listFolderTree, listRootFolders } from "@/lib/drive"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const accessToken = (session as any)?.accessToken
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rootId = req.nextUrl.searchParams.get("rootId")

  if (!rootId) {
    const roots = await listRootFolders(accessToken)
    return NextResponse.json({ folders: roots })
  }

  const folders = await listFolderTree(accessToken, rootId)
  return NextResponse.json({ folders })
}
