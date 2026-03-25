/**
 * PluginSystem — Unified registry for plugins, integrations, and entities.
 *
 * Replaces the separate EntityRegistry, IntegrationRegistry, and PluginRegistry
 * with a single class that manages all registered definitions and provides
 * query methods for the GraphQL layer, renderer, and IPC handlers.
 *
 * Entity registration, handler management, and operations (resolve, search,
 * resolveContext, getTypeSummaries) are delegated to an internal EntityRegistry
 * to avoid duplicating that logic.
 */

import type { ComponentType } from 'react';
import type { BaseEntity, EntityTypeSummary } from './schemas';
import type { EntityDefinition, EntityDrawerProps, EntityCardProps } from './define-entity';
import type { PluginDefinition } from './define-plugin';
import type { IntegrationDefinition, EntityContext } from './types';
import { EntityRegistry } from './registry';
import type { EntityHandlers } from './registry';
import type {
  NavSidebarCanvasConfig,
  DrawerCanvasConfig,
  MenuBarCanvasConfig,
} from './canvas';

// ─────────────────────────────────────────────────────────────────────────────
// Resolved Canvas Types (canvas config + owning plugin ID)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedNavSidebar {
  pluginId: string;
  config: NavSidebarCanvasConfig;
}

export interface ResolvedDrawer {
  pluginId: string;
  config: DrawerCanvasConfig;
}

export interface ResolvedMenuBar {
  pluginId: string;
  config: MenuBarCanvasConfig;
}

export interface ResolvedEntityDrawer {
  entityType: string;
  pluginId: string;
  component: ComponentType<EntityDrawerProps>;
  card?: ComponentType<EntityCardProps>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PluginSystem
// ─────────────────────────────────────────────────────────────────────────────

export class PluginSystem {
  private plugins = new Map<string, PluginDefinition>();
  private integrations = new Map<string, IntegrationDefinition>();
  private entityToPlugin = new Map<string, string>();
  private integrationToPlugin = new Map<string, string>();

  /** Internal EntityRegistry — all entity definitions, handlers, and operations delegate here. */
  private entityRegistry = new EntityRegistry();

  // ── Plugin Registration ──────────────────────────────────────────────

