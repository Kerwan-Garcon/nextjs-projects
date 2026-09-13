import type { DomainKey } from '@saveus/common';

/**
 * Source connector port.
 *
 * Adding an intake channel means implementing this one interface and
 * registering it - see README, "How to add a source connector". Connectors
 * return documents; they never decide what becomes a problem.
 */
export interface RawDocument {
  /** Stable per-connector identity, used for dedup across runs. */
  externalId: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  body: string;
  /**
   * Where `body` came from. The MVP connectors are seeded with descriptive
   * intake text rather than scraped prose, and say so, so nothing synthetic can
   * be mistaken for a quotation from the publisher.
   */
  bodyProvenance: 'PUBLISHER_ABSTRACT' | 'SYNTHETIC_DEMO';
  suggestedDomains: DomainKey[];
}

export interface SourceConnector {
  readonly name: string;
  readonly description: string;
  /** Publisher hosts this connector is allowed to produce documents for. */
  readonly allowedHosts: readonly string[];
  fetch(): Promise<RawDocument[]>;
}

export class ConnectorRegistry {
  private readonly connectors = new Map<string, SourceConnector>();

  register(connector: SourceConnector): this {
    if (this.connectors.has(connector.name)) {
      throw new Error(`Connector "${connector.name}" is already registered`);
    }
    this.connectors.set(connector.name, connector);
    return this;
  }

  get(name: string): SourceConnector | undefined {
    return this.connectors.get(name);
  }

  list(): SourceConnector[] {
    return [...this.connectors.values()];
  }
}
