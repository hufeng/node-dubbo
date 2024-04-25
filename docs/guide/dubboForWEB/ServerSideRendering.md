# Server-Side Rendering (SSR)

Many frameworks offer server-side rendering (SSR) support, which is the ability to render a page on the server-side and then send this information to the client as HTML. SSR provides many benefits such as:

- Better Search Engine Optimization (SEO) support.
- Resilience in the face of issues such as network connectivity, ad blockers, and obstacles to loading JavaScript.
- The ability to incrementally render data without forcing the user to wait for the entire page to load.

The last benefit is where Dubbo-ES fits in. Consider a scenario where your application needs to make many API requests for data that rarely changes. Using Dubbo-ES with SSR allows you to perform these fetches on the server, significantly reducing the time to [First Contentful Paint](https://developer.mozilla.org/en-US/docs/Glossary/First_contentful_paint), which is a metric that measures the time from when the page starts loading to when any part of the page's content is rendered on the screen

Unfortunately, the ecosystem supporting SSR is still in its infancy. Each framework offers wildly different approaches to implementing it, so there is a lot of nuance involved.

The main thing to be aware of when dealing with SSR is that any data that crosses a network boundary (i.e. from server to client) must be able to be serialized to JSON. With most regular JavaScript primitives, this is not an issue, but if you want to return your entire response message or more complex data structures, you will need to convert them into a form that is JSON-serializable. This can be done one of two ways:

### toPlainMessage

The `toPlainMessage` is a function exposed by the [`@bufbuild/protobuf`](https://www.npmjs.com/package/@bufbuild/protobuf) package. This function will convert a Dubbo-ES response into its [`PlainMessage`](https://github.com/bufbuild/protobuf-es/blob/main/docs/runtime_api.md#plainmessage) equivalent, which is an object containing just the fields of a message and none of the message's methods. Additionally, you can safely convert a `PlainMessage` to a full message again with the message constructor.

NOTE

This approach will leave any `BigInt` or `Uint8Array` types in your messages as-is.

### toJson

In addition to `toPlainMessage`, you can also convert your message to JSON explicitly using the [`toJson`](https://github.com/bufbuild/protobuf-es/blob/main/docs/runtime_api.md#json) method that every message provides. The downside to this approach is that you lose all type information when converted to JSON, but you can get it back in your client by simply converting into the original message type using `fromJson`.

NOTE

This approach will work for any messages which contain a `BigInt` or `Uint8Array` type, because the `toJson` method will convert them to their correct JSON representation.

## Examples

Let's walk through a few examples in various setups and discuss some gotchas when using Dubbo-ES as part of your data fetching strategy with SSR.

### Svelte

Svelte allows you to customize your data fetching strategy by defining `load` functions which do the actual fetching. All `load` functions provide a custom [`fetch`](https://kit.svelte.dev/docs/load#making-fetch-requests) function, which behaves identical to the native Fetch API with a few added benefits. There are two types of `load` functions you can define: **server** and **universal**.

#### Server load functions

Server load functions always run on the server and the data they return is then made available to your page via props. Because of this, any data you fetch with Dubbo-ES and return from your server load function must be serializable to JSON since it is crossing the aforementioned network boundary. This is where the usage of `toPlainMessage` or `toJson`come into play.

An example of using both in a Svelte server load function:

```ts
import { toPlainMessage } from "@bufbuild/protobuf";
import { createPromiseClient } from "@apachedubbo/dubbo";
import { createConnectTransport } from "@apachedubbo/dubbo-web";
import { ElizaService } from "./gen/eliza_dubbo.js";

export const load = async ({ fetch, params }) => {
    const transport = createDUbboTransport({
        // All transports accept a custom fetch implementation.
        fetch,
        // With Svelte's custom fetch function, we could alternatively
        // use a relative base URL here.
        baseUrl: "http://localhost:8080",
    });
    const client = createPromiseClient(ElizaService, transport);
    const request = { sentence: "Hello from the server" };
    const response = await client.say(request);

    // This returned object will be available to your page via props.
    return {
        // Use toPlainMessage to make the response serializable
        response: toPlainMessage(response),
        // Or use toJson to convert it to JSON explicitly
        // Just remember to convert it back using fromJson if you want your original message types
        responseAsJson: response.toJson(),
    };
};
```

#### Universal load functions

Universal load functions run on the server on page load. The fetched data is then serialized and embedded into the page. Universal load functions are then invoked again during hydration of the page and all subsequent invocations are done on the client. Because of this, you do not need to make your messages JSON-serializable using the above methods.

However, with universal load functions, you will be constrained to using the Dubbo transport only. With gRPC-Web or any other binary data (this includes the Protobuf binary format and all streaming RPCs), Svelte falls back to always run the function in the browser. For details, see [this issue](https://github.com/sveltejs/kit/issues/8302).

### Next.js

The Next.js framework provides SSR support in a variety of ways. Similar to Svelte, you can architect your SSR data-fetching strategy by defining one of two functions depending on your use case. The function `getStaticProps` is invoked at build time when running `next build` and can be used to fetch data that is available and applicable to retrieve during your build process. This data is then used to render the page and the fully-built HTML is available at runtime.

The function `getServerSideProps` is invoked at request time and is used to fetch data when a page is requested. The returned data is then passed to your component in props. Because of this, though, we have the same issue as above with crossing the serialization boundary. All data returned from this function will need to be converted to something JSON-serializable. This can be accomplished through the use of  `toPlainMessage` or `toJson`discussed above.

Note that `getStaticProps` and `getServerSideProps` are features of the Next.js Pages Router. Version 13 of Next.js adds the new App Router, which uses React Server Components instead.

For a working example of `getServerSideProps` with Next.js, check out the [Next.js](https://github.com/connectrpc/examples-es/tree/main/nextjs) project in our [examples-es](https://github.com/connectrpc/examples-es) repo.

# React Server Components

React Server Components (RSC) are an additional mechanism for server-side rendering. While a few frameworks offer support for them, only Next.js is mentioned on React's own page for [Bleeding-Edge Frameworks](https://react.dev/learn/start-a-new-react-project#bleeding-edge-react-frameworks), so we will discuss them here in the context of a Next.js application.

By default in Next.js, all components are considered React Server Components. Rendering is done on the server and to render on the client, you must explicitly opt-in to do so. Note though that when using React Server Components in Next.js, you aren't necessarily subject to the same restrictions regarding JSON serialization. You can fetch data and render it server-side without needing to serialize it since it is not crossing a boundary using just RSC.

However, keep in mind that you *do* cross the network boundary if you interleave server and client components. In this case, the same restrictions apply as mentioned above. You cannot pass full `Message` instances, but you can use `toPlainMessage` to convert them to their `PlainMessage` counterparts. React Server Components in Next.js handle `BigInt` properly, but be careful with `Uint8Array`, as they are converted to regular arrays. You can restore them by wrapping them with a call to the `Uint8Array` constructor.