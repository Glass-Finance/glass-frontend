import { describe, it, expect, beforeEach } from "vitest";
import {
  getSettingsReturnPath,
  isSettingsPath,
  rememberSettingsReturnPath,
  SETTINGS_RETURN_FALLBACK,
} from "../../utils/settingsReturnPath";

describe("settingsReturnPath", () => {
  beforeEach(() => sessionStorage.clear());

  it("recognises the Settings root and its sub-pages only", () => {
    expect(isSettingsPath("/dashboard/settings")).toBe(true);
    expect(isSettingsPath("/dashboard/settings/account/profile")).toBe(true);
    expect(isSettingsPath("/dashboard/settings-extra")).toBe(false);
    expect(isSettingsPath("/dashboard/admin")).toBe(false);
  });

  it("falls back to the communities overview when nothing was recorded", () => {
    expect(getSettingsReturnPath()).toBe(SETTINGS_RETURN_FALLBACK);
  });

  it("returns the last page visited outside Settings, query included", () => {
    rememberSettingsReturnPath({ pathname: "/dashboard/members", search: "?community=kc" });
    expect(getSettingsReturnPath()).toBe("/dashboard/members?community=kc");
  });

  it("ignores navigation within Settings so tabs and sub-pages don't overwrite it", () => {
    rememberSettingsReturnPath({ pathname: "/dashboard/payments", search: "" });
    rememberSettingsReturnPath({ pathname: "/dashboard/settings/account", search: "" });
    rememberSettingsReturnPath({ pathname: "/dashboard/settings/finance", search: "" });
    expect(getSettingsReturnPath()).toBe("/dashboard/payments");
  });

  it("rejects a stored value that isn't a dashboard path", () => {
    sessionStorage.setItem("glass_settings_return_path", "https://evil.example");
    expect(getSettingsReturnPath()).toBe(SETTINGS_RETURN_FALLBACK);
  });
});
