import React from "react";
import { FileEntity } from "../model/FileEntity";
import { removeBlockReference } from "../utils";
import { App, Menu, HoverParent, HoverPopover, WorkspaceLeaf } from "obsidian";
import { HOVER_LINK_ID } from "../main";

interface LinkViewProps {
  fileEntity: FileEntity;
  onClick: (fileEntity: FileEntity) => Promise<void>;
  getPreview: (fileEntity: FileEntity, signal: AbortSignal) => Promise<string>;
  getTitle: (fileEntity: FileEntity, signal: AbortSignal) => Promise<string>;
  app: App;
}

interface LinkViewState {
  preview: string;
  title: string;
  mouseDown: boolean;
  dragging: boolean;
  touchStart: number;
}

export default class LinkView
  extends React.Component<LinkViewProps, LinkViewState>
  implements HoverParent
{
  private abortController: AbortController;
  hoverPopover: HoverPopover | null;
  isMobile: boolean;

  constructor(props: LinkViewProps) {
    super(props);
    this.state = {
      preview: null,
      title: null,
      mouseDown: false,
      dragging: false,
      touchStart: 0,
    };
    this.isMobile = window.matchMedia("(pointer: coarse)").matches;
  }

  async componentDidMount(): Promise<void> {
    this.abortController = new AbortController();
    const preview = await this.props.getPreview(
      this.props.fileEntity,
      this.abortController.signal
    );
    const title = await this.props.getTitle(
      this.props.fileEntity,
      this.abortController.signal
    )
    if (!this.abortController.signal.aborted) {
      this.setState({
        preview: preview,
        title: title
      });
    }
  }

  componentWillUnmount() {
    this.abortController.abort();
  }

  async openFileWithOptions(options?: "tab" | "split" | "window") {
    const { app, fileEntity } = this.props;
    const file = app.metadataCache.getFirstLinkpathDest(
      removeBlockReference(fileEntity.linkText),
      fileEntity.sourcePath
    );
    let leaf: WorkspaceLeaf;
    leaf = app.workspace.getLeaf(options);

    await leaf.openFile(file);
  }

  handleContextMenu = (event: React.MouseEvent | React.TouchEvent) => {
    if ("button" in event && event.button !== 2) return;
    event.preventDefault();

    const clientX =
      "changedTouches" in event
        ? event.changedTouches[0].clientX
        : event.clientX;
    const clientY =
      "changedTouches" in event
        ? event.changedTouches[0].clientY
        : event.clientY;

    const menu = new Menu();

    menu.addItem((item) =>
      item.setTitle("Open link").onClick(async () => {
        await this.openFileWithOptions();
      })
    );

    menu.addItem((item) =>
      item.setTitle("Open in new tab").onClick(async () => {
        await this.openFileWithOptions("tab");
      })
    );

    menu.addItem((item) =>
      item.setTitle("Open to the right").onClick(async () => {
        await this.openFileWithOptions("split");
      })
    );

    menu.addItem((item) =>
      item.setTitle("Open in new window").onClick(async () => {
        await this.openFileWithOptions("window");
      })
    );

    menu.showAtPosition({ x: clientX, y: clientY });
  };

  onMouseOver = (e: React.MouseEvent) => {
    const targetEl = e.currentTarget as HTMLElement;

    if (targetEl.tagName !== "DIV") return;

    this.props.app.workspace.trigger("hover-link", {
      event: e.nativeEvent,
      source: HOVER_LINK_ID,
      hoverParent: this,
      targetEl,
      linktext: this.props.fileEntity.linkText,
      sourcePath: this.props.fileEntity.sourcePath,
    });
  };

  onMouseUpOrTouchEnd = async (event: React.MouseEvent | React.TouchEvent) => {
    const longPress = Date.now() - this.state.touchStart >= 500;
    if (longPress && !this.state.dragging) {
      this.handleContextMenu(event);
    } else if (!this.state.dragging) {
      await this.props.onClick(this.props.fileEntity);
    }
    this.setState({ touchStart: 0, dragging: false });
  };

  render(): JSX.Element {
    return (
      <div
        className={"twohop-links-box"}
        onTouchStart={() => {
          this.setState({ touchStart: Date.now() });
        }}
        onTouchMove={() => {
          if (Date.now() - this.state.touchStart < 200) {
            this.setState({ dragging: true });
          }
        }}
        onTouchEnd={this.onMouseUpOrTouchEnd}
        onTouchCancel={() => {
          this.setState({ touchStart: 0, dragging: false });
        }}
        onMouseDown={(event) => {
          if (this.isMobile) return;
          if (event.button === 0) {
            this.setState({ mouseDown: true });
          }
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onMouseUp={(event) => {
          if (this.isMobile) return;
          if (event.button === 1) {
            this.openFileWithOptions("tab");
          } else if (event.button === 0 && !this.state.dragging) {
            this.props.onClick(this.props.fileEntity);
          }
          this.setState({ mouseDown: false, dragging: false });
        }}
        onContextMenu={this.handleContextMenu}
        onMouseOver={this.onMouseOver}
        draggable="true"
        onDragStart={(event) => {
          const fileEntityLinkText = removeBlockReference(
            this.props.fileEntity.linkText
          );
          event.dataTransfer.setData("text/plain", `[[${fileEntityLinkText}]]`);
        }}
      >
        <div className="twohop-links-box-title">
          {this.state.title}
        </div>
        <div className={"twohop-links-box-preview"}>
          {this.state.preview &&
          this.state.preview.match(/^(app|https?):\/\//) ? (
            <img src={this.state.preview} alt={"preview image"} />
          ) : (
            <div>{this.state.preview}</div>
          )}
        </div>
      </div>
    );
  }
}
