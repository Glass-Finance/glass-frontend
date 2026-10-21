import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallAppSetting from "../../../components/memberApp/InstallAppSetting";
import { useInstallPrompt } from "../../../hooks/useInstallPrompt";
import { isIosSafari } from "../../../utils/pwaInstall";

vi.mock("../../../hooks/useInstallPrompt", () => ({ useInstallPrompt: vi.fn() }));
vi.mock("../../../utils/pwaInstall", () => ({ isIosSafari: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InstallAppSetting", () => {
  it("does not show installation guidance until the user asks for it", async () => {
    const user = userEvent.setup();
    useInstallPrompt.mockReturnValue({
      isInstallable: false,
      isInstalled: false,
      install: vi.fn(),
    });
    isIosSafari.mockReturnValue(true);

    render(<InstallAppSetting />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /install glasspay/i }));
    expect(screen.getByRole("dialog", { name: "Install Glasspay on iOS" })).toBeTruthy();
  });

  it("does not show an install option when the app is already installed", () => {
    useInstallPrompt.mockReturnValue({
      isInstallable: false,
      isInstalled: true,
      install: vi.fn(),
    });
    isIosSafari.mockReturnValue(true);

    render(<InstallAppSetting />);

    expect(screen.queryByRole("button", { name: /install glasspay/i })).toBeNull();
  });
});
