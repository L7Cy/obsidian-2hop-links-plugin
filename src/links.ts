import { App, CachedMetadata, TFile } from "obsidian";
import { FileEntity } from "./model/FileEntity";
import {
  filePathToLinkText,
  removeBlockReference,
  shouldExcludePath,
} from "./utils";
import { TwohopLink } from "./model/TwohopLink";
import {
  getSortFunction,
  getSortFunctionForFile,
  getSortedFiles,
  getTagHierarchySortFunction,
  getTwoHopSortFunction,
} from "./sort";
import { PropertiesLinks } from "./model/PropertiesLinks";

export class Links {
  app: App;
  settings: any;

  constructor(app: App, settings: any) {
    this.app = app;
    this.settings = settings;
  }

  async gatherTwoHopLinks(activeFile: TFile | null): Promise<{
    forwardLinks: FileEntity[];
    newLinks: FileEntity[];
    backwardLinks: FileEntity[];
    twoHopLinks: TwohopLink[];
    tagLinksList: PropertiesLinks[];
    frontmatterKeyLinksList: PropertiesLinks[];
  }> {
    let forwardLinks: FileEntity[] = [];
    let newLinks: FileEntity[] = [];
    let backwardLinks: FileEntity[] = [];
    let twoHopLinks: TwohopLink[] = [];
    let tagLinksList: PropertiesLinks[] = [];
    let frontmatterKeyLinksList: PropertiesLinks[] = [];

    if (activeFile) {
      const activeFileCache: CachedMetadata =
        this.app.metadataCache.getFileCache(activeFile);
      ({ resolved: forwardLinks, new: newLinks } = await this.getForwardLinks(
        activeFile,
        activeFileCache
      ));
      const seenLinkSet = new Set<string>(forwardLinks.map((it) => it.key()));
      backwardLinks = await this.getBackLinks(activeFile, seenLinkSet);
      backwardLinks.forEach((link) => seenLinkSet.add(link.key()));
      const twoHopLinkSet = new Set<string>();
      twoHopLinks = await this.getTwohopLinks(
        activeFile,
        this.app.metadataCache.resolvedLinks,
        seenLinkSet,
        twoHopLinkSet
      );

      tagLinksList = await this.getLinksListOfFilesWithTags(
        activeFile,
        activeFileCache,
        seenLinkSet,
        twoHopLinkSet
      );

      frontmatterKeyLinksList =
        await this.getLinksListOfFilesWithFrontmatterKeys(
          activeFile,
          activeFileCache,
          seenLinkSet,
          twoHopLinkSet
        );
    } else {
      const allMarkdownFiles = this.app.vault
        .getMarkdownFiles()
        .filter(
          (file: { path: string }) =>
            !shouldExcludePath(file.path, this.settings.excludePaths)
        );

      const sortedFiles = await getSortedFiles(
        allMarkdownFiles,
        getSortFunctionForFile(this.settings.sortOrder)
      );

      forwardLinks = sortedFiles.map((file) => new FileEntity("", file.path));
    }

    return {
      forwardLinks,
      newLinks,
      backwardLinks,
      twoHopLinks,
      tagLinksList,
      frontmatterKeyLinksList,
    };
  }

