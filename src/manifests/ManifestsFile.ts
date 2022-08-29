import { Manifest } from "./Manifest";
import {
  MultipleManifests,
  ManifestsByKind,
  ManifestsByLabels,
  ManifestsByNs,
  UNKNOWN_NS,
} from "./MultipleManifests";
import { parseAllDocuments, LineCounter, Document, ParsedNode } from "yaml";
import * as fs from "fs/promises";

export class ManifestsFile extends MultipleManifests {
  manifests: Manifest[] = [];
  byKinds: ManifestsByKind = {};
  byLabels: ManifestsByLabels = {};
  byNs: ManifestsByNs = {};
  invalidManifests: Manifest[] = [];
  invalidSource = true;
  initialized = false;

  constructor(private filePath: string) {
    super();
  }

  async init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    let content: string;
    try {
      content = await fs.readFile(this.filePath, "utf8");
    } catch (err) {
      this.invalidSource = true;
      return;
    }

    const lc = new LineCounter();

    let parsed: Document.Parsed<ParsedNode>[];

    try {
      parsed = parseAllDocuments(content, {
        keepSourceTokens: true,
        lineCounter: lc,
      });
    } catch (err) {
      this.invalidSource = true;
      return;
    }

    this.invalidSource = false;

    for (const node of parsed) {
      const manifest = new Manifest(node, lc, this.filePath);
      this.manifests.push(manifest);

      if (!manifest.isValidK8sManifest) {
        this.invalidManifests.push(manifest);
        continue;
      }

      const { namespace, labels, apiVersion, kind } = manifest;

      if (apiVersion && kind) {
        if (!this.byKinds[apiVersion]) {
          this.byKinds[apiVersion] = {};
        }
        if (!this.byKinds[apiVersion][kind]) {
          this.byKinds[apiVersion][kind] = [];
        }
        this.byKinds[apiVersion][kind].push(manifest);
      }

      if (!this.byNs[namespace || UNKNOWN_NS]) {
        this.byNs[namespace || UNKNOWN_NS] = [];
      }
      this.byNs[namespace || UNKNOWN_NS].push(manifest);

      if (labels) {
        for (const [key, val] of Object.entries(labels)) {
          if (!this.byLabels[key]) {
            this.byLabels[key] = {};
          }
          if (!this.byLabels[key][val]) {
            this.byLabels[key][val] = [];
          }
          this.byLabels[key][val].push(manifest);
        }
      }
    }
  }
}
