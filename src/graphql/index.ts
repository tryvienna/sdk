/**
 * @tryvienna/sdk/graphql
 *
 * Pre-defined GraphQL operations for common Vienna platform features.
 * Use with usePluginQuery / usePluginMutation from @tryvienna/sdk/react.
 *
 * For convenience hooks that wrap these operations, see @tryvienna/sdk/react
 * (e.g., useWorkstream).
 */

export {
  SEND_WORKSTREAM_MESSAGE,
  type SendWorkstreamMessageVariables,
  type SendWorkstreamMessageResult,
} from './operations';