  async getForwardLinks(
    activeFile: TFile,
    activeFileCache: CachedMetadata
  ): Promise<{ resolved: FileEntity[]; new: FileEntity[] }> {
    const resolvedLinks: FileEntity[] = [];
    const newLinks: FileEntity[] = [];

    if (
      activeFileCache != null &&
      (activeFileCache.links != null ||
        activeFileCache.frontmatterLinks != null)
    ) {
      const seen = new Set<string>();
      const linkEntities = [
        ...(activeFileCache.links || []),
        ...(activeFileCache.frontmatterLinks || []),
      ];

      for (const it of linkEntities) {
        const key = removeBlockReference(it.link);
        if (!seen.has(key)) {
          seen.add(key);
          const targetFile = this.app.metadataCache.getFirstLinkpathDest(
            key,
            activeFile.path
          );

          if (
            targetFile &&
            shouldExcludePath(targetFile.path, this.settings.excludePaths)
          ) {
            continue;
          }

          if (targetFile) {
            resolvedLinks.push(new FileEntity(targetFile.path, key));
          } else {
            const backlinksCount = await this.getBacklinksCount(
              key,
              activeFile.path
            );
            if (
              1 <= backlinksCount &&
              this.settings.createFilesForMultiLinked
            ) {
              await this.app.vault.create(
                `${this.app.workspace.getActiveFile().parent.path}/${key}.md`,
                ""
              );
              resolvedLinks.push(new FileEntity(activeFile.path, key));
            } else {
              newLinks.push(new FileEntity(activeFile.path, key));
            }
          }
        }
      }
    } else if (activeFile.extension === "canvas") {
      const canvasContent = await this.app.vault.read(activeFile);
      let canvasData;
      try {
        canvasData = JSON.parse(canvasContent);
        if (canvasData.nodes) {
          if (!Array.isArray(canvasData.nodes)) {
            console.error("Invalid structure in canvas: nodes is not an array");
            canvasData = { nodes: [] };
          }
        }
      } catch (error) {
        console.error("Invalid JSON in canvas:", error);
        canvasData = { nodes: [] };
      }

      const seen = new Set<string>();
      if (canvasData.nodes) {
        for (const node of canvasData.nodes) {
          if (node.type === "file") {
            const key = node.file;
            if (!seen.has(key)) {
              seen.add(key);
              const targetFile = this.app.vault.getAbstractFileByPath(key);
              if (
                targetFile &&
                !shouldExcludePath(targetFile.path, this.settings.excludePaths)
              ) {
                resolvedLinks.push(new FileEntity(targetFile.path, key));
              } else {
                newLinks.push(new FileEntity(activeFile.path, key));
              }
            }
          }
        }
      }
    }

    const sortedResolvedLinks = await this.getSortedFileEntities(
      resolvedLinks,
      (entity) => entity.sourcePath,
      this.settings.sortOrder
    );
    return {
      resolved: sortedResolvedLinks,
      new: newLinks,
    };
  }

  async getBacklinksCount(file: string, excludeFile?: string): Promise<number> {
    const unresolvedLinks: Record<string, Record<string, number>> = this.app
      .metadataCache.unresolvedLinks;
    let backlinkCount = 0;

    for (const src of Object.keys(unresolvedLinks)) {
      if (excludeFile && src === excludeFile) {
        continue;
      }
      for (let dest of Object.keys(unresolvedLinks[src])) {
        dest = removeBlockReference(dest);
        if (dest === file) {
          backlinkCount++;
        }
      }
    }
    return backlinkCount;
  }

  async getBackLinks(
    activeFile: TFile,
    forwardLinkSet: Set<string>
  ): Promise<FileEntity[]> {
    const name = activeFile.path;
    const resolvedLinks: Record<string, Record<string, number>> = this.app
      .metadataCache.resolvedLinks;
    const backLinkEntities: FileEntity[] = [];
    for (const src of Object.keys(resolvedLinks)) {
      if (shouldExcludePath(src, this.settings.excludePaths)) {
        continue;
      }
      for (const dest of Object.keys(resolvedLinks[src])) {
        if (dest == name) {
          const linkText = filePathToLinkText(src);
          if (
            this.settings.enableDuplicateRemoval &&
            forwardLinkSet.has(linkText)
          ) {
            continue;
          }
          backLinkEntities.push(new FileEntity(src, linkText));
        }
      }
    }

    const allFiles: TFile[] = this.app.vault.getFiles();
    const canvasFiles: TFile[] = allFiles.filter(
      (file) => file.extension === "canvas"
    );

    for (const canvasFile of canvasFiles) {
      const canvasContent = await this.app.vault.read(canvasFile);
      let canvasData;
      try {
        canvasData = JSON.parse(canvasContent);
        if (canvasData.nodes) {
          if (!Array.isArray(canvasData.nodes)) {
            console.error("Invalid structure in canvas: nodes is not an array");
            canvasData = { nodes: [] };
          }
        }
      } catch (error) {
        console.error("Invalid JSON in canvas:", error);
        canvasData = { nodes: [] };
      }

      if (canvasData.nodes) {
        for (const node of canvasData.nodes) {
          if (node.type === "file" && node.file === activeFile.path) {
            const linkText = filePathToLinkText(canvasFile.path);
            if (!forwardLinkSet.has(linkText)) {
              backLinkEntities.push(new FileEntity(canvasFile.path, linkText));
            }
          }
        }
      }
    }

    return await this.getSortedFileEntities(
      backLinkEntities,
      (entity) => entity.sourcePath,
      this.settings.sortOrder
    );
  }

