import type { App } from "obsidian";
import type { AutoLinkPluginContext } from "../types";

/** Records controls rendered into a settings tab without requiring a DOM. */
export class TestSettingsContainer {
  settings: Setting[] = [];

  /** Clears previously rendered controls before a settings-tab redraw. */
  empty(): void {
    this.settings = [];
  }
}

/** Stores control configuration and invokes the actual plugin change callback. */
class TestControl<T> {
  value: T | undefined;
  limits: number[] = [];
  options: Record<string, string> = {};
  private handler: ((value: T) => void | Promise<void>) | null = null;

  setValue(value: T): this {
    this.value = value;
    return this;
  }

  setLimits(min: number, max: number, step: number): this {
    this.limits = [min, max, step];
    return this;
  }

  addOption(value: string, label: string): this {
    this.options[value] = label;
    return this;
  }

  setPlaceholder(_value: string): this {
    return this;
  }

  onChange(handler: (value: T) => void | Promise<void>): this {
    this.handler = handler;
    return this;
  }

  async change(value: T): Promise<void> {
    if (!this.handler)
      throw new Error("The settings control has no change callback");
    this.value = value;
    await this.handler(value);
  }
}

/** Replaces Obsidian's settings-tab base class, which normally owns host DOM. */
export class PluginSettingTab {
  containerEl = new TestSettingsContainer();

  /** Accepts the host dependencies; lifecycle and DOM setup are not under test. */
  constructor(_app: App, _plugin: AutoLinkPluginContext) {}
}

/** Captures imperative settings rendered by the real legacy settings method. */
export class Setting {
  name = "";
  desc = "";
  slider: TestControl<number> | null = null;
  dropdown: TestControl<string> | null = null;

  /** Registers this setting in the supplied in-memory container. */
  constructor(container: TestSettingsContainer) {
    container.settings.push(this);
  }

  /** Stores the name supplied by the plugin and returns this setting. */
  setName(name: string): this {
    this.name = name;
    return this;
  }

  /** Stores the description supplied by the plugin and returns this setting. */
  setDesc(desc: string): this {
    this.desc = desc;
    return this;
  }

  /** Preserves the fluent API; host heading styling is not under test. */
  setHeading(): this {
    return this;
  }

  /** Configures a recorded slider using the plugin's real rendering callback. */
  addSlider(callback: (slider: TestControl<number>) => unknown): this {
    this.slider = new TestControl<number>();
    callback(this.slider);
    return this;
  }

  /** Configures a recorded dropdown using the plugin's real rendering callback. */
  addDropdown(callback: (dropdown: TestControl<string>) => unknown): this {
    this.dropdown = new TestControl<string>();
    callback(this.dropdown);
    return this;
  }

  /** Runs existing toggle rendering without retaining an unrelated control. */
  addToggle(callback: (toggle: TestControl<boolean>) => unknown): this {
    callback(new TestControl<boolean>());
    return this;
  }

  /** Runs existing text rendering without retaining an unrelated control. */
  addText(callback: (text: TestControl<string>) => unknown): this {
    callback(new TestControl<string>());
    return this;
  }
}
