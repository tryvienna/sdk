/**
 * defineEntity() — Factory for creating validated, immutable entity definitions.
 *
 * Entities are **types** (nouns) — they describe what data looks like.
 * All operations (queries, mutations, resolve, search) live in the
 * integration's `schema` callback using Pothos directly.
 *
 * `defineEntity` produces metadata-only definitions used for:
 * - URI pattern registration
 * - Display metadata (emoji, colors, output fields)
 * - Cache configuration
 * - UI component overrides (drawer, card)
 *
 * Usage:
 * ```ts
 * export const githubPrEntity = defineEntity({
 *   type: 'github_pr',
 *   name: 'GitHub Pull Request',
 *   icon: { svg: '...' },
 *   uri: ['owner', 'repo', 'number'],
 *   display: { emoji: '🔀', colors: { ... } },
 *   cache: { ttl: 30_000, maxSize: 200 },
 *   ui: { drawer: PRDrawer },
 * });
 * ```
 */

import type { ComponentType } from 'react';
import type {
  EntityDisplayMetadata,
  EntityCacheConfig,
  EntitySource,
} from './schemas';
import { EntityTypeSchema } from './schemas';
import { EntityDefinitionError } from './errors';
import { buildEntityURI, parseEntityURI } from './uri';
import type { PluginIcon } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// UI Prop Types (for entity drawer and card components)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for a DrawerContainer component injected by the host app.
 * Entity drawers use this to set title, footer, and header actions
 * without depending on the host's internal drawer chrome.
 */
export interface DrawerContainerProps {
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export interface EntityDrawerProps {
  uri: string;
  /** Container injected by the host app — wrap drawer content in this. */
  DrawerContainer: ComponentType<DrawerContainerProps>;
  headerActions?: React.ReactNode;
  onNavigate?: (entityUri: string, entityType: string, label?: string) => void;
  onClose?: () => void;
  projectId?: string;
}

export interface EntityCardProps {
  uri: string;
  label?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Definition Config (input to defineEntity)
// ─────────────────────────────────────────────────────────────────────────────

export interface EntityDefinitionConfig {
  /** Entity type identifier (validated against EntityTypeSchema) */
  type: string;
  /** Human-readable display name */
  name: string;
  /** Static icon asset */
  icon: PluginIcon;
  /** URI segment names (e.g., ['owner', 'repo', 'number']) */
  uri: string[];
  /** Description of what this entity represents */
  description?: string;
  /** Where this entity comes from */
  source?: EntitySource;
  /** Display metadata for automatic styling */
  display?: EntityDisplayMetadata;
  /** Cache configuration */
  cache?: EntityCacheConfig;
  /** UI components (optional) */
  ui?: {
    drawer?: ComponentType<EntityDrawerProps>;
    card?: ComponentType<EntityCardProps>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Definition (output of defineEntity)
// ─────────────────────────────────────────────────────────────────────────────

export interface EntityDefinition {
  readonly __brand: 'EntityDefinition';
  readonly type: string;
  readonly name: string;
  readonly icon: PluginIcon;
  readonly uriSegments: readonly string[];
  readonly description?: string;
  readonly source: EntitySource;
  readonly display?: EntityDisplayMetadata;
  readonly cache?: EntityCacheConfig;
  readonly ui?: {
    readonly drawer?: ComponentType<EntityDrawerProps>;
    readonly card?: ComponentType<EntityCardProps>;
  };

  /** Build a URI for this entity type */
  createURI(id: Record<string, string>): string;
  /** Parse a URI and extract ID segments */
  parseURI(uri: string): { type: string; id: Record<string, string> };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function defineEntity(config: EntityDefinitionConfig): EntityDefinition {
  const typeResult = EntityTypeSchema.safeParse(config.type);
  if (!typeResult.success) {
    throw new EntityDefinitionError(
      config.type,
      'type',
      `Invalid entity type '${config.type}': ${typeResult.error.issues[0]?.message}`,
    );
  }

  if (!config.name?.trim()) {
    throw new EntityDefinitionError(config.type, 'name', 'name is required');
  }

  if (!config.uri?.length) {
    throw new EntityDefinitionError(
      config.type,
      'uri',
      'uri must have at least one segment',
    );
  }

  const uriPath = { segments: config.uri as readonly string[] };

  const definition: EntityDefinition = {
    __brand: 'EntityDefinition' as const,
    type: config.type,
    name: config.name,
    icon: config.icon,
    uriSegments: Object.freeze([...config.uri]),
    description: config.description,
    source: config.source ?? 'integration',
    display: config.display,
    cache: config.cache,
    ui: config.ui,

    createURI(id: Record<string, string>): string {
      return buildEntityURI(config.type, id, uriPath);
    },

    parseURI(uri: string) {
      return parseEntityURI(uri, uriPath);
    },
  };

  return Object.freeze(definition);
}

/** Type guard for EntityDefinition */
export function isEntityDefinition(value: unknown): value is EntityDefinition {
  if (!value || typeof value !== 'object') return false;
  const def = value as Record<string, unknown>;
  return def['__brand'] === 'EntityDefinition';
}
