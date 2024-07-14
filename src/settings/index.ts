import { TwohopPluginSettings } from "./TwohopSettingTab";
import TwohopLinksPlugin from "../main";

export const DEFAULT_SETTINGS: TwohopPluginSettings = {
  autoLoadTwoHopLinks: true,
  showForwardConnectedLinks: true,
  showBackwardConnectedLinks: true,
  showTwohopLinks: true,
  showNewLinks: true,
  showTagsLinks: true,
  showPropertiesLinks: true,
  excludePaths: [],
  initialBoxCount: 10,
  initialSectionCount: 20,
  enableDuplicateRemoval: true,
  sortOrder: "random",
  showTwoHopLinksInSeparatePane: false,
  excludeTags: [],
  panePositionIsRight: false,
  createFilesForMultiLinked: false,
  frontmatterPropertyKeyAsTitle: "",
  frontmatterKeys: [],
};

export async function loadSettings(
  plugin: TwohopLinksPlugin
): Promise<TwohopPluginSettings> {
  const data = await plugin.loadData();
  const settings = Object.assign({}, DEFAULT_SETTINGS, data);
  return settings;
}

export async function saveSettings(plugin: TwohopLinksPlugin): Promise<void> {
  return plugin.saveData(plugin.settings);
}
