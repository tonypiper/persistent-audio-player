import { App, PluginSettingTab, Setting } from "obsidian";
import type PersistentMediaPlayerPlugin from "./main";

export interface PluginSettings {
  enableYouTubeMiniPlayer: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  enableYouTubeMiniPlayer: true,
};

export class PersistentMediaPlayerSettingTab extends PluginSettingTab {
  plugin: PersistentMediaPlayerPlugin;

  constructor(app: App, plugin: PersistentMediaPlayerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("YouTube mini-player")
      .setDesc("Show a floating video player when a YouTube embed scrolls out of view")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableYouTubeMiniPlayer)
          .onChange(async (value) => {
            this.plugin.settings.enableYouTubeMiniPlayer = value;
            await this.plugin.saveSettings();
            if (!value) {
              this.plugin.destroyYouTubeManager();
            } else {
              this.plugin.initYouTubeManager();
            }
          }),
      );
  }
}
