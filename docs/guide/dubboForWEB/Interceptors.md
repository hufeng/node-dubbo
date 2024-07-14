# Interceptors

An interceptor can add logic to clients, similar to the decorators or middleware you may have seen in other libraries. Interceptors may mutate the request and response, catch errors and retry/recover, emit logs, or do nearly anything else.

For a simple example, this interceptor logs all requests:

```ts
import { Interceptor } from "@apachedubbo/dubbo";
import { createDubboTransport } from "@apachedubbo/dubbo-web"

const logger: Interceptor = (next) => async (req) => {
  console.log(`sending message to ${req.url}`);
  return await next(req);
};

createDubboTransport({
  baseUrl: "http://localhost:8080",
  interceptors: [logger],
});
```
You can think of interceptors like a layered onion. A request initiated by a client goes through the outermost layer first. Each call to `next()` traverses to the next layer. In the center, the actual HTTP request is run by the transport. The response then comes back through all layers and is returned to the client. In the array of interceptors passed to the transport, the interceptor at the end of the array is applied first.

To intercept responses, we simply look at the return value of `next()`:

```ts
const logger: Interceptor = (next) => async (req) => {
  console.log(`sending message to ${req.url}`);
  const res = await next(req);
  if (!res.stream) {
    console.log("message:", res.message);
  }
  return res;
};
```

The `stream` property of the response tells us whether this is a streaming response. A streaming response has not fully arrived yet when we intercept it — we have to wrap it to see individual messages:

```ts
const logger: Interceptor = (next) => async (req) => {
  const res = await next(req);
  if (res.stream) {
    // to intercept streaming response messages, we wrap
    // the AsynchronousIterable with a generator function
    return {
      ...res,
      message: logEach(res.message),
    };
  }
  return res;
};

async function* logEach(stream: AsyncIterable<any>) {
  for await (const m of stream) {
    console.log("message received", m);
    yield m;
  }
}
```

# Context values

Context values are a type safe way to pass arbitary values from the call site or from one interceptor to the next. You can use `createContextValues` function to create a new `ContextValues`. The `contextValues` call option can be used to provide a `ContextValues` instance for each request.

`ContextValues` has methods to set, get, and delete values. The keys are `ContextKey` objects:

## Context Keys

`ContextKey` is a type safe and collision free way to use context values. It is defined using `createContextKey` function which takes a default value and returns a `ContextKey` object. The default value is used when the context value is not set.

```ts
import { createContextKey } from "@apachedubbo/dubbo";

type User = { name: string };

const kUser = createContextKey<User>(
  { name: "Anonymous" }, // Default value
  {
    description: "Current user", // Description useful for debugging
  },
);

export { kUser };
```

For values where a default doesn't make sense you can just modify the type:

```ts
import { createContextKey } from "@apachedubbo/dubbo";

type User = { name: string };

const kUser = createContextKey<User | undefined>(undefined, {
  description: "Authenticated user",
});

export { kUser };
```

It is best to define context keys in a separate file and export them. This is better for code splitting and also avoids circular imports. This also helps in the case where the provider changes based on the environment.

## Example

Let's say you want to log the response body. But you don't want to do it for every request. You only want to do it from a specific component. You can use context values to achieve this.

First create a context key:

```ts
import { createContextKey } from "@apachedubbo/dubbo";

const kLogBody = createContextKey<boolean>(false, {
  description: "Log request/response body",
});

export { kLogBody };
```

Then in your interceptor, check the context value:

```ts
import type { Interceptor } from "@apachedubbo/dubbo";
import { kLogBody } from "./log-body-context.js";

const logger: Interceptor = (next) => async (req) => {
  console.log(`sending message to ${req.url}`);
  const res = await next(req);
  if (!res.stream && req.contextValues.get(kLogBody)) {
    console.log("message:", res.message);
  }
  return res;
};
```

Then in your component, set the context value:

```ts
import { kLogBody } from "./log-body-context.js";
import { elizaClient } from "./eliza-client.js";

const res = elizaClient.say({ sentence: "Hey!" }, { contextValues: createContextValues().set(kLogBody, true) });
```

# Setting `fetch()` options

Another valuable use case for interceptors is customizing the Fetch API for individual requests by leveraging the `request.init` object.

For example, by default, Dubbo sets the Fetch option [redirect](https://developer.mozilla.org/en-US/docs/Web/API/fetch#redirect) to `error`, which means that a network error will be returned when a request is met with a redirect. However, if you wish to change this value to `follow` for example, you can do so using an interceptor.

```ts
const followRedirects: Interceptor = (next) => async (request) => {
  return await next({
    ...request,
    init: {
      ...request.init,
      // Follow all redirects
      redirect: "follow",
    },
  });
};

const client = createPromiseClient(ElizaService, createConnectTransport({
  baseUrl: "http://localhost:8080",
  interceptors: [logger],
}));
```