  registerPlugin(plugin: PluginDefinition): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin '${plugin.id}' is already registered`);
    }

    // Check for integration ID conflicts
    for (const integration of plugin.integrations) {
      if (this.integrations.has(integration.id)) {
        throw new Error(
          `Integration '${integration.id}' is already registered by plugin '${this.integrationToPlugin.get(integration.id)}'`,
        );
      }
    }

    // Check for entity type conflicts (EntityRegistry.register will also throw,
    // but we check here first for a better error message that includes the owning plugin)
    for (const entity of plugin.entities) {
      if (this.entityRegistry.getDefinition(entity.type)) {
        throw new Error(
          `Entity type '${entity.type}' is already registered by plugin '${this.entityToPlugin.get(entity.type)}'`,
        );
      }
    }

    // Register everything
    this.plugins.set(plugin.id, plugin);

    for (const integration of plugin.integrations) {
      this.integrations.set(integration.id, integration);
      this.integrationToPlugin.set(integration.id, plugin.id);
    }

    for (const entity of plugin.entities) {
      this.entityRegistry.register(entity);
      this.entityToPlugin.set(entity.type, plugin.id);
    }
  }

  unregisterPlugin(id: string): boolean {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;

    // Remove all integrations and entities from this plugin
    for (const integration of plugin.integrations) {
      this.integrations.delete(integration.id);
      this.integrationToPlugin.delete(integration.id);
    }
    for (const entity of plugin.entities) {
      this.entityRegistry.unregister(entity.type);
      this.entityToPlugin.delete(entity.type);
    }

    this.plugins.delete(id);
    return true;
  }

  // ── Plugin Queries ───────────────────────────────────────────────────

  getPlugin(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }

  getPlugins(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  // ── Integration Queries ──────────────────────────────────────────────

  getIntegration(id: string): IntegrationDefinition | undefined {
    return this.integrations.get(id);
  }

  getAllIntegrations(): IntegrationDefinition[] {
    return Array.from(this.integrations.values());
  }

  /** Get the plugin ID that registered a given integration. */
  getPluginForIntegration(integrationId: string): string | undefined {
    return this.integrationToPlugin.get(integrationId);
  }

  // ── Entity Queries (delegated to EntityRegistry) ────────────────────

  getEntity(type: string): EntityDefinition | undefined {
    return this.entityRegistry.getDefinition(type);
  }

  getEntityTypes(): string[] {
    return this.entityRegistry.getTypes();
  }

  getAllEntities(): EntityDefinition[] {
    return this.entityRegistry.getAllDefinitions();
  }

  // ── Entity Handlers (delegated to EntityRegistry) ───────────────────

  /** Register resolve/search/resolveContext handlers for an entity type. */
  registerEntityHandlers<TData = BaseEntity>(type: string, handlers: EntityHandlers<TData>): void {
    this.entityRegistry.registerHandlers(type, handlers);
  }

  getEntityHandlers(type: string): EntityHandlers | undefined {
    return this.entityRegistry.getHandlers(type);
  }

  // ── Entity Operations (delegated to EntityRegistry) ─────────────────

  async resolveEntity(uri: string, ctx: EntityContext): Promise<BaseEntity | null> {
    return this.entityRegistry.getByURI(uri, ctx);
  }

  async searchEntities(
    query: string,
    ctx: EntityContext,
    types?: string[],
    limit = 20,
  ): Promise<BaseEntity[]> {
    return this.entityRegistry.search(query, ctx, types, limit);
  }

  async resolveEntityContext(uri: string, ctx: EntityContext): Promise<string | null> {
    return this.entityRegistry.resolveContext(uri, ctx);
  }

  // ── Type Summaries (delegated to EntityRegistry) ────────────────────

  getEntityTypeSummaries(): EntityTypeSummary[] {
    return this.entityRegistry.getTypeSummaries();
  }

  // ── Canvas Queries ───────────────────────────────────────────────────

  getNavCanvases(): ResolvedNavSidebar[] {
    const result: ResolvedNavSidebar[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.canvases['nav-sidebar']) {
        result.push({ pluginId: plugin.id, config: plugin.canvases['nav-sidebar'] });
      }
    }
    return result.sort((a, b) => (b.config.priority ?? 50) - (a.config.priority ?? 50));
  }

  getDrawerCanvas(pluginId: string): ResolvedDrawer | undefined {
    const plugin = this.plugins.get(pluginId);
    if (!plugin?.canvases.drawer) return undefined;
    return { pluginId, config: plugin.canvases.drawer };
  }

  getMenuBarItems(): ResolvedMenuBar[] {
    const result: ResolvedMenuBar[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.canvases['menu-bar']) {
        result.push({ pluginId: plugin.id, config: plugin.canvases['menu-bar'] });
      }
    }
    return result.sort((a, b) => (b.config.priority ?? 50) - (a.config.priority ?? 50));
  }

  getEntityDrawer(type: string): ResolvedEntityDrawer | undefined {
    const def = this.entityRegistry.getDefinition(type);
    if (!def?.ui?.drawer) return undefined;
    const pluginId = this.entityToPlugin.get(type);
    if (!pluginId) return undefined;
    return {
      entityType: type,
      pluginId,
      component: def.ui.drawer,
      card: def.ui.card,
    };
  }

  getEntityDrawers(): ResolvedEntityDrawer[] {
    const result: ResolvedEntityDrawer[] = [];
    for (const def of this.entityRegistry.getAllDefinitions()) {
      if (def.ui?.drawer) {
        const pluginId = this.entityToPlugin.get(def.type);
        if (pluginId) {
          result.push({
            entityType: def.type,
            pluginId,
            component: def.ui.drawer,
            card: def.ui.card,
          });
        }
      }
    }
    return result;
  }
}
