// Google Picker integration for selecting a single Google Sheet.
//
// Why the Picker (and not pasting a URL): we use the non-sensitive drive.file
// OAuth scope, which grants access ONLY to files the user explicitly hands us
// through the Picker. The selection also persists the grant for our OAuth client,
// so the backend's scheduled sync can keep reading the picked sheet. A pasted URL
// would not be accessible under drive.file.
//
// The picker needs three things from the backend (GET /picker-config): a fresh
// drive.file access token, a browser API key, and the numeric Cloud project number
// (appId). The appId is what ties the selection to our OAuth client.

const GAPI_SRC = 'https://apis.google.com/js/api.js'

// Minimal typing for the globals the gapi script injects. We avoid pulling in
// @types/gapi for one feature; `any` is contained to this module.
declare global {
  interface Window {
    gapi?: any
    google?: any
  }
}

export interface PickerConfig {
  accessToken: string
  apiKey: string
  appId: string
  configured: boolean
}

export interface PickedSheet {
  id: string
  name: string
  url: string
}

let pickerLoad: Promise<void> | null = null

// Loads the gapi script once and the 'picker' module. Idempotent: concurrent and
// repeat callers share the same in-flight promise.
function loadPickerApi(): Promise<void> {
  if (pickerLoad) return pickerLoad

  pickerLoad = new Promise<void>((resolve, reject) => {
    const onScriptReady = () => {
      if (!window.gapi) {
        reject(new Error('Google API script loaded but gapi is undefined'))
        return
      }
      window.gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Failed to load the Google Picker module')),
      })
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SRC}"]`)
    if (existing) {
      if (window.gapi) onScriptReady()
      else existing.addEventListener('load', onScriptReady, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GAPI_SRC
    script.async = true
    script.defer = true
    script.onload = onScriptReady
    script.onerror = () => reject(new Error('Failed to load the Google API script'))
    document.body.appendChild(script)
  })

  // If loading fails, clear the cache so a later attempt can retry.
  pickerLoad.catch(() => { pickerLoad = null })
  return pickerLoad
}

/**
 * Opens the Google Picker limited to spreadsheets and resolves with the chosen
 * sheet, or null if the user cancels. Rejects only on load/setup failure.
 */
export async function openSheetPicker(config: PickerConfig): Promise<PickedSheet | null> {
  await loadPickerApi()
  const google = window.google
  if (!google?.picker) throw new Error('Google Picker is unavailable')

  return new Promise<PickedSheet | null>((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)

    const picker = new google.picker.PickerBuilder()
      .setAppId(config.appId)
      .setOAuthToken(config.accessToken)
      .setDeveloperKey(config.apiKey)
      .addView(view)
      .setCallback((data: any) => {
        const action = data[google.picker.Response.ACTION]
        if (action === google.picker.Action.PICKED) {
          const doc = data[google.picker.Response.DOCUMENTS][0]
          resolve({
            id: doc[google.picker.Document.ID],
            name: doc[google.picker.Document.NAME],
            url: doc[google.picker.Document.URL],
          })
        } else if (action === google.picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()

    picker.setVisible(true)
  })
}

// The backend stores sheets as a canonical edit URL and derives the spreadsheet id
// from it, so build that shape from the Picker's file id rather than trusting the
// Picker's url verbatim.
export function canonicalSheetUrl(fileId: string): string {
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit`
}
