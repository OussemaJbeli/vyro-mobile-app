/**
 * Web preview only: expo-file-system's `File` isn't available in a browser, so files are
 * handed to the browser as a download (Blob + <a download>).
 */
export function downloadOnWeb(name: string, data: string | Uint8Array, mimeType: string): void {
  const part = typeof data === 'string' ? data : (data.slice().buffer as ArrayBuffer);
  const url = URL.createObjectURL(new Blob([part], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
