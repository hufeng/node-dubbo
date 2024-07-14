# Using clients

Dubbo ships with two client shapes for TypeScript, one with classic callbacks, one that is promise based. You create a client for a service using one of the provided constructor functions, and you do not need to generate additional code.

## Promises

We have already been using the function `createPromiseClient` in the tutorial. The function gives us a client that uses ECMAScript promise objects. In combination with the `await` keyword, this lets you write asynchronous code in a natural and easily readable way:

```ts
import { createPromiseClient } from "@apachedubbo/dubbo";
import { ElizaService } from "../gen/buf/connect/demo/eliza/v1/eliza_dubbo.js";

const client = createPromiseClient(ElizaService, transport);

const res = await client.say({
  sentence: "I feel happy.",
});
console.log(res.sentence);
```

For server-streaming RPCs, the corresponding method on the client will return an async iterable stream of response messages that can be used with the `for await...of` statement:

```ts
for await (const res of client.introduce({ name: "Joseph" })) {
  console.log(res);
}
```

## Callbacks

If you prefer a callback-based approach, the client returned by the function `createCallbackClient` should suit you:

```ts
import { createCallbackClient } from "@apachedubbo/dubbo";
import { ElizaService } from "../gen/buf/connect/demo/eliza/v1/eliza_dubbo.js";

const client = createCallbackClient(ElizaService, transport);

client.say({ sentence: "I feel happy." }, (err, res) => {
  if (!err) {
    console.log(res.sentence);
  }
});
```

For server-streaming RPCs, the corresponding method on the client takes two callback functions: one that is called every time a response message arrives, and one that is called at the end of the stream.

```ts
import {DubboError} from "@apachedubbo/dubbo";

client.introduce({name: "Joseph"}, (res) => {
  console.log(res);
}, (err?: DubboError) => {
  if (err) {
    console.error(err);
  }
});
```

The callback client is particularly useful if you want to migrate an existing code base from gRPC-web to Connect clients.

## Managing clients and transports

In practice, you will likely want to avoid creating a new transport every time you want to use a client. It really depends on the framework of your choice, but there usually is a simple solution to avoid repetition.

For example, you can easily create a custom hook in React:

```ts
// use-client.ts
import { useMemo } from "react";
import { ServiceType } from "@bufbuild/protobuf";
import { createDubboTransport } from "@apachedubbo/dubbo-web";
import { createPromiseClient, PromiseClient } from "@apachedubbo/dubbo";

// This transport is going to be used throughout the app
const transport = createDubboTransport({
  baseUrl: "http://localhost:8080",
});

/**
* Get a promise client for the given service.
*/
export function useClient<T extends ServiceType>(service: T): PromiseClient<T> {
  // We memoize the client, so that we only create one instance per service.
  return useMemo(() => createPromiseClient(service, transport), [service]);
}
```

Usage:

```ts
await useClient(ElizaService).say({sentence: "I feel happy."});
```

## Roll your own client

If you find that neither client suits your needs perfectly, it might be an option for you to roll your own. For example, you might prefer [Rust-style result types](https://doc.rust-lang.org/rust-by-example/error/result.html) over promise rejections, and could write your own constructor function that uses the [neverthrow library](https://github.com/supermacro/neverthrow) for method return values.

Implementing a client constructor takes about 100 lines of code. By convention, every client constructor function must accept call options, and should be named `provideXClient`.



