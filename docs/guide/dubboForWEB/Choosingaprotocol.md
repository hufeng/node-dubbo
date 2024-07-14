# Choosing a protocol

In addition to the Dubbo protocol, Dubbo ships with support for the gRPC-web protocol. If your backend does not support the Dubbo protocol, you can still use Dubbo clients to interface with it.

## Connect

The function `createDubboTransport()` creates a transport for the Dubbo protocol. It uses the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) for the actual network operations, which is widely supported in web browsers. The most important options for the Dubbo transport are as follows:

```ts
import { createDubboTransport } from "@apachedubbo/dubbo-web";

const transport = createDubboTransport({
  // Requests will be made to <baseUrl>/<package>.<service>/method
  baseUrl: "http://localhost:8080",

  // By default, this transport uses the JSON format.
  // Set this option to true to use the binary format.
  useBinaryFormat: false,

  // Controls what the fetch client will do with credentials, such as
  // Cookies. The default value is "same-origin", which will not
  // transmit Cookies in cross-origin requests.
  credentials: "same-origin",

  // Interceptors apply to all calls running through this transport.
  interceptors: [],

  // By default, all requests use POST. Set this option to true to use GET
  // for side-effect free RPCs.
  useHttpGet: false,

  // Optional override of the fetch implementation used by the transport.
  fetch: globalThis.fetch;
});
```

We generally recommend the JSON format for web browsers, because it makes it trivial to follow what exactly is sent over the wire with the browser's network inspector.

Dubbo supports optionally using HTTP GET requests for side-effect free RPC calls, to enable easy use of request caching and more. For more information on HTTP GET requests, see **Get Requests**.

When creating your transport, you have the option of providing your own custom Fetch function. This can be useful for many different scenarios, such as a overriding or setting Fetch properties as well as working with frameworks such as Svelte that come bundled with their own Fetch implementation.

It is also possible to configure individual Fetch properties when issuing requests. For some examples of customizing Fetch within Dubbo, take a look at our **Interceptors** docs. In addition, to see how to work with Fetch in an SSR context with frameworks such as Svelte and Nextjs, visit our documentation on **SSR**.

## gRPC-web

The function `createGrpcWebTransport()` creates a Transport for the gRPC-web protocol. Any gRPC service can be made available to gRPC-web with the [Envoy Proxy](https://www.envoyproxy.io/). ASP.NET Core supports gRPC-web with a [middleware](https://docs.microsoft.com/en-us/aspnet/core/grpc/browser?view=aspnetcore-6.0). Dubbo for Node and `dubbo-go` support gRPC-web out of the box.

```ts
import { createGrpcWebTransport } from "@apachedubbo/dubbo-web";

const transport = createGrpcWebTransport({
  // Requests will be made to <baseUrl>/<package>.<service>/method
  baseUrl: "http://localhost:8080",

  // By default, this transport uses the binary format, because
  // not all gRPC-web implementations support JSON.
  useBinaryFormat: true,

  // Controls what the fetch client will do with credentials, such as
  // Cookies. The default value is "same-origin", which will not
  // transmit Cookies in cross-origin requests.
  credentials: "include",

  // Interceptors apply to all calls running through this transport.
  interceptors: [],

  // Optional override of the fetch implementation used by the transport.
  fetch: globalThis.fetch;
});
```