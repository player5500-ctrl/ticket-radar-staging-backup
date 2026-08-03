export type CaptureReceipt = {
  key: string;
  capturedAt: string;
  filename: string;
};

export function createCaptureKey(url: string) {
  return url;
}

export function createScreenshotFilename(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `TicketRadar_Demo_created_${stamp}.png`;
}

export function isDuplicateCapture(receipt: CaptureReceipt | undefined, key: string) {
  return receipt?.key === key;
}
