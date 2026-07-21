import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render up to `maxPages` pages of a PDF (by URL) into canvas elements. */
export async function renderPdf(url: string, maxPages = 8): Promise<HTMLCanvasElement[]> {
  const loadingTask = getDocument({ url });
  const document_ = await loadingTask.promise;
  const canvases: HTMLCanvasElement[] = [];
  const pageCount = Math.min(document_.numPages, maxPages);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document_.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) continue;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    canvases.push(canvas);
  }
  await loadingTask.destroy();
  return canvases;
}

/** Render page 1 of an uploaded PDF file to a PNG blob (client-side thumbnail fallback). */
export async function makePdfThumbnail(file: File, targetWidth = 480): Promise<Blob | null> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = getDocument({ data });
    const document_ = await loadingTask.promise;
    const page = await document_.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    await loadingTask.destroy();
    return blob;
  } catch { return null; }
}
