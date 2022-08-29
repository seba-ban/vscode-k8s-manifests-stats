import { ManifestsFile } from "./ManifestsFile";
import { Manifest } from "./Manifest";
import {
  MultipleManifests,
  ManifestsByKind,
  ManifestsByLabels,
  ManifestsByNs,
} from "./MultipleManifests";
import * as _glob from "glob";
import { promisify } from "node:util";
import { join } from "node:path";
import { deepmerge } from "deepmerge-ts";

const glob = promisify(_glob);

export class ManifestsFolder extends MultipleManifests {
  manifests: Manifest[] = [];
  byKinds: ManifestsByKind = {};
  byLabels: ManifestsByLabels = {};
  byNs: ManifestsByNs = {};
  invalidManifests: Manifest[] = [];
  invalidSource = true;
  initialized = false;

  constructor(private folderPath: string) {
    super();
  }

  async init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    let files: string[];
    try {
      files = await glob(join(this.folderPath, "**", "*.yaml"));
    } catch (err) {
      this.invalidSource = true;
      return;
    }

    this.invalidSource = false;

    for (const filePath of files) {
      const manifestFile = new ManifestsFile(filePath);
      await manifestFile.init();
      if (manifestFile.invalidSource) {
        continue;
      }

      this.manifests = deepmerge(this.manifests, manifestFile.manifests);
      this.invalidManifests = deepmerge(
        this.invalidManifests,
        manifestFile.invalidManifests
      );
      this.byKinds = deepmerge(this.byKinds, manifestFile.byKinds);
      this.byLabels = deepmerge(this.byLabels, manifestFile.byLabels);
      this.byNs = deepmerge(this.byNs, manifestFile.byNs);
    }
  }
}
