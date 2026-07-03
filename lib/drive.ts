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
  const res = await drive.files.list({
    q: "'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id,name)",
    pageSize: 50,
  })
  return (res.data.files ?? []).filter(
    (f): f is { id: string; name: string } => !!f.id && !!f.name
  )
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
