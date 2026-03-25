/**
 * Canvas Types — UI surface definitions for plugins.
 *
 * Plugins contribute UI to three canvas slots:
 * - nav-sidebar: Collapsible section in the left sidebar
 * - drawer: Plugin-level drawer panel (settings, detail views)
 * - menu-bar: Top-right icon button + popover
 */
import type { ComponentType } from 'react';
import type { PluginLogger } from './types';
export type CanvasType = 'nav-sidebar' | 'drawer' | 'menu-bar';
export declare const CANVAS_TYPES: readonly ["nav-sidebar", "drawer", "menu-bar"];
export type CanvasLogger = Omit<PluginLogger, 'child'>;
export interface CredentialStatusEntry {
    key: string;
    isSet: boolean;
}
export interface OAuthProviderStatusEntry {
    providerId: string;
    displayName?: string;
    connected: boolean;
    expiresAt?: number;
    scopes?: string[];
    flowStatus?: string;
    required?: boolean;
}
export interface PluginFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}
export interface PluginFetchResult {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}
export interface PluginHostApi {
    /** Check which credentials are configured for an integration. */
    getCredentialStatus(integrationId: string): Promise<CredentialStatusEntry[]>;
    /** Set a credential for an integration (stored in OS-level encrypted storage). */
    setCredential(integrationId: string, key: string, value: string): Promise<void>;
    /** Remove a credential for an integration. */
    removeCredential(integrationId: string, key: string): Promise<void>;
    /** Start an OAuth authorization flow (opens browser for user to authorize). */
    startOAuthFlow(integrationId: string, providerId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /** Get OAuth provider status for an integration. */
    getOAuthStatus(integrationId: string): Promise<OAuthProviderStatusEntry[]>;
    /** Revoke an OAuth token for a provider. */
    revokeOAuthToken(integrationId: string, providerId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Fetch an external URL via the main process (bypasses renderer CSP).
     * Only domains declared in the plugin's `allowedDomains` are permitted.
     */
    fetch(url: string, options?: PluginFetchOptions): Promise<PluginFetchResult>;
}
export interface NavSidebarCanvasProps<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    pluginId: string;
    openPluginDrawer: (payload: TPayload) => void;
    openEntityDrawer: (uri: string) => void;
    hostApi: PluginHostApi;
    logger: CanvasLogger;
}
export interface NavSidebarCanvasConfig {
    component: ComponentType<NavSidebarCanvasProps>;
    label: string;
    icon?: string;
    priority?: number;
}
export interface PluginDrawerActions<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    close: () => void;
    open: (payload: TPayload) => void;
    push: (payload: TPayload) => void;
    pop: () => void;
    canPop: boolean;
}
export interface PluginDrawerCanvasProps<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    pluginId: string;
    payload: TPayload;
    drawer: PluginDrawerActions;
    openEntityDrawer: (uri: string) => void;
    hostApi: PluginHostApi;
    logger: CanvasLogger;
}
export interface DrawerCanvasConfig<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    component: ComponentType<PluginDrawerCanvasProps<TPayload>>;
    /** Optional footer component rendered pinned at the bottom of the drawer (outside scroll). */
    footer?: ComponentType<PluginDrawerCanvasProps<TPayload>>;
    label: string;
    icon?: string;
}
export interface MenuBarIconProps {
    pluginId: string;
    hostApi: PluginHostApi;
    logger: CanvasLogger;
}
export interface MenuBarCanvasProps<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    pluginId: string;
    onClose: () => void;
    openPluginDrawer: (payload: TPayload) => void;
    hostApi: PluginHostApi;
    logger: CanvasLogger;
}
export interface MenuBarCanvasConfig {
    icon: ComponentType<MenuBarIconProps>;
    component: ComponentType<MenuBarCanvasProps>;
    label: string;
    priority?: number;
}
export interface PluginCanvases {
    'nav-sidebar'?: NavSidebarCanvasConfig;
    drawer?: DrawerCanvasConfig;
    'menu-bar'?: MenuBarCanvasConfig;
}
//# sourceMappingURL=canvas.d.ts.map