import { App, PluginSettingTab, Setting } from "obsidian";
import TwohopLinksPlugin from "../main";
import { saveSettings } from ".";

export interface TwohopPluginSettings {
  autoLoadTwoHopLinks: boolean;
  showForwardConnectedLinks: boolean;
  showBackwardConnectedLinks: boolean;
  showTwohopLinks: boolean;
  showNewLinks: boolean;
  showTagsLinks: boolean;
  showPropertiesLinks: boolean;
  showImage: boolean;
  excludePaths: string[];
  initialBoxCount: number;
  initialSectionCount: number;
  enableDuplicateRemoval: boolean;
  sortOrder: string;
  showTwoHopLinksInSeparatePane: boolean;
  excludeTags: string[];
  panePositionIsRight: boolean;
  createFilesForMultiLinked: boolean;
  frontmatterPropertyKeyAsTitle: string;
  frontmatterKeys: string[];
  [key: string]: boolean | string | string[] | number | undefined;
}

export class TwohopSettingTab extends PluginSettingTab {
  plugin: TwohopLinksPlugin;

  constructor(app: App, plugin: TwohopLinksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const containerEl = this.containerEl;

    containerEl.empty();

    this.createToggleSetting(
      "Show links in separate pane",
      "If true, the links is displayed in a separate pane.",
      "showTwoHopLinksInSeparatePane"
    );
    if (this.plugin.settings.showTwoHopLinksInSeparatePane) {
      this.createToggleSetting(
        "Show links on the right",
        "If true, the pane for links is displayed on the right, otherwise on the left.",
        "panePositionIsRight"
      );
    }
    this.createDropdownSetting(
      "Sort Order",
      "",
      "sortOrder",
      {
        random: "Random",
        filenameAsc: "File name (A to Z)",
        filenameDesc: "File name (Z to A)",
        modifiedDesc: "Modified time (new to old)",
        modifiedAsc: "Modified time (old to new)",
        createdDesc: "Created time (new to old)",
        createdAsc: "Created time (old to new)",
      }
    );
    this.createToggleSetting("Show Links", "", "showForwardConnectedLinks");
    this.createToggleSetting(
      "Show Back Links",
      "",
      "showBackwardConnectedLinks"
    );
    this.createToggleSetting(
      "Show 2Hop Links",
      "",
      "showTwohopLinks"
    );
    this.createToggleSetting(
      "Show New Links",
      "",
      "showNewLinks"
    );
    this.createToggleSetting(
      "Show Tags Links",
      "",
      "showTagsLinks"
    );
    this.createToggleSetting(
      "Show Properties Links",
      "",
      "showPropertiesLinks"
    );
    this.createToggleSetting("Show Image in the Links", "", "showImage");
    this.createTextAreaSetting(
      "Exclude Paths",
      "List of file or folder paths to exclude, one per line.",
      "excludePaths",
      "path/to/file.md\npath/to/folder/"
    );
    this.createTextAreaSetting(
      "Exclude Tags",
      "List of tags to exclude, one per line.",
      "excludeTags",
      "tagNameToExclude\nparent/childTagToExclude\nparentTag/forAllSubtags/"
    );
    this.createTextAreaSetting(
      "Frontmatter Keys",
      "List of frontmatter keys to include, one per line. The values of these keys will be treated like tags.",
      "frontmatterKeys",
      "key1\nkey2\nkey3"
    );
    this.createTextSettingNum(
      "Initial Box Count",
      "Set the initial number of boxes to be displayed.",
      "initialBoxCount"
    );
    this.createTextSettingNum(
      "Initial Section Count",
      "Set the initial number of sections to be displayed.",
      "initialSectionCount"
    );
    this.createToggleSetting(
      "Enable Duplicate Removal",
      "Enable the removal of duplicate links.",
      "enableDuplicateRemoval"
    );
    this.createToggleSetting(
      "Auto Load Links",
      "Automatically load links when opening a note.",
      "autoLoadTwoHopLinks"
    );
    this.createToggleSetting(
      "Create Files For Multiple Linked",
      "Create new files for links that are connected to more than one other file.",
      "createFilesForMultiLinked"
    );
    this.createTextSettingStr(
      "Set frontmatter property key as title",
      "Set the property key of the frontmatter to be used as the title to be displayed.",
      "frontmatterPropertyKeyAsTitle"
    );
  }

  createToggleSetting(
    name: string,
    desc: string,
    key: keyof TwohopPluginSettings
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) => {
        toggle.setValue(!!this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await saveSettings(this.plugin);
          this.plugin.updateTwoHopLinksView();
          if (key === "showTwoHopLinksInSeparatePane") {
            this.display();
          }
        });
      });
  }

  createDropdownSetting(
    name: string,
    desc: string,
    key: keyof TwohopPluginSettings,
    options: Record<string, string>
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addDropdown((dropdown) => {
        for (const optionKey in options) {
          dropdown.addOption(optionKey, options[optionKey]);
        }
        dropdown
          .setValue(this.plugin.settings[key] as string)
          .onChange(async (value) => {
            this.plugin.settings[key] = value;
            await saveSettings(this.plugin);
            await this.plugin.updateTwoHopLinksView();
          });
      });
  }

  createTextAreaSetting(
    name: string,
    desc: string,
    key: keyof TwohopPluginSettings,
    placeholder: string
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder(placeholder)
          .setValue((this.plugin.settings[key] as string[]).join("\n"));
        textArea.inputEl.style.height = "150px";
        textArea.inputEl.addEventListener("blur", async (event) => {
          this.plugin.settings[key] = (event.target as HTMLInputElement).value
            .split("\n")
            .map((path) => path.trim());
          await saveSettings(this.plugin);
          await this.plugin.updateTwoHopLinksView();
        });
      });
  }

  createTextSettingNum(
    name: string,
    desc: string,
    key: keyof TwohopPluginSettings
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        text.setValue((this.plugin.settings[key] as number).toString());
        text.inputEl.addEventListener("blur", async (event) => {
          this.plugin.settings[key] = Number(
            (event.target as HTMLInputElement).value
          );
          await saveSettings(this.plugin);
          await this.plugin.updateTwoHopLinksView();
        });
      });
  }

  createTextSettingStr(
    name: string,
    desc: string,
    key: keyof TwohopPluginSettings
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        text.setValue(this.plugin.settings[key] as string);
        text.inputEl.addEventListener("blur", async (event) => {
          this.plugin.settings[key] = (event.target as HTMLInputElement).value;
          await saveSettings(this.plugin);
          await this.plugin.updateTwoHopLinksView();
        });
      });
  }
}