  async getTwohopLinks(
    activeFile: TFile,
    links: Record<string, Record<string, number>>,
    forwardLinkSet: Set<string>,
    twoHopLinkSet: Set<string>
  ): Promise<TwohopLink[]> {
    const twoHopLinks: Record<string, FileEntity[]> = {};
    const twohopLinkList = await this.aggregate2hopLinks(activeFile, links);

    if (twohopLinkList == null) {
      return [];
    }

    let seenLinks = new Set<string>();

    if (twohopLinkList) {
      for (const k of Object.keys(twohopLinkList)) {
        if (twohopLinkList[k].length > 0) {
          twoHopLinks[k] = twohopLinkList[k]
            .filter((it) => !shouldExcludePath(it, this.settings.excludePaths))
            .map((it) => {
              const linkText = filePathToLinkText(it);
              if (
                this.settings.enableDuplicateRemoval &&
                (forwardLinkSet.has(removeBlockReference(linkText)) ||
                  seenLinks.has(linkText))
              ) {
                return null;
              }
              seenLinks.add(linkText);
              twoHopLinkSet.add(linkText);
              return new FileEntity(activeFile.path, linkText);
            })
            .filter((it) => it);
        }
      }
    }

    let linkKeys: string[] = [];
    if (activeFile.extension === "canvas") {
      const canvasContent = await this.app.vault.read(activeFile);
      let canvasData;
      try {
        canvasData = JSON.parse(canvasContent);
      } catch (error) {
        console.error("Invalid JSON in canvas:", error);
        canvasData = { nodes: [] };
      }

      if (Array.isArray(canvasData.nodes)) {
        linkKeys = canvasData.nodes
          .filter((node: any) => node.type === "file")
          .map((node: any) => node.file);
      } else {
        linkKeys = [];
      }
    } else if (links[activeFile.path]) {
      linkKeys = Object.keys(links[activeFile.path]);
    }

    const twoHopLinkEntities = (
      await Promise.all(
        linkKeys
          .filter(
            (path) => !shouldExcludePath(path, this.settings.excludePaths)
          )
          .map(async (path) => {
            if (twoHopLinks[path]) {
              const sortedFileEntities = await this.getSortedFileEntities(
                twoHopLinks[path],
                (entity) => {
                  const file = this.app.metadataCache.getFirstLinkpathDest(
                    entity.linkText,
                    entity.sourcePath
                  );
                  return file ? file.path : null;
                },
                this.settings.sortOrder
              );

              return {
                link: new FileEntity(activeFile.path, path),
                fileEntities: sortedFileEntities,
              };
            }
            return null;
          })
      )
    ).filter((it) => it);

    const twoHopLinkStatsPromises = twoHopLinkEntities.map(
      async (twoHopLinkEntity) => {
        const stat = await this.app.vault.adapter.stat(
          twoHopLinkEntity.link.linkText
        );
        return { twoHopLinkEntity, stat };
      }
    );

    const twoHopLinkStats = (await Promise.all(twoHopLinkStatsPromises)).filter(
      (it) => it && it.twoHopLinkEntity && it.stat
    );

    const twoHopSortFunction = getTwoHopSortFunction(this.settings.sortOrder);
    twoHopLinkStats.sort(twoHopSortFunction);

    return twoHopLinkStats
      .map(
        (it) =>
          new TwohopLink(
            it!.twoHopLinkEntity.link,
            it!.twoHopLinkEntity.fileEntities
          )
      )
      .filter((it) => it.fileEntities.length > 0);
  }

