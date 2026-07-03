import { google } from "googleapis"

export function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: "v3", auth })
}

export async function listFolderTree(
  accessToken: string,
  rootId: string,
  rootPath = ""
): Promise<{ id: string; path: string }[]> {
  const drive = getDriveClient(accessToken)
  const folders: { id: string; path: string }[] = []

  const res = await drive.files.list({
    q: `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 200,
  })

  for (const f of res.data.files ?? []) {
    if (!f.id || !f.name) continue
    const path = rootPath ? `${rootPath}/${f.name}` : f.name
    folders.push({ id: f.id, path })
    const children = await listFolderTree(accessToken, f.id, path)
    folders.push(...children)
  }
  return folders
}

export async function listRootFolders(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const drive = getDriveClient(accessToken)

  // Try root children first
  const rootRes = await drive.files.list({
    q: "'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id,name)",
    pageSize: 50,
  })

  // Also fetch "My Drive" top-level folders (accounts where root != my drive)
  const myDriveRes = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false and 'me' in owners",
    fields: "files(id,name,parents)",
    pageSize: 100,
    spaces: "drive",
  })

  // Merge, deduplicate by id
  const seen = new Set<string>()
  const all: { id: string; name: string }[] = []

  for (const f of [...(rootRes.data.files ?? []), ...(myDriveRes.data.files ?? [])]) {
    if (f.id && f.name && !seen.has(f.id)) {
      seen.add(f.id)
      all.push({ id: f.id, name: f.name })
    }
  }

  return all.sort((a, b) => a.name.localeCompare(b.name))
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = getDriveClient(accessToken)
  const { Readable } = await import("stream")
  const stream = Readable.from(buffer)

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: "id,webViewLink",
  })
  return {
    id: res.data.id!,
    webViewLink: res.data.webViewLink ?? "",
  }
}
