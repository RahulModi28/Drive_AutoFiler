import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface ClassifyResult {
  folder_id: string | null
  folder_path: string | null
  confidence: "high" | "medium" | "low"
  reason: string
}

export async function classifyFile(
  filename: string,
  snippet: string,
  folders: { id: string; path: string }[]
): Promise<ClassifyResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const folderList = folders
    .map((f) => `- ${f.path} (id: ${f.id})`)
    .join("\n")

  const prompt = `You are filing a document into the correct Google Drive folder.

FILE NAME: ${filename}

FILE CONTENT SNIPPET:
${snippet.slice(0, 3000)}

AVAILABLE FOLDERS:
${folderList}

Pick the single best-matching folder. Respond ONLY with a raw JSON object — no markdown, no backticks, no explanation:
{"folder_id":"<id or null>","folder_path":"<path or null>","confidence":"high|medium|low","reason":"<one short sentence>"}`

  const result = await model.generateContent(prompt)
  const raw = result.response.text().trim().replace(/```json|```/g, "").trim()

  try {
    return JSON.parse(raw)
  } catch {
    return {
      folder_id: null,
      folder_path: null,
      confidence: "low",
      reason: `Could not parse model response: ${raw.slice(0, 100)}`,
    }
  }
}

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "text/plain" || mimeType === "text/csv" || mimeType === "text/markdown") {
    return buffer.toString("utf-8").slice(0, 4000)
  }
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default
    const data = await pdfParse(buffer)
    return data.text.slice(0, 4000)
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return result.value.slice(0, 4000)
  }
  return `[No text extracted — filing based on filename: ${mimeType}]`
}
