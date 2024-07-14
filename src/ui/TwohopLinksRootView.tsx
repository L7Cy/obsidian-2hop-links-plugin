import { TwohopLink } from "../model/TwohopLink";
import React, { createRef } from "react";
import { FileEntity } from "../model/FileEntity";
import TwohopLinksView from "./TwohopLinksView";
import ConnectedLinksView from "./ConnectedLinksView";
import NewLinksView from "./NewLinksView";
import { PropertiesLinks } from "../model/PropertiesLinks";
import { App, setIcon } from "obsidian";
import PropertiesLinksListView from "./TagLinksListView";

interface TwohopLinksRootViewProps {
  forwardConnectedLinks: FileEntity[];
  newLinks: FileEntity[];
  backwardConnectedLinks: FileEntity[];
  twoHopLinks: TwohopLink[];
  tagLinksList: PropertiesLinks[];
  frontmatterKeyLinksList: PropertiesLinks[];
  onClick: (fileEntity: FileEntity) => Promise<void>;
  getPreview: (fileEntity: FileEntity) => Promise<string>;
  getTitle: (fileEntity: FileEntity) => Promise<string>;
  app: App;
  showForwardConnectedLinks: boolean;
  showBackwardConnectedLinks: boolean;
  showTwohopLinks: boolean;
  showNewLinks: boolean;
  showTagsLinks: boolean;
  showPropertiesLinks: boolean;
  autoLoadTwoHopLinks: boolean;
  initialBoxCount: number;
  initialSectionCount: number;
}

type Category =
  | "forwardConnectedLinks"
  | "backwardConnectedLinks"
  | "twoHopLinks"
  | "newLinks"
  | "tagLinksList"
  | "frontmatterKeyLinksList";

interface TwohopLinksRootViewState {
  displayedBoxCount: Record<Category, number>;
  displayedSectionCount: Record<Category, number>;
  prevProps: TwohopLinksRootViewProps | null;
  isLoaded: boolean;
}

export default class TwohopLinksRootView extends React.Component<
  TwohopLinksRootViewProps,
  TwohopLinksRootViewState
