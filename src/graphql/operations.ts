/**
 * Pre-defined GraphQL operations for common Vienna platform features.
 *
 * These are typed DocumentNodes that plugins can use directly with
 * usePluginQuery / usePluginMutation from @tryvienna/sdk/react.
 *
 * @example
 * ```tsx
 * import { usePluginMutation } from '@tryvienna/sdk/react';
 * import { SEND_WORKSTREAM_MESSAGE } from '@tryvienna/sdk/graphql';
 *
 * const [send] = usePluginMutation(SEND_WORKSTREAM_MESSAGE);
 * await send({ variables: { workstreamId: '123', text: 'Hello!' } });
 * ```
 */

import gql from 'graphql-tag';

// ── Workstream Operations ────────────────────────────────────────────────────

/**
 * Send a text message to a workstream agent. Auto-starts the agent if needed.
 *
 * Variables: `{ workstreamId: ID!, text: String! }`
 *
 * Returns the updated workstream with id, status, messageCount, lastActivityAt, updatedAt.
 */
export const SEND_WORKSTREAM_MESSAGE = gql`
  mutation SendWorkstreamMessage($workstreamId: ID!, $text: String!) {
    sendWorkstreamMessage(workstreamId: $workstreamId, text: $text) {
      workstream {
        id
        status
        messageCount
        lastActivityAt
        updatedAt
      }
    }
  }
`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface SendWorkstreamMessageVariables {
  workstreamId: string;
  text: string;
}

export interface SendWorkstreamMessageResult {
  sendWorkstreamMessage: {
    workstream: {
      id: string;
      status: string;
      messageCount: number;
      lastActivityAt: string;
      updatedAt: string;
    };
  };
}
