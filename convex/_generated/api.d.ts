/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as arena from "../arena.js";
import type * as debug from "../debug.js";
import type * as guild from "../guild.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as streams from "../streams.js";
import type * as tinder from "../tinder.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  arena: typeof arena;
  debug: typeof debug;
  guild: typeof guild;
  http: typeof http;
  messages: typeof messages;
  streams: typeof streams;
  tinder: typeof tinder;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
