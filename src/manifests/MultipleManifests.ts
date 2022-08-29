import { Manifest } from "./Manifest";
import * as vscode from "vscode";

export const UNKNOWN_NS = "undefinedNs";

const GLOBAL_MEMO = new WeakMap<object, number>();

export type ManifestsByKind = {
  [apiVersion: string]: {
    [kind: string]: Manifest[];
  };
};

export type ManifestsByLabels = {
  [label: string]: {
    [labelValue: string]: Manifest[];
  };
};

export type ManifestsByNs = {
  [namespace: string]: Manifest[];
};

interface ManifestsObj {
  [key: string]: ManifestsObj | Manifest[];
}

export interface TreeSources {
  kind: ManifestsByKind;
  labels: ManifestsByLabels;
  ns: ManifestsByNs;
}

export abstract class MultipleManifests {
  abstract manifests: Manifest[];
  abstract byKinds: ManifestsByKind;
  abstract byLabels: ManifestsByLabels;
  abstract byNs: ManifestsByNs;
  abstract invalidManifests: Manifest[];
  abstract invalidSource: boolean;
  abstract initialized: boolean;

  /** should be called always to initialize */
  abstract init(): Promise<void>;

  get length() {
    const a = this.byKinds;
    return this.manifests.length;
  }

  get validLength() {
    return this.manifests.length - this.invalidManifests.length;
  }

  get invalidLength() {
    return this.invalidManifests.length;
  }

  async getTreeSources(): Promise<TreeSources> {
    if (!this.initialized) {
      await this.init();
    }

    return {
      kind: this.byKinds,
      labels: this.byLabels,
      ns: this.byNs,
    };
  }
}

export class ManifestsTree implements vscode.TreeDataProvider<Dependency> {
  constructor(
    private key: keyof TreeSources,
    public manifests?: MultipleManifests
  ) {}

  _onDidChangeTreeData: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Dependency): Promise<Dependency[]> {
    if (!this.manifests) {
      return [];
    }

    const current = element
      ? element.children
      : ((await this.manifests.getTreeSources())[this.key] as ManifestsObj);

    if (!current) {
      return [];
    }

    let children: Dependency[];
    if (Array.isArray(current)) {
      children = current.map(
        (m) =>
          new Dependency(
            this.key === "kind"
              ? m.name || "noname"
              : `${m.apiVersion}/${m.kind}:${m.name}`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            m
          )
      );
    } else {
      children = [];
      for (const [key, val] of Object.entries(current)) {
        children.push(
          new Dependency(
            key,
            vscode.TreeItemCollapsibleState.Collapsed,
            val,
            undefined
          )
        );
      }
    }

    children.sort((a, b) => a.label.localeCompare(b.label));
    return children;
  }
}

class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: ManifestsObj | Manifest[],
    private manifest?: Manifest
  ) {
    super(label, collapsibleState);
    if (this.manifest) {
      this.tooltip = this.manifest.filePath;
      const pos = this.manifest.position;
      this.command = {
        title: "",
        command: "vscode.open",
        arguments: [
          this.manifest.filePath,
          <vscode.TextDocumentShowOptions>{
            selection: new vscode.Range(
              pos?.line || 0,
              pos?.col || 0,
              pos?.line || 0,
              pos?.col || 0
            ),
          },
        ],
      };
      // this.description = this.version;
    } else if (this.children) {
      this.tooltip = String(this.getChildrenManifestsCount(this.children));
      this.label = this.label + ` [${this.tooltip}]`;
    }
  }

  getChildrenManifestsCount(el?: ManifestsObj | Manifest[]) {
    if (!el) {
      return 0;
    }

    if (Array.isArray(el)) {
      return el.length;
    }

    let count = 0;

    for (const val of Object.values(el)) {
      if (Array.isArray(val)) {
        count += val.length;
      } else {
        count += this.getChildrenManifestsCount(val);
      }
    }

    return count;
  }
}
