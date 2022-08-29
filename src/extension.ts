// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ManifestsFile } from "./manifests/ManifestsFile";
import { ManifestsTree, TreeSources } from "./manifests/MultipleManifests";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const active = vscode.window.visibleTextEditors?.[0]?.document?.uri?.fsPath;

  const keys: (keyof TreeSources)[] = ["kind", "labels", "ns"];

  const trees = keys.map(
    (k) =>
      new ManifestsTree(
        k,
        active && active.endsWith(".yaml")
          ? new ManifestsFile(active)
          : undefined
      )
  );

  vscode.window.onDidChangeVisibleTextEditors((e) => {
    const active = e?.[0]?.document?.uri?.fsPath;
    if (!active || !active.endsWith(".yaml")) {
      return;
    }
    for (const tree of trees) {
      tree.manifests = new ManifestsFile(active);
      tree._onDidChangeTreeData.fire();
    }
  });

  for (let i = 0; i < keys.length; i++) {
    vscode.window.createTreeView(keys[i], {
      treeDataProvider: trees[i],
      showCollapseAll: true,
    });
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
