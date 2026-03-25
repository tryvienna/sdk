# @tryvienna/sdk

Plugin SDK for building Vienna integrations. Define entities, connect external APIs, extend the GraphQL schema, and contribute UI surfaces — all from a single package.

```bash
pnpm add @tryvienna/sdk
```

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [definePlugin()](#defineplugin)
- [defineIntegration()](#defineintegration)
- [defineEntity()](#defineentity)
- [Schema Extension (SchemaBuilder)](#schema-extension-schemabuilder)
- [React Hooks](#react-hooks)
- [Canvas UI Surfaces](#canvas-ui-surfaces)
- [URI System](#uri-system)
- [Testing](#testing)
- [GraphQL Codegen](#graphql-codegen)
- [Error Handling](#error-handling)
- [License](#license)

---

## Quick Start

A minimal plugin that adds a weather forecast to the menu bar:

```ts
// src/index.ts
import { definePlugin, defineIntegration } from '@tryvienna/sdk';
import { WeatherMenuBarIcon } from './ui/WeatherMenuBarIcon';
import { WeatherMenuBarContent } from './ui/WeatherMenuBarContent';
import { WeatherDrawer } from './ui/WeatherDrawer';
import { registerWeatherSchema } from './schema';

const weatherApi = defineIntegration<Record<string, never>>({
  id: 'weather_api',
  name: 'Weather API',
  icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>' },
  createClient: async () => ({}),
  schema: registerWeatherSchema,
});

export const weatherPlugin = definePlugin({
  id: 'weather',
  name: 'Weather',
  description: 'Weather forecast in the menu bar',
  icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>' },
  integrations: [weatherApi],
  canvases: {
    drawer: { component: WeatherDrawer, label: 'Weather' },
    'menu-bar': {
      icon: WeatherMenuBarIcon,
      component: WeatherMenuBarContent,
      label: 'Weather',
      priority: 30,
    },
  },
});
```

---

## Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│  definePlugin()                                             │
│  ├── defineIntegration()  ← OAuth, credentials, API client  │
│  │   └── schema()         ← Extend GraphQL (Pothos)         │
│  ├── defineEntity()       ← URI pattern, display, cache      │
│  └── canvases             ← nav-sidebar, drawer, menu-bar    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Host App (Vienna)                                          │
│  ├── PluginSystem  ← registers plugins, resolves canvases    │
│  ├── EntityRegistry ← resolve/search via GraphQL             │
│  ├── GraphQL Layer ← Pothos schema + Apollo Client           │
│  └── Renderer      ← React components via canvas slots       │
└─────────────────────────────────────────────────────────────┘
```

**Plugin** — Top-level unit of extensibility. Bundles integrations, entities, and UI canvases into one deployable package.

**Integration** — External API connection. Manages auth (OAuth or credentials), creates a typed API client, and optionally extends the GraphQL schema.

**Entity** — A data type with a URI pattern, display metadata, and optional UI components. Entities are nouns — their operations (queries, mutations) live in the integration's `schema` callback.

**Canvas** — A UI slot the plugin contributes to. Three types: `nav-sidebar` (left sidebar section), `drawer` (panel with push/pop navigation), `menu-bar` (top-right icon + popover).

---

## definePlugin()

Creates a validated, immutable plugin definition. This is the entry point for every plugin.

```ts
import { definePlugin } from '@tryvienna/sdk';

export const myPlugin = definePlugin({
  id: 'my_plugin',
  name: 'My Plugin',
  icon: { svg: '<svg>...</svg>' },
  description: 'What this plugin does',

  integrations: [myIntegration],
  entities: [myEntity],

  canvases: {
    'nav-sidebar': { component: MyNavSection, label: 'My Plugin', priority: 50 },
    drawer: { component: MyDrawer, label: 'My Plugin' },
    'menu-bar': { icon: MyMenuIcon, component: MyMenuContent, label: 'My Plugin' },
  },

  allowedDomains: ['api.example.com'],
});
```

### PluginConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique ID. Lowercase alphanumeric + underscores, starts with letter, max 64 chars. |
| `name` | `string` | Yes | Human-readable display name. |
| `icon` | `PluginIcon` | Yes | Icon asset. One of `{ svg: string }`, `{ png: string }`, or `{ path: string }`. |
| `description` | `string` | No | What this plugin does. |
| `integrations` | `IntegrationDefinition[]` | No | Integrations created with `defineIntegration()`. |
| `entities` | `EntityDefinition[]` | No | Entities created with `defineEntity()`. |
| `canvases` | `PluginCanvases` | No | UI surface contributions. See [Canvas UI Surfaces](#canvas-ui-surfaces). |
| `allowedDomains` | `string[]` | No | Domains the plugin may fetch via `hostApi.fetch()`. Exact hostname matches only. |

### Validation Rules

- `id` must match `/^[a-z][a-z0-9_]*$/` and be at most 64 characters.
- `name` must be a non-empty string.
- All items in `integrations` must be created with `defineIntegration()`.
- All items in `entities` must be created with `defineEntity()`.
- No duplicate integration IDs or entity types within a plugin.
- `drawer` canvas requires either `nav-sidebar` or `menu-bar` to provide an entry point.

---

## defineIntegration()

Creates a validated integration definition that manages auth and provides an API client.

```ts
import { defineIntegration } from '@tryvienna/sdk';
import type { Octokit } from '@octokit/rest';

export const githubIntegration = defineIntegration<Octokit>({
  id: 'github',
  name: 'GitHub',
  icon: { svg: '<svg>...</svg>' },
  description: 'GitHub API for PRs, issues, and CI/CD',

  oauth: {
    providers: [{
      providerId: 'github',
      displayName: 'GitHub',
      flow: {
        grantType: 'authorization_code',
        clientId: '',
        clientIdKey: 'github_oauth_client_id',
        clientSecretKey: 'github_oauth_client_secret',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scopes: ['repo', 'read:org', 'workflow', 'read:user'],
        pkce: { enabled: true },
      },
    }],
  },

  credentials: ['personal_access_token', 'github_oauth_client_id', 'github_oauth_client_secret'],

  createClient: async (ctx) => {
    const { Octokit: OctokitClass } = await import('@octokit/rest');

    if (ctx.oauth) {
      const token = await ctx.oauth.getAccessToken('github');
      if (token) return new OctokitClass({ auth: token });
    }

    const pat = await ctx.storage.get('personal_access_token');
    if (pat) return new OctokitClass({ auth: pat });

    ctx.logger.warn('No GitHub token configured');
    return null;
  },

  schema: registerGitHubSchema,
});
```

### IntegrationConfig\<TClient\>

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique ID. Same naming rules as plugin ID. |
| `name` | `string` | Yes | Human-readable display name. |
| `icon` | `PluginIcon` | Yes | Icon asset. |
| `description` | `string` | No | What this integration connects to. |
| `oauth` | `OAuthConfig` | No | OAuth provider configuration. |
| `credentials` | `string[]` | No | Keys stored in encrypted OS-level storage. |
| `createClient` | `(ctx: AuthContext) => Promise<TClient \| null>` | Yes | Factory for the API client. Receives `ctx.storage`, `ctx.logger`, `ctx.oauth`. Return `null` if auth is not configured. |
| `schema` | `(builder: SchemaBuilder) => void` | No | Extend the GraphQL schema with integration-specific types, queries, and mutations. |

### AuthContext

The `createClient` function receives an `AuthContext`:

```ts
interface AuthContext {
  storage: SecureStorage;
  logger: PluginLogger;
  oauth?: OAuthAccessor;
}
```

**SecureStorage** — Encrypted key-value store scoped to this integration:

```ts
interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}
```

**OAuthAccessor** — Token management for OAuth providers:

```ts
interface OAuthAccessor {
  getAccessToken(providerId: string): Promise<string | null>;
  getTokenData(providerId: string): Promise<OAuthTokenData | null>;
  isAuthenticated(providerId: string): Promise<boolean>;
}
```

### OAuth Flow Types

Three grant types are supported:

**Authorization Code** (recommended):
```ts
{
  grantType: 'authorization_code',
  clientId: string,
  clientIdKey?: string,         // Secure storage key for client ID
  clientSecretKey?: string,     // Secure storage key for client secret
  authorizationUrl: string,
  tokenUrl: string,
  scopes: string[],
  pkce?: { enabled: boolean, method?: 'S256' | 'plain' },
  redirectPort?: number,
  refreshUrl?: string,
}
```

**Device Code** (for CLI-like flows):
```ts
{
  grantType: 'device_code',
  clientId: string,
  deviceAuthorizationUrl: string,
  tokenUrl: string,
  scopes: string[],
  pollingInterval?: number,
}
```

**Manual Code** (user pastes code):
```ts
{
  grantType: 'manual_code',
  clientId: string,
  authorizationUrl: string,
  tokenUrl: string,
  scopes: string[],
  instructions: string,
}
```

---

## defineEntity()

Creates a metadata-only entity definition. Entities describe what data looks like — all operations (resolve, search, mutations) live in the integration's `schema` callback.

```ts
import { defineEntity } from '@tryvienna/sdk';
import { MyEntityDrawer } from './ui/MyEntityDrawer';

export const githubIssueEntity = defineEntity({
  type: 'github_issue',
  name: 'GitHub Issue',
  description: 'An issue from GitHub',
  icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>' },
  source: 'integration',
  uri: ['owner', 'repo', 'number'],

  display: {
    emoji: '\u{1F41B}',
    colors: { bg: '#8957e5', text: '#FFFFFF', border: '#6e40c9' },
    description: 'GitHub issues for bug tracking and feature requests',
    outputFields: [
      { key: 'repo', label: 'Repository', metadataPath: 'repo' },
      { key: 'author', label: 'Author', metadataPath: 'author' },
      { key: 'state', label: 'State', metadataPath: 'state' },
      { key: 'commentCount', label: 'Comments', metadataPath: 'commentCount', format: 'number' },
    ],
  },

  cache: { ttl: 30_000, maxSize: 200 },

  ui: { drawer: MyEntityDrawer },
});
```

### EntityDefinitionConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | Entity type identifier. Same naming rules as plugin ID. |
| `name` | `string` | Yes | Human-readable display name. |
| `icon` | `PluginIcon` | Yes | Icon asset. |
| `uri` | `string[]` | Yes | URI segment names. Defines the structure of entity URIs. At least one segment required. |
| `description` | `string` | No | What this entity represents. |
| `source` | `'builtin' \| 'integration'` | No | Where this entity comes from. Defaults to `'integration'`. |
| `display` | `EntityDisplayMetadata` | No | Styling and formatting metadata. |
| `cache` | `EntityCacheConfig` | No | Cache TTL and max size. |
| `ui` | `{ drawer?, card? }` | No | Optional React components for rendering this entity. |

### EntityDefinition (returned)

The returned object is frozen and provides helper methods:

```ts
const entity = defineEntity({ type: 'project', name: 'Project', icon: { svg: '...' }, uri: ['id'] });

// Build a URI
const uri = entity.createURI({ id: 'abc123' });
// => '@drift//project/abc123'

// Parse a URI
const parsed = entity.parseURI('@drift//project/abc123');
// => { type: 'project', id: { id: 'abc123' } }
```

### EntityDisplayMetadata

```ts
interface EntityDisplayMetadata {
  emoji: string;
  colors: { bg: string; text: string; border: string };
  description?: string;
  filterDescriptions?: Array<{ name: string; type: string; description: string }>;
  outputFields?: Array<{ key: string; label: string; metadataPath: string; format?: string }>;
}
```

### EntityCacheConfig

```ts
interface EntityCacheConfig {
  ttl: number;       // Time-to-live in milliseconds (must be positive)
  maxSize?: number;  // Maximum cache entries (must be positive)
}
```

### Entity Drawer Props

If you provide a `ui.drawer` component, it receives:

```ts
interface EntityDrawerProps {
  uri: string;
  DrawerContainer: ComponentType<DrawerContainerProps>;
  headerActions?: React.ReactNode;
  onNavigate?: (entityUri: string, entityType: string, label?: string) => void;
  onClose?: () => void;
  projectId?: string;
}

interface DrawerContainerProps {
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}
```

---

## Schema Extension (SchemaBuilder)

Integrations extend the GraphQL schema via the `schema` callback. The callback receives a `SchemaBuilder` — a typed subset of the Pothos API.

The callback signature is `(rawBuilder: unknown) => void` with a cast to `SchemaBuilder`. This is intentional: it decouples plugins from the full Pothos builder type (which doesn't survive `.d.ts` boundaries), while still providing type-safe field builders within the callback.

### Basic Types and Queries

```ts
import type { SchemaBuilder } from '@tryvienna/sdk';

interface ForecastDay {
  id: string;
  date: string;
  high: number;
  low: number;
  condition: string;
}

export function registerWeatherSchema(rawBuilder: unknown): void {
  // Cast to SchemaBuilder for type-safe field builders.
  // The real Pothos builder satisfies this interface at runtime.
  const builder = rawBuilder as SchemaBuilder;

  const ForecastDayRef = builder.objectRef<ForecastDay>('WeatherForecastDay');
  builder.objectType(ForecastDayRef, {
    description: 'A daily weather forecast',
    fields: (t) => ({
      id: t.exposeID('id'),
      date: t.exposeString('date'),
      high: t.exposeInt('high'),
      low: t.exposeInt('low'),
      condition: t.exposeString('condition'),
    }),
  });

  builder.queryFields((t) => ({
    weatherForecast: t.field({
      type: [ForecastDayRef],
      description: 'Get 7-day weather forecast',
      args: {
        latitude: t.arg({ type: 'Float', required: true }),
        longitude: t.arg({ type: 'Float', required: true }),
      },
      resolve: async (_root, args) => {
        return fetchForecast(args.latitude, args.longitude);
      },
    }),
  }));
}
```

### entityObjectType()

The primary way to expose entities via GraphQL. Creates a Pothos object type, auto-generates base queries, and registers resolve/search handlers in the EntityRegistry.

```ts
import type { SchemaBuilder } from '@tryvienna/sdk';
import { githubIssueEntity } from './entities/github-issue';
import { githubIntegration } from './integration';

interface GitHubIssueData {
  number: number;
  title: string;
  state: string;
  author?: string;
  body?: string | null;
}

export function registerSchema(builder: SchemaBuilder): void {
  const GitHubIssueRef = builder.entityObjectType<GitHubIssueData>(githubIssueEntity, {
    integrations: { github: githubIntegration },
    fields: (t) => ({
      number: t.exposeInt('number'),
      title: t.exposeString('title'),
      state: t.exposeString('state'),
      author: t.exposeString('author', { nullable: true }),
      body: t.exposeString('body', { nullable: true }),
    }),
    resolve: async (id, ctx) => {
      const client = ctx.integrations.github.client;
      if (!client) return null;
      const { data } = await client.issues.get({
        owner: id.owner,
        repo: id.repo,
        issue_number: Number(id.number),
      });
      return {
        number: data.number,
        title: data.title,
        state: data.state,
        author: data.user?.login,
        body: data.body,
      };
    },
    search: async (query, ctx) => {
      const client = ctx.integrations.github.client;
      if (!client) return [];
      // Search implementation...
      return [];
    },
  });
}
```

This auto-generates:
- `githubIssue(uri: String!)` query — resolves a single issue by URI
- `githubIssues(query: String, limit: Int)` query — searches/lists issues

### entityPayload()

Creates a standard mutation payload type for entity mutations.

```ts
const MergePayload = builder.entityPayload('MergeGitHubPr', GitHubPRRef, 'githubPr');

builder.mutationFields((t) => ({
  mergeGitHubPr: t.field({
    type: MergePayload,
    args: { uri: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      // ... merge logic
      return { success: true, message: 'PR merged', entity: mergedPR };
    },
  }),
}));
```

The generated payload type has fields:
- `success: Boolean!`
- `message: String`
- `[entityFieldName]: EntityType` (e.g., `githubPr: GitHubPR`)
- `data: JSON`

### registerEntityHandlers()

Register entity handlers without creating a new Pothos type. Use this when you have an existing type but need the EntityRegistry to know how to resolve/search.

```ts
builder.registerEntityHandlers(myEntity, {
  integrations: { myApi: myIntegration },
  resolve: async (id, ctx) => { /* ... */ },
  search: async (query, ctx) => { /* ... */ },
  resolveContext: async (entity, ctx) => {
    return `# ${entity.title}\n\nMarkdown context for AI/MCP`;
  },
});
```

### SchemaBuilder API Reference

```ts
interface SchemaBuilder {
  objectRef<Shape>(name: string): ObjectRef<Shape>;
  objectType<Shape>(ref: ObjectRef<Shape>, config: {
    description?: string;
    fields: (t: ObjectFieldBuilder) => Record<string, unknown>;
  }): void;
  queryFields(fields: (t: RootFieldBuilder) => Record<string, unknown>): void;
  mutationFields(fields: (t: RootFieldBuilder) => Record<string, unknown>): void;
  inputType(name: string, config: {
    description?: string;
    fields: (t: InputFieldBuilder) => Record<string, unknown>;
  }): InputRef;
  enumType<Values extends readonly string[]>(name: string, config: {
    description?: string;
    values: Values;
  }): EnumRef<Values[number]>;

  entityObjectType<TData>(entityDef: EntityDefinition, config: EntityObjectTypeConfig<TData>): ObjectRef<TData>;
  registerEntityHandlers<TData>(entityDef: EntityDefinition, config: EntityHandlerConfig<TData>): void;
  entityPayload<TData>(name: string, entityRef: ObjectRef<TData>, entityFieldName: string): ObjectRef<EntityPayloadShape<TData>>;
}
```

> **Note on `unknown` return types:** Methods like `exposeString()` and `field()` return opaque Pothos field references. You don't interact with them directly — just return them from the `fields` callback. The `unknown` type is intentional; Pothos uses these internally for schema construction.

### ObjectFieldBuilder

Available inside `objectType` field definitions:

```ts
interface ObjectFieldBuilder {
  exposeID(key: string, config?: { nullable?: boolean; description?: string }): unknown;
  exposeString(key: string, config?: { nullable?: boolean; description?: string }): unknown;
  exposeInt(key: string, config?: { nullable?: boolean; description?: string }): unknown;
  exposeBoolean(key: string, config?: { nullable?: boolean; description?: string }): unknown;
  exposeStringList(key: string, config?: { nullable?: boolean; description?: string }): unknown;
  expose(key: string, config: { type: unknown; nullable?: boolean; description?: string }): unknown;
  field(config: FieldConfig): unknown;
  arg: ArgBuilder;
}
```

### RootFieldBuilder

Available inside `queryFields` and `mutationFields`:

```ts
interface RootFieldBuilder {
  field(config: {
    type: unknown;
    nullable?: boolean;
    description?: string;
    args?: Record<string, unknown>;
    resolve: (root: unknown, args: Record<string, unknown>, ctx: unknown) => unknown;
  }): unknown;
  arg: ArgBuilder;
}
```

### ArgBuilder

```ts
interface ArgBuilder {
  id(config?: { required?: boolean; description?: string }): unknown;
  string(config?: { required?: boolean; description?: string; defaultValue?: string }): unknown;
  int(config?: { required?: boolean; description?: string; defaultValue?: number }): unknown;
  boolean(config?: { required?: boolean; description?: string; defaultValue?: boolean }): unknown;
  (config: { type: InputRef | string; required?: boolean; description?: string }): unknown;
}
```

---

## React Hooks

Plugin UI components access data through SDK hooks. The host app wraps plugins in a `<PluginDataProvider>` that injects the Apollo client — plugins never import Apollo directly.

### PluginDataProvider

The host app must wrap all plugin UI components with this provider. Plugin authors do not render it themselves — it is documented here for completeness.

```tsx
import { PluginDataProvider } from '@tryvienna/sdk/react';

// Host app setup (not plugin code):
<PluginDataProvider
  client={apolloClient}
  hostApi={hostApi}
  activeWorkstreamId={activeWorkstreamId}
>
  <PluginNavSections />
  <PluginDrawers />
</PluginDataProvider>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `client` | `ApolloClient<any>` | Pre-configured Apollo client |
| `hostApi` | `PluginHostApi` | Credential management, OAuth, and proxied fetch (see [useHostApi](#usehostapi)) |
| `activeWorkstreamId` | `string \| null` | ID of the currently active workstream (see [useActiveWorkstreamId](#useactiveworkstreamid)) |

### useEntity

Fetch a single entity by URI:

```tsx
import { useEntity } from '@tryvienna/sdk';

function IssueDetail({ uri }: { uri: string }) {
  const { entity, loading, error, refetch } = useEntity(uri, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 30_000,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!entity) return <div>Not found</div>;

  return <div>{entity.title}</div>;
}
```

**Options:**

```ts
interface UseEntityOptions {
  fetchPolicy?: WatchQueryFetchPolicy;  // Apollo fetch policy
  pollInterval?: number;                // Auto-refetch interval in ms
  skip?: boolean;                       // Skip the query
}
```

**Returns:**

```ts
interface UseEntityResult {
  entity: BaseEntity | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}
```

### useEntities

Fetch a list of entities by type:

```tsx
import { useEntities } from '@tryvienna/sdk';

function IssueList({ owner, repo }: { owner: string; repo: string }) {
  const { entities, loading, error } = useEntities({
    type: 'github_issue',
    query: `repo:${owner}/${repo}`,
    limit: 20,
    pollInterval: 30_000,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {entities.map((issue) => (
        <li key={issue.uri}>{issue.title}</li>
      ))}
    </ul>
  );
}
```

**Options:**

```ts
interface UseEntitiesOptions {
  type: string;                          // Entity type to query
  query?: string;                        // Search/filter string
  filters?: Record<string, unknown>;     // Additional filters
  limit?: number;                        // Max results
  fetchPolicy?: WatchQueryFetchPolicy;
  pollInterval?: number;
  skip?: boolean;
}
```

### usePluginQuery

Run custom GraphQL queries defined by your integration's schema. Works with TypedDocumentNode from codegen for full type inference:

```tsx
import { usePluginQuery } from '@tryvienna/sdk';
import { GET_WEATHER_FORECAST } from '../client/generated/gql';

function Forecast({ lat, lon }: { lat: number; lon: number }) {
  const { data, loading } = usePluginQuery(GET_WEATHER_FORECAST, {
    variables: { latitude: lat, longitude: lon, units: 'fahrenheit' },
  });

  if (loading || !data) return <div>Loading...</div>;

  return (
    <ul>
      {data.weatherForecast.map((day) => (
        <li key={day.id}>{day.dayName}: {day.high}/{day.low}</li>
      ))}
    </ul>
  );
}
```

For untyped DocumentNode, pass type parameters manually:

```tsx
import { usePluginQuery, gql } from '@tryvienna/sdk';

const MY_QUERY = gql`query GetItems { items { id name } }`;

const { data } = usePluginQuery<{ items: Array<{ id: string; name: string }> }>(MY_QUERY);
```

### usePluginMutation

Run custom GraphQL mutations:

```tsx
import { usePluginMutation } from '@tryvienna/sdk';
import { MERGE_GITHUB_PR } from '../client/generated/gql';

function MergeButton({ uri }: { uri: string }) {
  const [mergePR, { loading }] = usePluginMutation(MERGE_GITHUB_PR);

  return (
    <button
      disabled={loading}
      onClick={() => mergePR({ variables: { uri } })}
    >
      {loading ? 'Merging...' : 'Merge PR'}
    </button>
  );
}
```

### useHostApi

Access host-provided APIs for credential management, OAuth, and proxied HTTP:

```tsx
import { useHostApi } from '@tryvienna/sdk';

function SettingsPanel({ integrationId }: { integrationId: string }) {
  const hostApi = useHostApi();

  const handleConnect = async () => {
    const result = await hostApi.startOAuthFlow(integrationId, 'github');
    if (!result.success) console.error(result.error);
  };

  const handleSetToken = async (token: string) => {
    await hostApi.setCredential(integrationId, 'personal_access_token', token);
  };

  return <button onClick={handleConnect}>Connect GitHub</button>;
}
```

**PluginHostApi:**

```ts
interface PluginHostApi {
  getCredentialStatus(integrationId: string): Promise<CredentialStatusEntry[]>;
  setCredential(integrationId: string, key: string, value: string): Promise<void>;
  removeCredential(integrationId: string, key: string): Promise<void>;
  startOAuthFlow(integrationId: string, providerId: string): Promise<{ success: boolean; error?: string }>;
  getOAuthStatus(integrationId: string): Promise<OAuthProviderStatusEntry[]>;
  revokeOAuthToken(integrationId: string, providerId: string): Promise<{ success: boolean }>;
  fetch(url: string, options?: PluginFetchOptions): Promise<PluginFetchResult>;
}
```

### useActiveWorkstreamId

Returns the ID of the currently active workstream, or `null` if none is selected. Plugins can use this to conditionally render UI or gate features that require an active workstream.

```tsx
import { useActiveWorkstreamId } from '@tryvienna/sdk/react';

function MyMenuBarIcon() {
  const activeWorkstreamId = useActiveWorkstreamId();

  // Hide the icon when no workstream is selected
  if (!activeWorkstreamId) return null;

  return <MyIcon />;
}
```

**Returns:** `string | null` — the active workstream ID, or `null`.

Re-renders automatically when the user navigates between workstreams.

### useWorkstream

High-level hook for interacting with a specific workstream. Currently supports sending messages; will be extended with more operations over time.

```tsx
import { useActiveWorkstreamId, useWorkstream } from '@tryvienna/sdk/react';

function SendButton() {
  const workstreamId = useActiveWorkstreamId();
  const { sendMessage } = useWorkstream(workstreamId);

  return (
    <button
      disabled={!workstreamId}
      onClick={() => sendMessage('Hello from my plugin!')}
    >
      Send Message
    </button>
  );
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `workstreamId` | `string \| null` | Workstream to interact with. Pass `null` when none is selected. |

**Returns:** `UseWorkstreamResult`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string \| null` | The workstream ID passed to the hook |
| `sendMessage` | `(text: string) => Promise<void>` | Send a text message. Auto-starts the agent if needed. Throws if `id` is null. |

### Raw GraphQL Operations

For power users who want direct control, pre-defined operations are available from `@tryvienna/sdk/graphql`:

```tsx
import { usePluginMutation } from '@tryvienna/sdk/react';
import { SEND_WORKSTREAM_MESSAGE } from '@tryvienna/sdk/graphql';
import type { SendWorkstreamMessageVariables, SendWorkstreamMessageResult } from '@tryvienna/sdk/graphql';

function MyComponent() {
  const [send, { loading }] = usePluginMutation<SendWorkstreamMessageResult, SendWorkstreamMessageVariables>(
    SEND_WORKSTREAM_MESSAGE,
  );

  const handleSend = () => send({ variables: { workstreamId: 'ws-123', text: 'Hello!' } });
}
```

### Cache Utilities

Manually manage the Apollo cache:

```tsx
import { usePluginClient, invalidateEntity, updateCachedEntity } from '@tryvienna/sdk';

function RefreshButton({ uri }: { uri: string }) {
  const client = usePluginClient();

  const handleRefresh = () => {
    invalidateEntity(client, 'Entity', undefined, { uri });
  };

  const handleOptimisticUpdate = () => {
    updateCachedEntity(client, 'GitHubPR', 'owner/repo#42', {
      state: 'merged',
    });
  };

  return <button onClick={handleRefresh}>Refresh</button>;
}
```

**`invalidateEntity(client, typename, id?, keyFields?)`** — Evicts a cached entity and refetches active queries. For Entity types (which use `uri` as key), pass `keyFields: { uri }`.

**`updateCachedEntity(client, typename, id, fields, keyFields?)`** — Updates specific fields on a cached entity without a network request.

---

## Canvas UI Surfaces

Plugins contribute UI through three canvas slots.

### nav-sidebar

A collapsible section in the left navigation sidebar:

```tsx
import type { NavSidebarCanvasProps } from '@tryvienna/sdk';

function GitHubNavSection({ openPluginDrawer, openEntityDrawer }: NavSidebarCanvasProps) {
  return (
    <div>
      <button onClick={() => openPluginDrawer({ view: 'settings' })}>
        Settings
      </button>
      <button onClick={() => openEntityDrawer('@drift//github_pr/owner/repo/42')}>
        View PR #42
      </button>
    </div>
  );
}
```

**Props:**

```ts
interface NavSidebarCanvasProps {
  pluginId: string;
  openPluginDrawer: (payload: Record<string, unknown>) => void;
  openEntityDrawer: (uri: string) => void;
  hostApi: PluginHostApi;
  logger: CanvasLogger;
}
```

**Config:**

```ts
interface NavSidebarCanvasConfig {
  component: ComponentType<NavSidebarCanvasProps>;
  label: string;          // Section header text
  icon?: string;          // Icon identifier
  priority?: number;      // Sort order (higher = first, default 50)
}
```

### drawer

A panel with push/pop navigation for multi-screen flows:

```tsx
import type { PluginDrawerCanvasProps } from '@tryvienna/sdk';

function MyPluginDrawer({ payload, drawer, openEntityDrawer }: PluginDrawerCanvasProps) {
  if (payload.view === 'settings') {
    return (
      <div>
        <h2>Settings</h2>
        <button onClick={() => drawer.push({ view: 'advanced' })}>
          Advanced Settings
        </button>
      </div>
    );
  }

  if (payload.view === 'advanced') {
    return (
      <div>
        <button onClick={() => drawer.pop()}>Back</button>
        <h2>Advanced Settings</h2>
      </div>
    );
  }

  return <div>Default View</div>;
}
```

**Props:**

```ts
interface PluginDrawerCanvasProps {
  pluginId: string;
  payload: Record<string, unknown>;    // Data from openPluginDrawer/push
  drawer: PluginDrawerActions;
  openEntityDrawer: (uri: string) => void;
  hostApi: PluginHostApi;
  logger: CanvasLogger;
}

interface PluginDrawerActions {
  close: () => void;
  open: (payload: Record<string, unknown>) => void;
  push: (payload: Record<string, unknown>) => void;  // Push a new screen
  pop: () => void;                                     // Go back
  canPop: boolean;                                     // Whether back is available
}
```

**Config:**

```ts
interface DrawerCanvasConfig {
  component: ComponentType<PluginDrawerCanvasProps>;
  label: string;
  icon?: string;
}
```

### menu-bar

An icon button in the top-right bar with a popover:

```tsx
import type { MenuBarIconProps, MenuBarCanvasProps } from '@tryvienna/sdk';

function WeatherMenuBarIcon(_props: MenuBarIconProps) {
  return <span>72F</span>;
}

function WeatherMenuBarContent({ openPluginDrawer, onClose }: MenuBarCanvasProps) {
  return (
    <div>
      <div>7-day forecast here</div>
      <button onClick={() => {
        openPluginDrawer({ view: 'settings', label: 'Weather Settings' });
        onClose();
      }}>
        Settings
      </button>
    </div>
  );
}
```

**Icon Props:**

```ts
interface MenuBarIconProps {
  pluginId: string;
  hostApi: PluginHostApi;
  logger: CanvasLogger;
}
```

**Content Props:**

```ts
interface MenuBarCanvasProps {
  pluginId: string;
  onClose: () => void;
  openPluginDrawer: (payload: Record<string, unknown>) => void;
  hostApi: PluginHostApi;
  logger: CanvasLogger;
}
```

**Config:**

```ts
interface MenuBarCanvasConfig {
  icon: ComponentType<MenuBarIconProps>;        // Renders inside 32px ghost button
  component: ComponentType<MenuBarCanvasProps>; // Popover content
  label: string;
  priority?: number;  // Sort order (higher = first, default 50)
}
```

---

## URI System

Entity URIs follow the pattern `@drift//<type>/<segment1>/<segment2>/...`

Optional display labels are appended as `?label=<base64>`.

### Building URIs

```ts
import { buildEntityURI, buildEntityURIWithLabel } from '@tryvienna/sdk';

// Simple single-segment URI
buildEntityURI('project', { id: 'abc123' }, { segments: ['id'] });
// => '@drift//project/abc123'

// Multi-segment URI
buildEntityURI('github_pr', { owner: 'acme', repo: 'app', number: '42' }, { segments: ['owner', 'repo', 'number'] });
// => '@drift//github_pr/acme/app/42'

// With display label
buildEntityURIWithLabel('project', { id: 'abc123' }, { segments: ['id'] }, 'My Project');
// => '@drift//project/abc123?label=TXkgUHJvamVjdA=='
```

### Parsing URIs

```ts
import { parseEntityURI, parseEntityURIWithLabel } from '@tryvienna/sdk';

// With known segment names
parseEntityURI('@drift//github_pr/acme/app/42', { segments: ['owner', 'repo', 'number'] });
// => { type: 'github_pr', id: { owner: 'acme', repo: 'app', number: '42' } }

// Without segment names (indexed keys)
parseEntityURI('@drift//github_pr/acme/app/42');
// => { type: 'github_pr', id: { '0': 'acme', '1': 'app', '2': '42' } }

// With label extraction
parseEntityURIWithLabel('@drift//project/abc123?label=TXkgUHJvamVjdA==', { segments: ['id'] });
// => { type: 'project', id: { id: 'abc123' }, label: 'My Project' }
```

### Utility Functions

```ts
import {
  getEntityTypeFromURI,
  isEntityURI,
  extractLabel,
  compareEntityURIs,
  DRIFT_URI_SCHEME,
} from '@tryvienna/sdk';

getEntityTypeFromURI('@drift//github_pr/acme/app/42');
// => 'github_pr'

isEntityURI('@drift//project/abc123');
// => true

isEntityURI('not-a-uri');
// => false

extractLabel('@drift//project/abc123?label=TXkgUHJvamVjdA==');
// => 'My Project'

extractLabel('@drift//project/abc123');
// => undefined

compareEntityURIs(
  '@drift//project/abc123?label=TXkgUHJvamVjdA==',
  '@drift//project/abc123'
);
// => true (ignores labels)

DRIFT_URI_SCHEME;
// => '@drift//'
```

Special characters in segment values are automatically URI-encoded/decoded.

---

## Testing

The SDK provides mocks and a test harness for unit testing plugin definitions.

### createTestHarness

```ts
import { describe, expect, it } from 'vitest';
import { defineEntity, createTestHarness } from '@tryvienna/sdk';

const myEntity = defineEntity({
  type: 'my_entity',
  name: 'My Entity',
  icon: { svg: '<svg>test</svg>' },
  uri: ['id'],
});

describe('myEntity', () => {
  it('builds and parses URIs correctly', () => {
    const harness = createTestHarness(myEntity);

    const uri = harness.createURI({ id: 'xyz' });
    expect(uri).toBe('@drift//my_entity/xyz');

    const parsed = harness.parseURI(uri);
    expect(parsed).toEqual({ type: 'my_entity', id: { id: 'xyz' } });
  });

  it('provides mock storage and logger', async () => {
    const harness = createTestHarness(myEntity);

    await harness.storage.set('key', 'value');
    expect(await harness.storage.get('key')).toBe('value');

    harness.logger.info('test message', { detail: 'context' });
    expect(harness.logger.entries).toHaveLength(1);
    expect(harness.logger.entries[0]).toMatchObject({
      level: 'info',
      msg: 'test message',
    });
  });
});
```

**EntityTestHarness:**

```ts
interface EntityTestHarness {
  storage: MockSecureStorage;
  logger: MockPluginLogger;
  ctx: EntityContext;
  definition: EntityDefinition;
  createURI(id: Record<string, string>): string;
  parseURI(uri: string): { type: string; id: Record<string, string> };
}
```

### Mock Classes

```ts
import {
  MockSecureStorage,
  MockPluginLogger,
  MockOAuthAccessor,
  MockIntegrationAccessor,
  createMockEntityContext,
} from '@tryvienna/sdk';

// In-memory encrypted storage
const storage = new MockSecureStorage();
await storage.set('token', 'abc');
await storage.get('token');    // 'abc'
await storage.has('token');    // true
await storage.delete('token');
storage.clear();
storage.size;                  // 0

// Logger that captures entries
const logger = new MockPluginLogger();
logger.info('hello', { key: 'val' });
logger.entries;  // [{ level: 'info', msg: 'hello', ctx: { key: 'val' } }]
logger.clear();

// Child logger shares entries with parent
const child = logger.child({ component: 'auth' });
child.info('auth event');
// Both logger.entries and child share the same array

// OAuth accessor
const oauth = new MockOAuthAccessor();
oauth.setToken('github', {
  accessToken: 'gho_xxx',
  refreshToken: 'ghr_xxx',
  expiresAt: Date.now() + 3600_000,
});
await oauth.getAccessToken('github');   // 'gho_xxx'
await oauth.isAuthenticated('github');  // true

// Integration accessor (provides a mock client)
const accessor = new MockIntegrationAccessor({ listRepos: async () => [] });
accessor.client;  // { listRepos: ... }

// Full entity context
const { ctx, storage: s, logger: l } = createMockEntityContext({
  github: new MockIntegrationAccessor(mockOctokit),
});
```

---

## GraphQL Codegen

Plugins that define custom GraphQL queries/mutations should use codegen to generate TypedDocumentNode types for full type inference.

### Setup

1. Create `codegen.ts` at the plugin root:

```ts
// codegen.ts
import { createPluginCodegenConfig } from '@tryvienna/sdk/codegen';

export default createPluginCodegenConfig();
```

2. Write operations in `src/client/operations.ts`:

```ts
// src/client/operations.ts
import { graphql } from './generated/gql';

export const GET_WEATHER_FORECAST = graphql(`
  query GetWeatherForecast($latitude: Float!, $longitude: Float!, $units: String!) {
    weatherForecast(latitude: $latitude, longitude: $longitude, units: $units) {
      id
      date
      dayName
      high
      low
      condition
    }
  }
`);
```

3. Run codegen:

```bash
pnpm codegen
```

Generated types go to `src/client/generated/`.

### createPluginCodegenConfig Options

```ts
interface PluginCodegenOptions {
  schemaPath?: string;     // Default: '../graphql/schema.graphql'
  documentsGlob?: string;  // Default: 'src/client/operations.ts'
  outputDir?: string;       // Default: './src/client/generated/'
}
```

---

## Error Handling

The SDK provides structured error classes with type guards.

### EntityURIError

Thrown when URI parsing or building fails:

```ts
import { EntityURIError, isEntityURIError } from '@tryvienna/sdk';

try {
  parseEntityURI('invalid-uri');
} catch (err) {
  if (isEntityURIError(err)) {
    console.log(err.code);     // 'INVALID_FORMAT' | 'MISSING_ENTITY_TYPE' | 'MISSING_PATH' | ...
    console.log(err.message);  // Human-readable description
    console.log(err.uri);      // The problematic URI (if available)
  }
}
```

**Error codes:**

| Code | Description |
|---|---|
| `INVALID_FORMAT` | URI does not start with `@drift//` |
| `MISSING_ENTITY_TYPE` | Empty type segment |
| `MISSING_PATH` | No path segments after the type |
| `INVALID_ENTITY_TYPE` | Type fails validation |
| `INVALID_PATH_SEGMENT` | Missing or empty segment value |
| `INVALID_LABEL_ENCODING` | Malformed base64 label |
| `SEGMENT_COUNT_MISMATCH` | URI segment count does not match expected count |

### EntityDefinitionError

Thrown by `defineEntity()`, `defineIntegration()`, and `definePlugin()` for invalid configuration:

```ts
import { EntityDefinitionError, isEntityDefinitionError } from '@tryvienna/sdk';

try {
  defineEntity({ type: 'INVALID', name: '', icon: { svg: '' }, uri: [] });
} catch (err) {
  if (isEntityDefinitionError(err)) {
    console.log(err.entityType);  // 'INVALID'
    console.log(err.field);       // 'type', 'name', 'uri', etc.
    console.log(err.message);     // Human-readable description
  }
}
```

---

## License

Apache 2.0
