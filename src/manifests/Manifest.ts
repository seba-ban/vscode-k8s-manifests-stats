import {
  LineCounter,
  Document,
  ParsedNode,
  isMap,
  YAMLMap,
} from "yaml";

enum Keywords {
  kind = "kind",
  apiVersion = "apiVersion",
  metadata = "metadata",
  name = "name",
  namespace = "namespace",
  labels = "labels",
}

export class Manifest {
  constructor(
    private node: Document.Parsed<ParsedNode>,
    private lc: LineCounter,
    public readonly filePath: string
  ) {}

  get position() {
    const offset = this.node.contents?.srcToken?.offset;
    if (!offset) {
      return undefined;
    }
    return this.lc.linePos(offset);
  }

  get isValidK8sManifest() {
    return (
      this.node.get(Keywords.kind) &&
      this.node.get(Keywords.apiVersion) &&
      this.node.get(Keywords.metadata) &&
      this.name
    );
  }

  get kind() {
    return this.node.get(Keywords.kind) as string | undefined;
  }

  get apiVersion() {
    return this.node.get(Keywords.apiVersion) as string | undefined;
  }

  get metadata() {
    const metadata = this.node.get(Keywords.metadata);
    if (isMap(metadata)) {
      return metadata.toJSON() as Record<any, any>;
    }
  }

  #extractFromMetadata<T>(
    key: Keywords,
    validator: (val: any) => boolean
  ): T | undefined {
    const metadata = this.node.get(Keywords.metadata);

    if (!metadata || !isMap(metadata)) {
      return undefined;
    }
    const val = metadata.get(key);
    if (validator(val)) {
      return val as T;
    }
    return undefined;
  }

  get name() {
    return this.#extractFromMetadata<string>(
      Keywords.name,
      (val) => typeof val === "string"
    );
  }

  get namespace() {
    return this.#extractFromMetadata<string>(
      Keywords.namespace,
      (val) => typeof val === "string"
    );
  }

  get labels() {
    const labels = this.#extractFromMetadata<YAMLMap>(Keywords.labels, isMap);
    if (!labels) {
      return undefined;
    }
    return labels.toJSON() as Record<any, any>;
  }
}
