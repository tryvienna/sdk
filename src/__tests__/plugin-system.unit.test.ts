import { describe, expect, it, beforeEach, vi } from 'vitest';

import { definePlugin } from '../define-plugin';
import { defineIntegration } from '../define-integration';
import { defineEntity } from '../define-entity';
import { PluginSystem } from '../plugin-system';
import type { PluginIcon, EntityContext } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testIcon: PluginIcon = { svg: '<svg>test</svg>' };

const mockCtx: EntityContext = {
  storage: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), has: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
  integrations: {},
} as unknown as EntityContext;

const MockComponent = () => null;

function makeIntegration(id: string) {
  return defineIntegration({
    id,
    name: id,
    icon: testIcon,
    createClient: async () => ({ api: true }),
  });
}

function makeEntity(type: string) {
  return defineEntity({
    type,
    name: type,
    icon: testIcon,
    uri: ['id'],
  });
}

function makePlugin(id: string, opts: { integrationId?: string; entityType?: string } = {}) {
  const integrationId = opts.integrationId ?? `${id}_integration`;
  const entityType = opts.entityType ?? `${id}_entity`;
  return definePlugin({
    id,
    name: id,
    icon: testIcon,
    integrations: [makeIntegration(integrationId)],
    entities: [makeEntity(entityType)],
  });
}

