import {
  PluginSettingTab,
  App,
  Setting,
  debounce,
  Editor,
  MarkdownView,
  normalizePath,
} from "obsidian";
import type AutoLinkPlugin from "./main";
import { updateNoteList } from "./notes";
import { handleEditorChange } from "./editor";
import type { Mode } from "./types";

export class AutoLinkSettingTab extends PluginSettingTab {
  plugin: AutoLinkPlugin;

  constructor(app: App, plugin: AutoLinkPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Mode")
      .setDesc("Choose how auto-linking behaves")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("autonomous", "Autonomous - auto-link all notes")
          .addOption("semiAutonomous", "Semi-autonomous - only current folder")
          .addOption("suggestions", "Suggestions - show popup for confirmation")
          .addOption("custom", "Custom - use custom settings")
          .setValue(this.plugin.settings.mode)
          .onChange(async (value) => {
            this.plugin.settings.mode = value as Mode;
            await this.plugin.saveSettings();
            updateNoteList(this.plugin);
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName("Minimum word length")
      .setDesc("Minimum number of characters before auto-linking kicks in")
      .addSlider((slider) =>
        slider
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.minWordLength)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.minWordLength = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Case-sensitive matching")
      .setDesc("Whether to match note titles case-sensitively")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.caseSensitive)
          .onChange(async (value) => {
            this.plugin.settings.caseSensitive = value;
            await this.plugin.saveSettings();
            updateNoteList(this.plugin);
          }),
      );

    new Setting(containerEl)
      .setName("Include aliases")
      .setDesc("Also match against note aliases from frontmatter")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeAliases)
          .onChange(async (value) => {
            this.plugin.settings.includeAliases = value;
            await this.plugin.saveSettings();
            updateNoteList(this.plugin);
          }),
      );

    new Setting(containerEl)
      .setName("Debounce delay (ms)")
      .setDesc("How long to wait after typing stops before processing")
      .addSlider((slider) =>
        slider
          .setLimits(50, 1000, 50)
          .setValue(this.plugin.settings.debounceMs)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.debounceMs = value;
            await this.plugin.saveSettings();
            // recreate debounced handler with new delay if workspace is ready
            this.plugin.handleEditorChangeDebounced = debounce(
              (editor: Editor, view: MarkdownView) => {
                handleEditorChange(this.plugin, editor, view);
              },
              this.plugin.settings.debounceMs,
            );
          }),
      );

    new Setting(containerEl)
      .setName("Max suggestions")
      .setDesc("Maximum number of suggestions to show in popup mode")
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.maxSuggestions)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxSuggestions = value;
            await this.plugin.saveSettings();
          }),
      );

    if (this.plugin.settings.mode === "custom") {
      new Setting(containerEl).setName("Custom mode").setHeading();

      new Setting(containerEl)
        .setName("Allow Enter to accept suggestions")
        .setDesc(
          "Whether the Enter key should accept suggestions in custom mode",
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.customAllowEnterAccept)
            .onChange(async (value) => {
              this.plugin.settings.customAllowEnterAccept = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Auto-insert single matches")
        .setDesc(
          "Automatically insert links when there's only one matching note",
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.customAutoInsertSingleMatch)
            .onChange(async (value) => {
              this.plugin.settings.customAutoInsertSingleMatch = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Custom folders")
        .setDesc(
          "Comma-separated list of folders to include in custom mode (use / for root)",
        )
        .addTextArea((text) =>
          text
            .setPlaceholder("folder1, folder2/subfolder, /")
            .setValue(this.plugin.settings.customFolders.join(", "))
            .onChange(async (value) => {
              // Normalize user-provided paths
              this.plugin.settings.customFolders = value
                .split(",")
                .map((f) => normalizePath(f.trim()))
                .filter((f) => f.length > 0);
              await this.plugin.saveSettings();
              updateNoteList(this.plugin);
            }),
        );
    }
  }
}