  async aggregate2hopLinks(
    activeFile: TFile,
    links: Record<string, Record<string, number>>
  ): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};

    let activeFileLinks = new Set<string>();

    if (links && activeFile && activeFile.path && links[activeFile.path]) {
      activeFileLinks = new Set(Object.keys(links[activeFile.path]));
    }

    if (activeFile.extension === "canvas") {
      const canvasContent = await this.app.vault.read(activeFile);
      let canvasData;
      try {
        canvasData = JSON.parse(canvasContent);
        if (canvasData.nodes) {
          if (!Array.isArray(canvasData.nodes)) {
            console.error("Invalid structure in canvas: nodes is not an array");
            canvasData = { nodes: [] };
          }
        }
      } catch (error) {
        console.error("Invalid JSON in canvas:", error);
        canvasData = { nodes: [] };
      }

      if (canvasData.nodes) {
        for (const node of canvasData.nodes) {
          if (node.type === "file") {
            activeFileLinks.add(node.file);
          }
        }
      }
    }

    if (links) {
      for (const src of Object.keys(links)) {
        if (src == activeFile.path) {
          continue;
        }
        const link = links[src];
        if (link) {
          for (const dest of Object.keys(link)) {
            if (activeFileLinks.has(dest)) {
              if (!result[dest]) {
                result[dest] = [];
              }
              result[dest].push(src);
            }
          }
        }
      }
    }
    return result;
  }

  async getLinksListOfFilesWithTags(
    activeFile: TFile,
    activeFileCache: CachedMetadata,
    forwardLinkSet: Set<string>,
    twoHopLinkSet: Set<string>
  ): Promise<PropertiesLinks[]> {
    const activeFileTags = this.getTagsFromCache(
      activeFileCache,
      this.settings.excludeTags
    );
    if (activeFileTags.length === 0) return [];

    const activeFileTagSet = new Set(activeFileTags);
    const tagMap: Record<string, FileEntity[]> = {};
    const seen: Record<string, boolean> = {};

    const markdownFiles = this.app.vault
      .getMarkdownFiles()
      .filter(
        (markdownFile: TFile) =>
          markdownFile !== activeFile &&
          !shouldExcludePath(markdownFile.path, this.settings.excludePaths)
      );

    for (const markdownFile of markdownFiles) {
      const cachedMetadata = this.app.metadataCache.getFileCache(markdownFile);
      if (!cachedMetadata) continue;

      const fileTags = this.getTagsFromCache(
        cachedMetadata,
        this.settings.excludePaths
      );

      for (const tag of fileTags) {
        if (!activeFileTagSet.has(tag)) continue;

        tagMap[tag] = tagMap[tag] ?? [];

        if (
          this.settings.enableDuplicateRemoval &&
          (seen[markdownFile.path] ||
            forwardLinkSet.has(filePathToLinkText(markdownFile.path)) ||
            twoHopLinkSet.has(filePathToLinkText(markdownFile.path)))
        )
          continue;

        const linkText = filePathToLinkText(markdownFile.path);
        const newFileEntity = new FileEntity(activeFile.path, linkText);

        if (
          !tagMap[tag].some(
            (existingEntity) =>
              existingEntity.sourcePath === newFileEntity.sourcePath &&
              existingEntity.linkText === newFileEntity.linkText
          )
        ) {
          tagMap[tag].push(newFileEntity);
        }
      }
    }

    const tagLinksEntities = await this.createPropertiesLinkEntities(
      this.settings,
      tagMap,
      "tags"
    );

    const sortFunction = getTagHierarchySortFunction(this.settings.sortOrder);
    return tagLinksEntities.sort(sortFunction);
  }

  async getLinksListOfFilesWithFrontmatterKeys(
    activeFile: TFile,
    activeFileCache: CachedMetadata,
    forwardLinkSet: Set<string>,
    twoHopLinkSet: Set<string>
  ): Promise<PropertiesLinks[]> {
    const activeFileFrontmatter = activeFileCache.frontmatter;
    if (!activeFileFrontmatter) return [];

    const frontmatterKeyMap: Record<string, Record<string, FileEntity[]>> = {};
    const seen: Record<string, boolean> = {};

    const markdownFiles = this.app.vault
      .getMarkdownFiles()
      .filter(
        (markdownFile: TFile) =>
          markdownFile !== activeFile &&
          !shouldExcludePath(markdownFile.path, this.settings.excludePaths)
      );

    for (const markdownFile of markdownFiles) {
      const cachedMetadata = this.app.metadataCache.getFileCache(markdownFile);
      if (!cachedMetadata) continue;

      const fileFrontmatter = cachedMetadata.frontmatter;
      if (!fileFrontmatter) continue;

      for (const [key, value] of Object.entries(fileFrontmatter)) {
        if (!this.settings.frontmatterKeys.includes(key)) continue;

        let values: string[] = [];
        let activeValues: string[] = [];

        if (typeof value === "string") {
          values.push(value);
        } else if (Array.isArray(value)) {
          values.push(...value);
        } else {
          continue;
        }

        if (activeFileFrontmatter[key]) {
          if (typeof activeFileFrontmatter[key] === "string") {
            activeValues.push(activeFileFrontmatter[key]);
          } else if (Array.isArray(activeFileFrontmatter[key])) {
            activeValues.push(...activeFileFrontmatter[key]);
          } else {
            continue;
          }
        } else {
          continue;
        }

        for (const activeValue of activeValues) {
          const activeValueHierarchy = activeValue.split("/");
          for (let i = activeValueHierarchy.length - 1; i >= 0; i--) {
            const hierarchicalActiveValue = activeValueHierarchy
              .slice(0, i + 1)
              .join("/");

            for (const value of values) {
              if (typeof value !== "string") {
                continue;
              }
              const valueHierarchy = value.split("/");
              const hierarchicalValue = valueHierarchy
                .slice(0, i + 1)
                .join("/");

              if (hierarchicalActiveValue !== hierarchicalValue) continue;

              frontmatterKeyMap[key] = frontmatterKeyMap[key] ?? {};
              frontmatterKeyMap[key][hierarchicalValue] =
                frontmatterKeyMap[key][hierarchicalValue] ?? [];

              if (
                this.settings.enableDuplicateRemoval &&
                (seen[markdownFile.path] ||
                  forwardLinkSet.has(filePathToLinkText(markdownFile.path)) ||
                  twoHopLinkSet.has(filePathToLinkText(markdownFile.path)))
              ) {
                continue;
              }

              const linkText = filePathToLinkText(markdownFile.path);
              frontmatterKeyMap[key][hierarchicalValue].push(
                new FileEntity(activeFile.path, linkText)
              );
              seen[markdownFile.path] = true;
            }
          }
        }
      }
    }

    const frontmatterKeyLinksEntities: PropertiesLinks[] = [];

    for (const [key, valueMap] of Object.entries(frontmatterKeyMap)) {
      const propertiesLinksEntities = await this.createPropertiesLinkEntities(
        this.settings,
        valueMap,
        key
      );

      frontmatterKeyLinksEntities.push(...propertiesLinksEntities);
    }

    const sortFunction = getTagHierarchySortFunction(this.settings.sortOrder);
    return frontmatterKeyLinksEntities.sort(sortFunction);
  }

  async createPropertiesLinkEntities(
    settings: any,
    propertiesMap: Record<string, FileEntity[]>,
    key: string = ""
  ): Promise<PropertiesLinks[]> {
    const propertiesLinksEntitiesPromises = Object.entries(propertiesMap).map(
      async ([property, entities]) => {
        const sortedEntities = await this.getSortedFileEntities(
          entities,
          (entity) => entity.sourcePath,
          settings.sortOrder
        );
        if (sortedEntities.length === 0) {
          return null;
        }
        return new PropertiesLinks(property, key, sortedEntities);
      }
    );

    const propertiesLinksEntities = await Promise.all(
      propertiesLinksEntitiesPromises
    );
    return propertiesLinksEntities.filter((it) => it != null);
  }

  getTagsFromCache(
    cache: CachedMetadata | null | undefined,
    excludeTags: string[]
  ): string[] {
    let tags: string[] = [];
    if (cache) {
      if (cache.tags) {
        cache.tags.forEach((it) => {
          const tagHierarchy = it.tag.replace("#", "").split("/");
          for (let i = 0; i < tagHierarchy.length; i++) {
            tags.push(tagHierarchy.slice(0, i + 1).join("/"));
          }
        });
      }

      if (cache.frontmatter?.tags) {
        if (Array.isArray(cache.frontmatter.tags)) {
          cache.frontmatter.tags.forEach((tag) => {
            if (typeof tag === "string") {
              const tagHierarchy = tag.split("/");
              for (let i = 0; i < tagHierarchy.length; i++) {
                tags.push(tagHierarchy.slice(0, i + 1).join("/"));
              }
            }
          });
        } else if (typeof cache.frontmatter.tags === "string") {
          cache.frontmatter.tags
            .split(",")
            .map((tag) => tag.trim())
            .forEach((tag) => {
              const tagHierarchy = tag.split("/");
              for (let i = 0; i < tagHierarchy.length; i++) {
                tags.push(tagHierarchy.slice(0, i + 1).join("/"));
              }
            });
        }
      }
    }

    return tags.filter((tag) => {
      for (const excludeTag of excludeTags) {
        if (
          excludeTag.endsWith("/") &&
          (tag === excludeTag.slice(0, -1) || tag.startsWith(excludeTag))
        ) {
          return false;
        }
        if (!excludeTag.endsWith("/") && tag === excludeTag) {
          return false;
        }
      }
      return true;
    });
  }

  async getSortedFileEntities(
    entities: FileEntity[],
    sourcePathFn: (entity: FileEntity) => string,
    sortOrder: string
  ): Promise<FileEntity[]> {
    const statsPromises = entities.map(async (entity) => {
      const stat = await this.app.vault.adapter.stat(sourcePathFn(entity));
      return { entity, stat };
    });

    const stats = (await Promise.all(statsPromises)).filter((it) => it);

    const sortFunction = getSortFunction(sortOrder);
    stats.sort(sortFunction);

    return stats.map((it) => it!.entity);
  }
}
