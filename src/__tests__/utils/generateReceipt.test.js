import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadReceiptPdf } from "../../utils/generateReceipt";
import QRCode from "qrcode";

const { docMock, jsPDFMock } = vi.hoisted(() => {
  const doc = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    save: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setLineWidth: vi.fn(),
    setLineDashPattern: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    getTextWidth: vi.fn((text) => String(text).length * 6),
  };
  return {
    docMock: doc,
    jsPDFMock: vi.fn(function () {
      return doc;
    }),
  };
});

vi.mock("jspdf", () => ({
  jsPDF: jsPDFMock,
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn() },
}));

const transaction = {
  id: "txn-1",
  reference: "GLS202500482",
  amount: 125000,
  status: "Successful",
  date: "2026-10-21T12:00:00Z",
};

describe("downloadReceiptPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,QR");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["logo"], { type: "image/webp" })),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the redesigned receipt with the same transaction ID in the QR", async () => {
    await downloadReceiptPdf(transaction);

    expect(QRCode.toDataURL).toHaveBeenCalledWith("GLS202500482", {
      width: 256,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    expect(docMock.addImage).toHaveBeenNthCalledWith(
      2,
      "data:image/png;base64,QR",
      "PNG",
      expect.any(Number),
      expect.any(Number),
      92,
      92,
    );
    expect(docMock.text.mock.calls.map(([text]) => text)).toEqual(
      expect.arrayContaining([
        "Transaction Receipt",
        "Recipient Community:",
        "Payment Plan:",
        "Transaction ID:",
        "Paid by:",
      ]),
    );
    expect(docMock.text.mock.calls.map(([text]) => text)).not.toContain("glasspay.app");
    expect(docMock.line.mock.calls.length).toBeGreaterThan(100);
    expect(docMock.save).toHaveBeenCalledWith("glass-receipt-GLS202500482.pdf");
  });
});
