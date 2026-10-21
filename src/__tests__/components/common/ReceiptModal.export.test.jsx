import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReceiptModal from "../../../components/common/ReceiptModal";

// Receipt export hardening. The three export actions (Save Image / Save PDF /
// Share) all render the captured card, which contains a payer photo served
// cross-origin from files.glasspay.app WITHOUT Access-Control-Allow-Origin.
// html2canvas can then reject, and toDataURL/toBlob can throw SecurityError on
// an origin-tainted canvas.
//
// Before this change those failures were invisible: handleSaveImage/handleSavePdf
// had no catch at all (unhandled rejection, no feedback), and handleShare had a
// catch that swallowed everything — plus `if (!canvas) return` inside its try
// skipped that catch entirely and left saving === "share" stuck forever.
//
// These tests drive the real handlers and assert observable behaviour: an error
// is reported through the repo's notifyError, saving state always resets, and a
// user-dismissed share stays silent.

const { html2canvasMock, notifyErrorMock, downloadReceiptPdfMock } = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  downloadReceiptPdfMock: vi.fn(),
}));

vi.mock("html2canvas", () => ({ default: html2canvasMock }));
vi.mock("../../../utils/errorHandler", () => ({ notifyError: notifyErrorMock }));
vi.mock("../../../utils/generateReceipt", () => ({
  downloadReceiptPdf: downloadReceiptPdfMock,
}));
vi.mock("../../../components/common/QRCodeCanvas", () => ({
  default: ({ value, size, color, onReady }) => (
    <canvas
      data-testid="receipt-qr"
      data-value={value}
      data-size={size}
      data-color={color}
      ref={() => onReady?.()}
    />
  ),
}));

const TX = {
  id: "tx1",
  reference: "REF-1",
  amount: 5000,
  status: "Successful",
  communityName: "Glass Community",
  planName: "Monthly Plan",
};

/** Minimal canvas stand-in — jsdom has no usable canvas implementation. */
function fakeCanvas({
  dataUrl = "data:image/png;base64,AAA",
  blob = null,
  toBlobThrows = false,
} = {}) {
  return {
    toDataURL: vi.fn(() => dataUrl),
    toBlob: vi.fn((cb) => {
      if (toBlobThrows) throw new DOMException("tainted", "SecurityError");
      cb(blob);
    }),
  };
}

function renderModal() {
  return render(
    <ReceiptModal
      tx={TX}
      payerName="Ada Lovelace"
      payerEmail="ada@example.com"
      onClose={vi.fn()}
    />,
  );
}

const saveImageBtn = () => screen.getByRole("button", { name: /save image/i });
const savePdfBtn = () => screen.getByRole("button", { name: /save pdf/i });
const shareBtn = () => screen.getByRole("button", { name: /^share$/i });

