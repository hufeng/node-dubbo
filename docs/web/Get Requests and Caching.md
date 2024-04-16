# Get Requests and Caching

Dubbo supports performing idempotent, side-effect free requests using an HTTP GET-based protocol. This makes it easier to cache certain kinds of requests in the browser, on your CDN, or in proxies and other middleboxes.

First, configure your server to handle HTTP GET requests using Dubbo. 

Afterwards, ensure that a new enough version of `@apachedubbo/dubbo-web` is set up; HTTP GET support is available inDubbo Web v3.3.0 or newer. Then, you can specify the `useHttpGet` option when creating the Dubbo transport:

```tsx
const transport = createDubboTransport({
  baseUrl: "http://localhost:8080",
  httpVersion: "1.1",
});
const client = createPromiseClient(ExampleService, transport, { serviceVersion: '1.0.0', serviceGroup: 'dubbo' });
const res = client.say({ sentence: "Hello World" });
console.log(res);
```

Methods annotated as side-effect free will use GET requests. All other requests will continue to use POST.