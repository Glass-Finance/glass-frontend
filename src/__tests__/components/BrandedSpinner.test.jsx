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
  it("renders the assembled mark with accessible loading status and reduced-motion fallbacks", () => {
    const { container } = render(<BrandedSpinner size={64} />);
    const status = screen.getByRole("status", { name: "Loading" });
    const layers = status.querySelectorAll(":scope > div");

    expect(status.style.width).toBe("64px");
    expect(status.style.height).toBe("60px");
    expect(status.style.getPropertyValue("--lock-animation-duration")).toBe("3.6s");
    expect(status.querySelectorAll("img")).toHaveLength(4);
    expect(layers[1].className).toContain("animate-lock-drop");
    expect(layers[1].className).toContain("motion-reduce:animate-none");
    expect(layers[1].style.clipPath).toContain("70.75%");
    expect(layers[2].className).toContain("animate-lock-slide");
    expect(layers[2].className).toContain("motion-reduce:animate-none");
    expect(layers[2].style.clipPath).toContain("66.04%");
    expect(layers[3].className).toContain("animate-lock-glint");
    expect(layers[3].className).toContain("motion-reduce:animate-none");
    expect(layers[3].className).toContain("opacity-0");
    expect(layers[3].style.maskImage).toContain("linear-gradient");
    expect(container.querySelectorAll("img[src*='glass/Glass']")).toHaveLength(4);
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

    await waitFor(() =>
      expect(status.style.getPropertyValue("--lock-animation-duration")).toBe("1.8s"),
    );

    connection.downlink = 25;
    connection.rtt = 40;
    connection.dispatchEvent(new Event("change"));
    await waitFor(() =>
      expect(status.style.getPropertyValue("--lock-animation-duration")).toBe("0.9s"),
    );

    connection.downlink = 0.5;
    connection.rtt = 600;
    connection.effectiveType = "2g";
    connection.dispatchEvent(new Event("change"));
    await waitFor(() =>
      expect(status.style.getPropertyValue("--lock-animation-duration")).toBe("5.4s"),
    );

    connection.effectiveType = "4g";
    connection.downlink = 25;
    connection.rtt = 40;
    connection.saveData = true;
    connection.dispatchEvent(new Event("change"));
    await waitFor(() =>
      expect(status.style.getPropertyValue("--lock-animation-duration")).toBe("5.4s"),
    );
  });
});