describe("ReceiptModal export actions", () => {
  let clickSpy;

  beforeEach(() => {
    vi.resetAllMocks();
    notifyErrorMock.mockReturnValue("reported");
    html2canvasMock.mockResolvedValue(fakeCanvas());
    downloadReceiptPdfMock.mockResolvedValue(undefined);

    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    // jsdom provides neither navigator.share nor File.
    globalThis.File = class File {
      constructor(parts, name, opts) {
        this.parts = parts;
        this.name = name;
        this.type = opts?.type;
      }
    };
    globalThis.navigator.share = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    clickSpy.mockRestore();
    delete globalThis.File;
    delete globalThis.navigator.share;
  });

  it("matches the new receipt details and encodes the displayed transaction ID", () => {
    renderModal();

    expect(screen.getByTestId("receipt-qr").getAttribute("data-value")).toBe("REF-1");
    expect(screen.getByTestId("receipt-qr").getAttribute("data-size")).toBe("128");
    expect(screen.getByTestId("receipt-qr").getAttribute("data-color")).toBe("#000000");
    expect(screen.getByText("Recipient Community:")).toBeTruthy();
    expect(screen.getByText("Payment Plan:")).toBeTruthy();
    expect(screen.getByText("Transaction ID:")).toBeTruthy();
    expect(screen.getByText(/Paid by:/)).toBeTruthy();
    expect(screen.getByTestId("receipt-bottom-edge")).toBeTruthy();
    expect(screen.queryByText("glasspay.app")).toBeNull();
    expect(screen.queryByText("Transaction Type")).toBeNull();
    expect(screen.queryByText("Transaction Fee")).toBeNull();
  });

  describe("handleSaveImage", () => {
    it("reports an error and resets saving when html2canvas rejects", async () => {
      html2canvasMock.mockRejectedValue(new Error("Unable to load image"));
      renderModal();

      await userEvent.click(saveImageBtn());

      await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
      expect(notifyErrorMock.mock.calls[0][1]).toMatchObject({
        context: "Saving receipt image",
        fallback: "Couldn't save the image. Please try again.",
      });
      await waitFor(() => expect(saveImageBtn().disabled).toBe(false));
      expect(saveImageBtn().textContent).toMatch(/save image/i);
    });

    it("reports an error and resets saving when toDataURL throws SecurityError", async () => {
      const canvas = fakeCanvas();
      canvas.toDataURL.mockImplementation(() => {
        throw new DOMException("tainted", "SecurityError");
      });
      html2canvasMock.mockResolvedValue(canvas);
      renderModal();

      await userEvent.click(saveImageBtn());

      await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(saveImageBtn().disabled).toBe(false));
    });

    it("downloads and reports nothing on success", async () => {
      const canvas = fakeCanvas({ dataUrl: "data:image/png;base64,ZZZ" });
      html2canvasMock.mockResolvedValue(canvas);
      renderModal();

      await userEvent.click(saveImageBtn());

      await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
      expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
      expect(notifyErrorMock).not.toHaveBeenCalled();
      await waitFor(() => expect(saveImageBtn().disabled).toBe(false));
    });

    it("does not treat a null canvas as an error", async () => {
      html2canvasMock.mockResolvedValue(null);
      renderModal();

      await userEvent.click(saveImageBtn());

      await waitFor(() => expect(saveImageBtn().disabled).toBe(false));
      expect(notifyErrorMock).not.toHaveBeenCalled();
    });
  });

  describe("handleShare", () => {
    it("reports an error and resets saving when html2canvas rejects", async () => {
      html2canvasMock.mockRejectedValue(new Error("Unable to load image"));
      renderModal();

      await userEvent.click(shareBtn());

      await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
      expect(notifyErrorMock.mock.calls[0][1]).toMatchObject({
        context: "Sharing receipt",
        fallback: "Couldn't share the receipt. Please try again.",
      });
      await waitFor(() => expect(shareBtn().disabled).toBe(false));
    });

    it("resets saving and re-enables the button when captureCard returns null", async () => {
      // THE REGRESSION THIS PINS: `if (!canvas) return` inside the try skipped
      // the old bare catch, leaving saving === "share" stuck with the button
      // permanently disabled and no way out but closing the modal.
      html2canvasMock.mockResolvedValue(null);
      renderModal();

      await userEvent.click(shareBtn());

      await waitFor(() => expect(shareBtn().disabled).toBe(false));
      expect(shareBtn().textContent).toMatch(/^share$/i);
      expect(notifyErrorMock).not.toHaveBeenCalled();
    });

    it("reports an error and resets saving when toBlob throws SecurityError", async () => {
      html2canvasMock.mockResolvedValue(fakeCanvas({ toBlobThrows: true }));
      renderModal();

      await userEvent.click(shareBtn());

      await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(shareBtn().disabled).toBe(false));
    });

    it("reports an error when toBlob yields no blob", async () => {
      html2canvasMock.mockResolvedValue(fakeCanvas({ blob: null }));
      renderModal();

      await userEvent.click(shareBtn());

      await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(shareBtn().disabled).toBe(false));
    });

    it("stays silent when the user dismisses the share sheet, but still resets", async () => {
      html2canvasMock.mockResolvedValue(fakeCanvas({ blob: { size: 10, type: "image/png" } }));
      globalThis.navigator.share = vi
        .fn()
        .mockRejectedValue(new DOMException("cancelled", "AbortError"));
      renderModal();

      await userEvent.click(shareBtn());

      // A user cancelling is NOT an application error — no notification.
      await waitFor(() => expect(shareBtn().disabled).toBe(false));
      expect(notifyErrorMock).not.toHaveBeenCalled();
    });

    it("passes a File to navigator.share and reports nothing on success", async () => {
      const blob = { size: 10, type: "image/png" };
      html2canvasMock.mockResolvedValue(fakeCanvas({ blob }));
      renderModal();

      await userEvent.click(shareBtn());

      await waitFor(() => expect(globalThis.navigator.share).toHaveBeenCalledTimes(1));
      const payload = globalThis.navigator.share.mock.calls[0][0];
      expect(payload.title).toBe("Payment Receipt");
      expect(payload.files).toHaveLength(1);
      expect(payload.files[0].name).toContain("glass-receipt-REF-1");
      expect(payload.files[0].type).toBe("image/png");
      expect(notifyErrorMock).not.toHaveBeenCalled();
      await waitFor(() => expect(shareBtn().disabled).toBe(false));
    });
  });

  describe("handleSavePdf", () => {
    it("reports an error and resets saving when PDF generation fails", async () => {
      downloadReceiptPdfMock.mockRejectedValue(new Error("jspdf exploded"));
      renderModal();

      await userEvent.click(savePdfBtn());

      await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
      expect(notifyErrorMock.mock.calls[0][1]).toMatchObject({
        context: "Saving receipt PDF",
        fallback: "Couldn't save the receipt PDF. Please try again.",
      });
      await waitFor(() => expect(savePdfBtn().disabled).toBe(false));
    });

    it("reports nothing on success", async () => {
      renderModal();

      await userEvent.click(savePdfBtn());

      await waitFor(() => expect(downloadReceiptPdfMock).toHaveBeenCalledTimes(1));
      expect(notifyErrorMock).not.toHaveBeenCalled();
      await waitFor(() => expect(savePdfBtn().disabled).toBe(false));
    });
  });
});
