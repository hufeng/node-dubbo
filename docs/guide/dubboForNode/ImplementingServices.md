# ImplementingServices

Dubbo handles HTTP routes and most plumbing for you, but implementing the actual business logic is still up to you.

You always register your implementation on the `DubboRouter`. We recommend to create a file `dubbo.ts` with a registration
function in your project:

```ts
import type { DubboRouter } from "@apachedubbo/dubbo";

export default (router: DubboRouter) => {
}
```

# Register a service

Let's say you have defined a simple service in Protobuf:

```
message SayRequest {
  string sentence = 1;
}
message SayResponse {
  string sentence = 1;
}
service ElizaService {
  rpc Say(SayRequest) returns (SayResponse) {}
}
```

To register this service, call `router.service()`:

```ts
import { DubboRouter, HandlerContext } from "@apachedubbo/dubbo";
import { ElizaService } from "./gen/eliza_dubbo";
import { SayRequest, SayResponse } from "./gen/eliza_pb";

export default (router: DubboRouter) =>
  router.service(ElizaService, {
    async say(req: SayRequest, context: HandlerContext) {
      return new SayResponse({
        sentence: `You said ${req.sentence}`,
      });
    }
  });
```

Your method `say()` receives the request message and a context object, and returns a response message. It is a plain
function!

# Plain functions

Your function can return a response message, or a promise for a response message, or just an initializer for a response
message:

```ts
function say(req: SayRequest) {
  return new SayResponse({ sentence: `You said ${req.sentence}` });
}
```

```ts
async function say(req: SayRequest) {
  return { sentence: `You said ${req.sentence}` };
}
```

```ts
const say = (req: SayRequest) => ({ sentence: `You said ${req.sentence}` });
```

You can register any of these functions for the ElizaService.

# Context

The context argument gives you access to headers and service metadata:

```ts
import { HandlerContext } from "@apachedubbo/dubbo";
import { SayRequest } from "./gen/eliza_pb";

function say(req: SayRequest, context: HandlerContext) {
  ctx.service.typeName; // the protobuf type name "ElizaService"
  ctx.method.name; // the protobuf rpc name "Say"
  context.requestHeader.get("Foo");
  context.responseHeader.set("Foo", "Bar");
  return new SayResponse({ sentence: `You said ${req.sentence}` });
}
```

It can also be used to access arbitrary values that are passed from either server plugins or interceptors. Please refer
to the docs on [interceptors](Interceptors.md) for learn more.

# Errors

Instead of returning a response, your method can also raise an error:

```ts
import { Code, DubboError } from "@apachedubbo/dubbo";

function say() {
  throw new DubboError("I have no words anymore.", Code.ResourceExhausted);
}
```

`Code` is one of Connects [error codes](). Besides the code and a message, errors can also contain metadata (a Headers
object) and error details.

# Error details

Error details are a powerful feature. Any protobuf message can be transmitted as an error detail. Let's
use `google.rpc.LocalizedMessage` to localize our error message:

```shell
buf generate buf.build/googleapis/googleapis
```

```ts
import { Code, DubboError } from "@apachedubbo/dubbo";
import { ElizaService } from "./gen/eliza_dubbo";
import { LocalizedMessage } from "./gen/google/rpc/error_details_pb";

function say() {
  const details = [
    new LocalizedMessage({
      locale: "fr-CH",
      message: "Je n'ai plus de mots.",
    }),
    new LocalizedMessage({
      locale: "ja-JP",
      message: "もう言葉がありません。",
    }),
  ];
  const metadata = new Headers({
    "words-left": "none"
  });
  throw new DubboError(
    "I have no words anymore.",
    Code.ResourceExhausted,
    metadata,
    details
  );
}
```

# Streaming

Before showing the various handlers for streaming endpoints, we'd like to reference the [Streaming]() page from Dubbo-Go
as a caveat. Because while Dubbo for Node.js does support all three variations of streaming endpoints, there are
tradeoffs that should be considered before diving in.

Streaming can be a very powerful approach to APIs in the right circumstances, but it also requires great care. Remember,
with great power comes great responsibility.

In **client streaming**, the client sends multiple messages. Once the server receives all the messages, it responds with
a single message. In Protobuf schemas, client streaming methods look like this:

```
service ElizaService {
  rpc Vent(stream VentRequest) returns (VentResponse) {}
}
```

In TypeScript, client streaming methods receive an asynchronous iterable of request messages (you can iterate over them
with a for [await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of)
loop):

```ts
async function vent(reqs: AsyncIterable<VentRequest>): Promise<VentResponse> {
}
```

In **server streaming**, the client sends a single message, and the server responds with multiple messages. In Protobuf
schemas, server streaming methods look like this:

```
service ElizaService {
  rpc Introduce(IntroduceRequest) returns (stream IntroduceResponse) {}
}
```

In TypeScript, server streaming methods receive a request message, and return an asynchronous iterable of response
messages, typically with
a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*).

```ts
async function* introduce(req: IntroduceRequest) {
  yield { sentence: `Hi ${req.name}, I'm eliza` };
  yield { sentence: `How are you feeling today?` };
}
```

In **bidirectional streaming** (often called bidi), the client and server may both send multiple messages. Often, the
exchange is structured like a conversation: the client sends a message, the server responds, the client sends another
message, and so on. Keep in mind that this always requires end-to-end HTTP/2 support (regardless of RPC protocol)!

# Helper Types

Service implementations are type-safe. The `service()` method of the `DubboRouter` accepts a `ServiceImpl<T>`, where `T`
is a service type. A `ServiceImpl` has a method for each RPC, typed as `MethodImp<M>`, where `M` is a method info
object.

You can use these types to compose your service without registering it right away:

```ts
import type { MethodImpl, ServiceImpl } from "@apachedubbo/dubbo";

export const say: MethodImpl<typeof ElizaService.methods.say> =
...

export const eliza: ServiceImpl<typeof ElizaService> = {
  // ...
};

export class Eliza implements ServiceImpl<typeof ElizaService> {
  async say(req: SayRequest) {
    return {
      sentence: `You said ${req.sentence}`,
    };
  }
}
```

Registering the examples above:

```ts
import type { DubboRouter } from "@apachedubbo/dubbo";
import { ElizaService } from "./gen/eliza_dubbo";
import { say, eliza, Eliza } from "./other-file";

export default (router: DubboRouter) => {
  // using const say
  router.service(ElizaService, { say });

  // alternative for using const say
  router.rpc(
    ElizaService,
    ElizaService.methods.say,
    say
  );

  // using const eliza
  router.service(ElizaService, eliza);

  // using class Eliza
  router.service(ElizaService, new Eliza());
}
```
