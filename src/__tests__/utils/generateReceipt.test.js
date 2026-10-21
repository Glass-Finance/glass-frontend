import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadReceiptPdf } from "../../utils/generateReceipt";
import QRCode from "qrcode";

const { docMock, jsPDFMock } = vi.hoisted(() => {
  const doc = {
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addImage: vi.fn(),
    circle: vi.fn(),
    discardPath: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    saveGraphicsState: vi.fn(),
    restoreGraphicsState: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setLineWidth: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text) => [text]),
    clip: vi.fn(),
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
    docMock.splitTextToSize.mockImplementation((text) => [text]);
  });

  it("adds a scannable QR for the same transaction ID shown on the receipt", async () => {
    await downloadReceiptPdf(transaction);

    expect(QRCode.toDataURL).toHaveBeenCalledWith("GLS202500482", {
      width: 128,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    expect(docMock.addImage).toHaveBeenCalledWith(
      "data:image/png;base64,QR",
      "PNG",
      expect.any(Number),
      expect.any(Number),
      64,
      64,
    );
    expect(docMock.circle).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 7, "F");
    expect(docMock.save).toHaveBeenCalledWith("glass-receipt-GLS202500482.pdf");
  });
});
