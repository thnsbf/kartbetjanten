// src/utils/downloadHelpers.js

export function isIosChrome() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iP(hone|od|ad)/.test(ua);
  return isIOS && /CriOS/.test(ua);
}

export function isUnsupportedIosBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";

  const isIOS = /iP(hone|od|ad)/.test(ua);
  if (!isIOS) return false;

  // Safari on iOS should be the only "supported" one
  const isSafari =
    /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|OPR\/|GSA/i.test(ua);

  // Everything else on iOS (Chrome, Google app, Firefox, Edge, …) is unsupported
  return !isSafari;
}

/**
 * Cross-browser download helper for Blobs.
 * - Normal browsers: uses <a download> with blob URL.
 * - iOS Chrome: uses FileReader + window.location.href to open the file inline.
 */
export function downloadBlobCrossBrowser(blob, filename = "download") {
  if (isIosChrome()) {
    const reader = new FileReader();

    reader.onload = () => {
      // iOS Chrome: open in current tab. User can then "Share" → "Save to Files".
      window.location.href = reader.result;
    };

    // Data URL works for both PDF and JSON/text
    reader.readAsDataURL(blob);
    return;
  }

  // Default behavior: <a download> + blob URL
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
