import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BrandedSpinner from "../../components/common/BrandedSpinner";

let originalConnectionDescriptor;

beforeEach(() => {
  vi.stubEnv("VITE_CLOUDINARY_CLOUD_NAME", "ece5jmhy");
  originalConnectionDescriptor = Object.getOwnPropertyDescriptor(navigator, "connection");
});

afterEach(() => {
  if (originalConnectionDescriptor) {
    Object.defineProperty(navigator, "connection", originalConnectionDescriptor);
  } else {
    delete navigator.connection;
  }
  vi.unstubAllEnvs();
});

describe("BrandedSpinner", () => {
  it("renders the fill animation with accessible loading status and reduced-motion fallback", () => {
    const { container } = render(<BrandedSpinner size={64} />);
    const status = screen.getByRole("status", { name: "Loading" });
    const layers = status.querySelectorAll(":scope > div");

    expect(status.style.width).toBe("64px");
    expect(status.style.height).toBe("60px");
    expect(status.style.getPropertyValue("--logo-fill-duration")).toBe("2.6s");
    expect(status.querySelectorAll("img")).toHaveLength(2);
    expect(layers[0].className).toContain("opacity-[.14]");
    expect(layers[0].className).toContain("grayscale");
    expect(layers[1].className).toContain("animate-logo-fill");
    expect(layers[1].className).toContain("motion-reduce:animate-none");
    expect(container.querySelectorAll("img[src*='glass/Glass']")).toHaveLength(2);
  });

  it("speeds up on fast connections and slows down for slow or data-saving connections", async () => {
    const connection = new EventTarget();
    connection.effectiveType = "4g";
    connection.saveData = false;
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: connection,
    });

    render(<BrandedSpinner />);
    const status = screen.getByRole("status", { name: "Loading" });

    await waitFor(() => expect(status.style.getPropertyValue("--logo-fill-duration")).toBe("1.8s"));

    connection.downlink = 25;
    connection.rtt = 40;
    connection.dispatchEvent(new Event("change"));
    await waitFor(() => expect(status.style.getPropertyValue("--logo-fill-duration")).toBe("0.9s"));

    connection.downlink = 0.5;
    connection.rtt = 600;
    connection.effectiveType = "2g";
    connection.dispatchEvent(new Event("change"));
    await waitFor(() => expect(status.style.getPropertyValue("--logo-fill-duration")).toBe("5.4s"));

    connection.effectiveType = "4g";
    connection.downlink = 25;
    connection.rtt = 40;
    connection.saveData = true;
    connection.dispatchEvent(new Event("change"));
    await waitFor(() => expect(status.style.getPropertyValue("--logo-fill-duration")).toBe("5.4s"));
  });
});
