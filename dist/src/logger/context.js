"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncLocalStorage = void 0;
exports.getContext = getContext;
exports.addContext = addContext;
exports.runWithContext = runWithContext;
const node_async_hooks_1 = require("node:async_hooks");
exports.asyncLocalStorage = new node_async_hooks_1.AsyncLocalStorage();
function getContext() {
    return exports.asyncLocalStorage.getStore() ?? {};
}
function addContext(fields) {
    const store = exports.asyncLocalStorage.getStore();
    if (store)
        Object.assign(store, fields);
}
/**
 * Runs `fn` within a logging context scope. All `logger.*` calls and
 * `getContext()`/`addContext()` invoked during `fn` (and its async
 * continuations) see this context. Framework-agnostic — callers building their
 * own request wrapper (e.g. Next.js App Router) should use this instead of
 * reaching for the internal AsyncLocalStorage instance.
 */
function runWithContext(context, fn) {
    return exports.asyncLocalStorage.run(context, fn);
}