function registerHandlers(system: PluginSystem, type: string) {
  system.registerEntityHandlers(type, {
    resolve: async (id) => ({
      id: id['id']!,
      type,
      uri: `@drift//${type}/${id['id']}`,
      title: `${type} ${id['id']}`,
    }),
    search: async (filters) => {
      const items = [
        { id: '1', type, uri: `@drift//${type}/1`, title: `${type} 1` },
        { id: '2', type, uri: `@drift//${type}/2`, title: `${type} 2` },
      ];
      if (filters?.query) {
        return items.filter((e) =>
          e.title.toLowerCase().includes(filters.query!.toLowerCase())
        );
      }
      return items.slice(0, filters?.limit ?? 20);
    },
    resolveContext: async (entity) => `# ${(entity as { title: string }).title}`,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginSystem', () => {
  let system: PluginSystem;

  beforeEach(() => {
    system = new PluginSystem();
  });

  // ── Plugin Registration ──────────────────────────────────────────────

  describe('registerPlugin', () => {
    it('registers a plugin and makes it queryable', () => {
      const plugin = makePlugin('test');
      system.registerPlugin(plugin);

      expect(system.getPlugin('test')).toBe(plugin);
      expect(system.getPluginIds()).toEqual(['test']);
    });

    it('throws on duplicate plugin id', () => {
      system.registerPlugin(makePlugin('test'));
      expect(() => system.registerPlugin(makePlugin('test', {
        integrationId: 'other_int',
        entityType: 'other_entity',
      }))).toThrow(/Plugin 'test' is already registered/);
    });

    it('throws on integration id conflict across plugins', () => {
      system.registerPlugin(makePlugin('plugin_a', { integrationId: 'shared_int' }));
      expect(() =>
        system.registerPlugin(makePlugin('plugin_b', { integrationId: 'shared_int', entityType: 'unique_entity' }))
      ).toThrow(/Integration 'shared_int' is already registered/);
    });

    it('throws on entity type conflict across plugins', () => {
      system.registerPlugin(makePlugin('plugin_a', { entityType: 'shared_type' }));
      expect(() =>
        system.registerPlugin(makePlugin('plugin_b', { entityType: 'shared_type', integrationId: 'unique_int' }))
      ).toThrow(/Entity type 'shared_type' is already registered/);
    });
  });

  describe('unregisterPlugin', () => {
    it('removes plugin and all its integrations/entities/handlers', () => {
      system.registerPlugin(makePlugin('test'));
      registerHandlers(system, 'test_entity');

      expect(system.unregisterPlugin('test')).toBe(true);
      expect(system.getPlugin('test')).toBeUndefined();
      expect(system.getIntegration('test_integration')).toBeUndefined();
      expect(system.getEntity('test_entity')).toBeUndefined();
      expect(system.getEntityHandlers('test_entity')).toBeUndefined();
    });

    it('returns false for unknown plugin', () => {
      expect(system.unregisterPlugin('nonexistent')).toBe(false);
    });

    it('allows re-registration after unregister', () => {
      const plugin = makePlugin('test');
      system.registerPlugin(plugin);
      system.unregisterPlugin('test');
      system.registerPlugin(plugin);

      expect(system.getPlugin('test')).toBe(plugin);
    });
  });

  // ── Plugin Queries ───────────────────────────────────────────────────

  describe('getPlugins', () => {
    it('returns all registered plugins', () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));

      const plugins = system.getPlugins();
      expect(plugins).toHaveLength(2);
    });
  });

  // ── Integration Queries ──────────────────────────────────────────────

  describe('integration queries', () => {
    it('gets an integration by id', () => {
      system.registerPlugin(makePlugin('test'));

      const integration = system.getIntegration('test_integration');
      expect(integration).toBeDefined();
      expect(integration!.id).toBe('test_integration');
    });

    it('gets all integrations', () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));

      expect(system.getAllIntegrations()).toHaveLength(2);
    });

    it('getPluginForIntegration returns correct plugin id', () => {
      system.registerPlugin(makePlugin('test'));
      expect(system.getPluginForIntegration('test_integration')).toBe('test');
    });

    it('getPluginForIntegration returns undefined for unknown integration', () => {
      expect(system.getPluginForIntegration('nonexistent')).toBeUndefined();
    });
  });

  // ── Entity Queries ───────────────────────────────────────────────────

  describe('entity queries', () => {
    it('gets an entity definition by type', () => {
      system.registerPlugin(makePlugin('test'));

      const entity = system.getEntity('test_entity');
      expect(entity).toBeDefined();
      expect(entity!.type).toBe('test_entity');
    });

    it('gets all entity types', () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));

      const types = system.getEntityTypes();
      expect(types).toContain('alpha_entity');
      expect(types).toContain('beta_entity');
    });

    it('getAllEntities returns all entity definitions', () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));

      const entities = system.getAllEntities();
      expect(entities).toHaveLength(2);
    });
  });

  describe('registerEntityHandlers', () => {
    it('throws when entity type is not registered', () => {
      expect(() =>
        system.registerEntityHandlers('nonexistent', {})
      ).toThrow(/entity type 'nonexistent' is not registered/);
    });
  });

  // ── Entity Operations (handler-based) ────────────────────────────────

  describe('resolveEntity', () => {
    it('resolves an entity from its URI using registered handlers', async () => {
      system.registerPlugin(makePlugin('test'));
      registerHandlers(system, 'test_entity');

      const entity = await system.resolveEntity('@drift//test_entity/abc', mockCtx);
      expect(entity).toEqual({
        id: 'abc',
        type: 'test_entity',
        uri: '@drift//test_entity/abc',
        title: 'test_entity abc',
      });
    });

    it('returns null for unknown type', async () => {
      const result = await system.resolveEntity('@drift//unknown/123', mockCtx);
      expect(result).toBeNull();
    });

    it('returns null when no handlers registered', async () => {
      system.registerPlugin(makePlugin('test'));
      const result = await system.resolveEntity('@drift//test_entity/abc', mockCtx);
      expect(result).toBeNull();
    });

    it('catches errors from malformed URIs and returns null', async () => {
      const result = await system.resolveEntity('not-a-valid-uri', mockCtx);
      expect(result).toBeNull();
      expect(mockCtx.logger.error).toHaveBeenCalled();
    });
  });

  describe('searchEntities', () => {
    it('searches across all types with handlers', async () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));
      registerHandlers(system, 'alpha_entity');
      registerHandlers(system, 'beta_entity');

      const results = await system.searchEntities('1', mockCtx);
      expect(results.length).toBeGreaterThanOrEqual(2);
      const titles = results.map((r) => r.title);
      expect(titles).toContain('alpha_entity 1');
      expect(titles).toContain('beta_entity 1');
    });

    it('filters by type', async () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));
      registerHandlers(system, 'alpha_entity');
      registerHandlers(system, 'beta_entity');

      const results = await system.searchEntities('1', mockCtx, ['alpha_entity']);
      expect(results.every((r) => r.type === 'alpha_entity')).toBe(true);
    });

    it('skips types without handlers', async () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));
      registerHandlers(system, 'alpha_entity');
      // beta_entity has no handlers

      const results = await system.searchEntities('1', mockCtx);
      expect(results.every((r) => r.type === 'alpha_entity')).toBe(true);
    });

    it('logs warning when a handler rejects and still returns other results', async () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerPlugin(makePlugin('beta'));
      registerHandlers(system, 'alpha_entity');
      system.registerEntityHandlers('beta_entity', {
        search: async () => { throw new Error('search boom'); },
      });

      const results = await system.searchEntities('1', mockCtx);
      expect(results.every((r) => r.type === 'alpha_entity')).toBe(true);
      expect(mockCtx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('beta_entity'),
        expect.objectContaining({ error: expect.stringContaining('search boom') }),
      );
    });

    it('returns empty when all handlers reject', async () => {
      system.registerPlugin(makePlugin('alpha'));
      system.registerEntityHandlers('alpha_entity', {
        search: async () => { throw new Error('boom'); },
      });

      const results = await system.searchEntities('query', mockCtx);
      expect(results).toEqual([]);
    });
  });

  describe('resolveEntityContext', () => {
    it('returns context markdown', async () => {
      system.registerPlugin(makePlugin('test'));
      registerHandlers(system, 'test_entity');

      const ctx = await system.resolveEntityContext('@drift//test_entity/abc', mockCtx);
      expect(ctx).toBe('# test_entity abc');
    });

    it('returns null for unknown type', async () => {
      const ctx = await system.resolveEntityContext('@drift//unknown/abc', mockCtx);
      expect(ctx).toBeNull();
    });

    it('returns null when no handlers registered for type', async () => {
      system.registerPlugin(makePlugin('test'));
      const ctx = await system.resolveEntityContext('@drift//test_entity/abc', mockCtx);
      expect(ctx).toBeNull();
    });

    it('catches synchronous errors (e.g. malformed URI) and returns null', async () => {
      const ctx = await system.resolveEntityContext('not-a-valid-uri', mockCtx);
      expect(ctx).toBeNull();
      expect(mockCtx.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve context"),
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  // ── Type Summaries ───────────────────────────────────────────────────

  describe('getEntityTypeSummaries', () => {
    it('returns summaries for all registered entity types', () => {
      system.registerPlugin(makePlugin('test'));

      const summaries = system.getEntityTypeSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]!.type).toBe('test_entity');
      expect(summaries[0]!.displayName).toBe('test_entity');
    });
  });

  // ── Canvas Queries ───────────────────────────────────────────────────

  describe('canvas queries', () => {
    it('returns nav canvases sorted by priority', () => {
      system.registerPlugin(definePlugin({
        id: 'low_priority',
        name: 'Low',
        icon: testIcon,
        canvases: {
          'nav-sidebar': { component: MockComponent, label: 'Low', priority: 10 },
        },
      }));
      system.registerPlugin(definePlugin({
        id: 'high_priority',
        name: 'High',
        icon: testIcon,
        canvases: {
          'nav-sidebar': { component: MockComponent, label: 'High', priority: 90 },
        },
      }));

      const navs = system.getNavCanvases();
      expect(navs).toHaveLength(2);
      expect(navs[0]!.pluginId).toBe('high_priority');
      expect(navs[1]!.pluginId).toBe('low_priority');
    });

    it('returns drawer canvas for a plugin', () => {
      system.registerPlugin(definePlugin({
        id: 'with_drawer',
        name: 'With Drawer',
        icon: testIcon,
        canvases: {
          'nav-sidebar': { component: MockComponent, label: 'Nav' },
          drawer: { component: MockComponent, label: 'Drawer' },
        },
      }));

      const drawer = system.getDrawerCanvas('with_drawer');
      expect(drawer).toBeDefined();
      expect(drawer!.config.label).toBe('Drawer');
    });

    it('returns undefined for plugin without drawer', () => {
      system.registerPlugin(definePlugin({
        id: 'no_drawer',
        name: 'No Drawer',
        icon: testIcon,
      }));

      expect(system.getDrawerCanvas('no_drawer')).toBeUndefined();
    });

    it('returns menu bar items sorted by priority', () => {
      system.registerPlugin(definePlugin({
        id: 'menu_a',
        name: 'A',
        icon: testIcon,
        canvases: {
          'menu-bar': { icon: MockComponent, component: MockComponent, label: 'A', priority: 20 },
        },
      }));
      system.registerPlugin(definePlugin({
        id: 'menu_b',
        name: 'B',
        icon: testIcon,
        canvases: {
          'menu-bar': { icon: MockComponent, component: MockComponent, label: 'B', priority: 80 },
        },
      }));

      const items = system.getMenuBarItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.pluginId).toBe('menu_b');
    });

    it('returns entity drawers from entities with UI', () => {
      const entityWithUI = defineEntity({
        type: 'ui_entity',
        name: 'UI Entity',
        icon: testIcon,
        uri: ['id'],
        ui: {
          drawer: MockComponent,
          card: MockComponent,
        },
      });

      system.registerPlugin(definePlugin({
        id: 'ui_plugin',
        name: 'UI Plugin',
        icon: testIcon,
        entities: [entityWithUI],
      }));

      const drawer = system.getEntityDrawer('ui_entity');
      expect(drawer).toBeDefined();
      expect(drawer!.pluginId).toBe('ui_plugin');
      expect(drawer!.component).toBe(MockComponent);

      const allDrawers = system.getEntityDrawers();
      expect(allDrawers).toHaveLength(1);
    });

    it('returns undefined for entity without UI drawer', () => {
      system.registerPlugin(makePlugin('test'));
      expect(system.getEntityDrawer('test_entity')).toBeUndefined();
    });
  });
});
