import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BrandedSpinner from "../../components/common/BrandedSpinner";

beforeEach(() => {
  vi.stubEnv("VITE_CLOUDINARY_CLOUD_NAME", "ece5jmhy");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BrandedSpinner", () => {
  it("renders the assembled mark with accessible loading status and reduced-motion fallbacks", () => {
    const { container } = render(<BrandedSpinner size={64} />);
    const status = screen.getByRole("status", { name: "Loading" });
    const layers = status.querySelectorAll(":scope > div");

    expect(status.style.width).toBe("64px");
    expect(status.style.height).toBe("60px");
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
});