> {
  loadMoreRefs: Record<Category, React.RefObject<HTMLButtonElement>> = {
    forwardConnectedLinks: createRef(),
    newLinks: createRef(),
    backwardConnectedLinks: createRef(),
    twoHopLinks: createRef(),
    tagLinksList: createRef(),
    frontmatterKeyLinksList: createRef(),
  };

  constructor(props: TwohopLinksRootViewProps) {
    super(props);
    this.state = {
      displayedBoxCount: {
        forwardConnectedLinks: props.initialBoxCount,
        newLinks: props.initialBoxCount,
        backwardConnectedLinks: props.initialBoxCount,
        twoHopLinks: props.initialBoxCount,
        tagLinksList: props.initialBoxCount,
        frontmatterKeyLinksList: props.initialBoxCount,
      },
      displayedSectionCount: {
        forwardConnectedLinks: props.initialSectionCount,
        newLinks: props.initialSectionCount,
        backwardConnectedLinks: props.initialSectionCount,
        twoHopLinks: props.initialSectionCount,
        tagLinksList: props.initialSectionCount,
        frontmatterKeyLinksList: props.initialSectionCount,
      },
      prevProps: null,
      isLoaded: props.autoLoadTwoHopLinks,
    };
  }

  loadMoreBox = (category: Category) => {
    this.setState((prevState) => ({
      displayedBoxCount: {
        ...prevState.displayedBoxCount,
        [category]:
          prevState.displayedBoxCount[category] + this.props.initialBoxCount,
      },
      prevProps: this.props,
    }));
  };

  loadMoreSections = (category: Category) => {
    this.setState((prevState) => ({
      displayedSectionCount: {
        ...prevState.displayedSectionCount,
        [category]:
          prevState.displayedSectionCount[category] +
          this.props.initialSectionCount,
      },
      prevProps: this.props,
    }));
  };

  componentDidMount() {
    for (let ref of Object.values(this.loadMoreRefs)) {
      if (ref.current) {
        setIcon(ref.current, "more-horizontal");
      }
    }
  }

  componentDidUpdate(prevProps: TwohopLinksRootViewProps) {
    if (this.props !== prevProps) {
      this.setState({
        displayedBoxCount: {
          forwardConnectedLinks: this.props.initialBoxCount,
          backwardConnectedLinks: this.props.initialBoxCount,
          twoHopLinks: this.props.initialBoxCount,
          newLinks: this.props.initialBoxCount,
          tagLinksList: this.props.initialBoxCount,
          frontmatterKeyLinksList: this.props.initialBoxCount,
        },
        displayedSectionCount: {
          forwardConnectedLinks: this.props.initialSectionCount,
          newLinks: this.props.initialSectionCount,
          backwardConnectedLinks: this.props.initialSectionCount,
          twoHopLinks: this.props.initialSectionCount,
          tagLinksList: this.props.initialSectionCount,
          frontmatterKeyLinksList: this.props.initialSectionCount,
        },
        prevProps: this.props,
        isLoaded: this.props.autoLoadTwoHopLinks,
      });
    }
    for (let ref of Object.values(this.loadMoreRefs)) {
      if (ref.current) {
        setIcon(ref.current, "more-horizontal");
      }
    }
  }

  render(): JSX.Element {
    const {
      showForwardConnectedLinks,
      showBackwardConnectedLinks,
      showTwohopLinks,
      showNewLinks,
      showTagsLinks,
      showPropertiesLinks,
      autoLoadTwoHopLinks,
    } = this.props;
    const { isLoaded } = this.state;

    if (!autoLoadTwoHopLinks && !isLoaded) {
      return (
        <button
          className="load-more-button"
          onClick={() => this.setState({ isLoaded: true })}
        >
          Show 2hop links
        </button>
      );
    }

    return (
      <div>
        {showForwardConnectedLinks && (
          <ConnectedLinksView
            fileEntities={this.props.forwardConnectedLinks}
            displayedBoxCount={
              this.state.displayedBoxCount.forwardConnectedLinks
            }
            onClick={this.props.onClick}
            getPreview={this.props.getPreview}
            getTitle={this.props.getTitle}
            onLoadMore={() => this.loadMoreBox("forwardConnectedLinks")}
            title={"Links"}
            className={"twohop-links-forward-links"}
            app={this.props.app}
          />
        )}
        {showBackwardConnectedLinks && (
          <ConnectedLinksView
            fileEntities={this.props.backwardConnectedLinks}
            displayedBoxCount={
              this.state.displayedBoxCount.backwardConnectedLinks
            }
            onClick={this.props.onClick}
            getPreview={this.props.getPreview}
            getTitle={this.props.getTitle}
            onLoadMore={() => this.loadMoreBox("backwardConnectedLinks")}
            title={"Back Links"}
            className={"twohop-links-back-links"}
            app={this.props.app}
          />
        )}
        {showTwohopLinks && (
          <TwohopLinksView
            twoHopLinks={this.props.twoHopLinks}
            onClick={this.props.onClick}
            getPreview={this.props.getPreview}
            getTitle={this.props.getTitle}
            app={this.props.app}
            displayedSectionCount={this.state.displayedSectionCount.twoHopLinks}
            initialDisplayedEntitiesCount={this.props.initialBoxCount}
            resetDisplayedEntitiesCount={this.props !== this.state.prevProps}
          />
        )}
        {this.state.displayedSectionCount.twoHopLinks <
          this.props.twoHopLinks.length && (
          <button
            ref={this.loadMoreRefs.twoHopLinks}
            className="load-more-button"
            onClick={() => this.loadMoreSections("twoHopLinks")}
          >
            Load more
          </button>
        )}
        {showNewLinks && (
          <NewLinksView
            fileEntities={this.props.newLinks}
            displayedBoxCount={this.state.displayedBoxCount.newLinks}
            onClick={this.props.onClick}
            getPreview={this.props.getPreview}
            getTitle={this.props.getTitle}
            onLoadMore={() => this.loadMoreBox("newLinks")}
            app={this.props.app}
          />
        )}
        {showTagsLinks && (
          <PropertiesLinksListView
            propertiesLinksList={this.props.tagLinksList}
            onClick={this.props.onClick}
            getPreview={this.props.getPreview}
            getTitle={this.props.getTitle}
            app={this.props.app}
            displayedSectionCount={
              this.state.displayedSectionCount.tagLinksList
            }
            initialDisplayedEntitiesCount={this.props.initialBoxCount}
            resetDisplayedEntitiesCount={this.props !== this.state.prevProps}
          />
        )}
        {this.state.displayedSectionCount.tagLinksList <
          this.props.tagLinksList.length && (
          <button
            ref={this.loadMoreRefs.tagLinksList}
            className="load-more-button"
            onClick={() => this.loadMoreSections("tagLinksList")}
          >
            Load more
          </button>
        )}
        {showPropertiesLinks && (
          <PropertiesLinksListView
            propertiesLinksList={this.props.frontmatterKeyLinksList}
            onClick={this.props.onClick}
            getPreview={this.props.getPreview}
            getTitle={this.props.getTitle}
            app={this.props.app}
            displayedSectionCount={
              this.state.displayedSectionCount.frontmatterKeyLinksList
            }
            initialDisplayedEntitiesCount={this.props.initialBoxCount}
            resetDisplayedEntitiesCount={this.props !== this.state.prevProps}
          />
        )}
        {this.state.displayedSectionCount.frontmatterKeyLinksList <
          this.props.frontmatterKeyLinksList.length && (
          <button
            ref={this.loadMoreRefs.frontmatterKeyLinksList}
            className="load-more-button"
            onClick={() => this.loadMoreSections("frontmatterKeyLinksList")}
          >
            Load more
          </button>
        )}
      </div>
    );
  }
}
