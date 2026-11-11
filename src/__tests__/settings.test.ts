import { describe, it, expect, vi } from "vitest";
import type { AutoLinkSettings } from "../types";
import type AutoLinkPlugin from "../main";
import { AutoLinkSettingTab } from "../settings";
import { makePluginContext } from "./helpers";
import { TestSettingsContainer } from "./settings-fixture";

vi.mock("obsidian", async () => await import("./settings-fixture"));

function makeSettingsTab() {
  const plugin = makePluginContext();
  const savedSettings: AutoLinkSettings[] = [];
  plugin.saveSettings = async () => {
    savedSettings.push({ ...plugin.settings });
  };

  // The host PluginSettingTab base is replaced above
  const tab = new AutoLinkSettingTab(plugin.app, plugin as AutoLinkPlugin);
  const container = new TestSettingsContainer();
  // Both host UI classes are mocked
  tab.containerEl = container as unknown as HTMLElement;
  return { plugin, tab, savedSettings, container };
}

describe("link limit settings", () => {
  it("exposes a declarative slider that can disable the limit", () => {
    const { tab } = makeSettingsTab();
    const setting = tab
      .getSettingDefinitions()
      .find((definition) => definition.control?.key === "maxLinksPerNote");

    expect(setting?.control).toMatchObject({
      type: "slider",
      min: 0,
      max: 10,
      step: 1,
    });
  });

  it("exposes whole-note and per-section declarative scope choices", () => {
    const { tab } = makeSettingsTab();
    const setting = tab
      .getSettingDefinitions()
      .find((definition) => definition.control?.key === "maxLinksScope");

    expect(setting?.control).toMatchObject({
      type: "dropdown",
      defaultValue: "note",
      options: { note: "Whole note", section: "Per section" },
    });
  });

  it("persists declarative changes to the limit and scope", async () => {
    const { plugin, tab, savedSettings } = makeSettingsTab();

    await tab.setControlValue("maxLinksPerNote", 0);
    await tab.setControlValue("maxLinksScope", "section");

    expect(plugin.settings.maxLinksPerNote).toBe(0);
    expect(plugin.settings.maxLinksScope).toBe("section");
    expect(savedSettings).toHaveLength(2);
    expect(savedSettings[1].maxLinksScope).toBe("section");
  });

  it.each([-1, 1.5, Number.NaN, Infinity, "2", null])(
    "rejects an invalid link limit %s before changing settings",
    async (value) => {
      const { plugin, tab, savedSettings } = makeSettingsTab();

      await expect(
        tab.setControlValue("maxLinksPerNote", value),
      ).rejects.toThrow();

      expect(plugin.settings.maxLinksPerNote).toBe(1);
      expect(savedSettings).toHaveLength(0);
    },
  );

  it.each(["heading", undefined, null, 0])(
    "rejects an invalid link limit scope %s before changing settings",
    async (value) => {
      const { plugin, tab, savedSettings } = makeSettingsTab();

      await expect(
        tab.setControlValue("maxLinksScope", value),
      ).rejects.toThrow();

      expect(plugin.settings.maxLinksScope).toBe("note");
      expect(savedSettings).toHaveLength(0);
    },
  );

  it("persists legacy control changes without redrawing a dragged slider", async () => {
    const { plugin, tab, savedSettings, container } = makeSettingsTab();
    // Obsidian <1.13 dispatches display at runtime. Reflect that host boundary
    // without introducing a deprecated API call into the plugin implementation.
    const display: unknown = Reflect.get(tab, "display");
    if (typeof display !== "function") {
      throw new Error("The legacy settings entry point must remain callable");
    }
    Reflect.apply(display, tab, []);
    const slider = container.settings.find(
      (setting) => setting.name === "Max links per note",
    )?.slider;
    const dropdown = container.settings.find(
      (setting) => setting.name === "Link limit scope",
    )?.dropdown;
    const renderCount = container.settings.length;

    expect(slider?.value).toBe(1);
    expect(dropdown?.value).toBe("note");
    if (!slider || !dropdown)
      throw new Error("Both link-limit controls must be rendered");

    await slider.change(0);
    await dropdown.change("section");

    expect(plugin.settings.maxLinksPerNote).toBe(0);
    expect(plugin.settings.maxLinksScope).toBe("section");
    expect(savedSettings).toHaveLength(2);
    expect(container.settings).toHaveLength(renderCount);
    expect(
      container.settings.find((setting) => setting.slider === slider),
    ).toBeDefined();
  });
});
