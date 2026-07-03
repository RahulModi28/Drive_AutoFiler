import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { classifyFile, extractText } from "@/lib/classify"
import { uploadFileToDrive, listFolderTree } from "@/lib/drive"
import { insertLog, initDB } from "@/lib/db"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const accessToken = (session as any)?.accessToken
  const userEmail = (session as any)?.user?.email

  if (!accessToken || !userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await initDB()

  const form = await req.formData()
  const file = form.get("file") as File | null
  const rootFolderId = form.get("rootFolderId") as string | null

  if (!file || !rootFolderId) {
    return NextResponse.json({ error: "Missing file or rootFolderId" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || "application/octet-stream"

  // Extract text snippet
  const snippet = await extractText(buffer, mimeType)

  // Get folder tree
  const folders = await listFolderTree(accessToken, rootFolderId)

  if (folders.length === 0) {
    return NextResponse.json({ error: "No subfolders found under that root folder." }, { status: 400 })
  }

  // Classify with Gemini
  const decision = await classifyFile(file.name, snippet, folders)

  const isConfident =
    decision.folder_id && decision.confidence !== "low"

  let driveLink: string | undefined
  let finalDecision = isConfident ? "filed" : "needs_review"

  if (isConfident && decision.folder_id) {
    try {
      const uploaded = await uploadFileToDrive(
        accessToken,
        file.name,
        mimeType,
        buffer,
        decision.folder_id
      )
      driveLink = uploaded.webViewLink
    } catch (err: any) {
      finalDecision = "needs_review"
      decision.reason = `Upload failed: ${err.message}`
    }
  }

  await insertLog({
    userEmail,
    filename: file.name,
    decision: finalDecision,
    folderPath: decision.folder_path ?? undefined,
    folderId: decision.folder_id ?? undefined,
    confidence: decision.confidence,
    reason: decision.reason,
    driveLink,
  })

  return NextResponse.json({
    decision: finalDecision,
    folderPath: decision.folder_path,
    confidence: decision.confidence,
    reason: decision.reason,
    driveLink,
  })
}
