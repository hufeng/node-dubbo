# Getting started

Dubbo-Node is a library for serving Dubbo, gRPC, and gRPC-Web compatible HTTP APIs using Node.js. It brings the Dubbo Protocol to Node with full TypeScript compatibility and support for all four types of remote procedure calls: unary and the three variations of streaming.

This ten-minute walkthrough helps you create a small Dubbo service in Node.js. It demonstrates what you'll be writing by hand, what Connect generates for you, and how to call your new API.


# Prerequisites
We'll set up a project from scratch and then augment it to serve a new endpoint.

- You'll need [Node.js](https://nodejs.org/en/download) installed - we recommend the most recent long-term support version (LTS).
- We'll use the package manager `npm`, but we are also compatible with `yarn` and `pnpm`.
- We'll also use [cURL](https://curl.se/). It's available from Homebrew and most Linux package managers.


# Project setup

Let's initialize a project with TypeScript, and install some code generation tools:

```shell
mkdir dubbo-example
cd dubbo-example
npm init -y
npm install typescript tsx
npx tsc --init
npm install @bufbuild/protoc-gen-es @bufbuild/protobuf @apachedubbo/protoc-gen-apache-dubbo-es @apachedubbo/dubbo
```

# Define a service
First, we need to add a Protobuf file that includes our service definition. For this tutorial, we are going to construct a unary endpoint for a service that is a stripped-down implementation of [ELIZA](https://en.wikipedia.org/wiki/ELIZA), the famous natural language processing program.

```shell
mkdir -p proto && touch proto/example.proto
```

Open up the above file and add the following service definition:

```Protobuf
syntax = "proto3";

package apache.dubbo.demo.example.v1;

message SayRequest {
  string sentence = 1;
}

message SayResponse {
  string sentence = 1;
}

service ExampleService {
  rpc Say(SayRequest) returns (SayResponse) {}
}
```


# Generate code

Create the gen directory as the target directory for generating file placement:
```Shell
mkdir -p gen
```
Run the following command to generate a code file in the gen directory:

```Shell
PATH=$PATH:$(pwd)/node_modules/.bin \
  protoc -I proto \
  --es_out gen \
  --es_opt target=ts \
  --apache-dubbo-es_out gen \
  --apache-dubbo-es_opt target=ts \
  example.proto
```

After running the command, the following generated files should be visible in the target directory:

```Plain Text
├── gen
│   ├── example_dubbo.ts
│   └── example_pb.ts
├── proto
│   └── example.proto
```

Next, we are going to use these files to implement our service.


# Implement the service

We defined the `ElizaService` - now it's time to implement it, and register it with the `DubboRouter`. First, let's create a file where we can put the implementation:

Create a new file `dubbo.ts` with the following contents:

```typescript
import { DubboRouter } from "@apachedubbo/dubbo";
import { ExampleService } from "./gen/example_dubbo";

export default (router: DubboRouter) =>
  // registers apache.dubbo.demo.example.v1
  router.service(ExampleService, {
    // implements rpc Say
    async say(req) {
      return {
        sentence: `You said: ${req.sentence}`,
      };
    },
  }, { serviceGroup: 'dubbo', serviceVersion: '1.0.0' });
```

That's it! There are many other alternatives to implementing a service, and you have access to a context object for headers and trailers, but let's keep it simple for now.


# Start a server

Dubbo services can be plugged into vanilla Node.js servers, [Next.js](https://nextjs.org/), [Express](https://expressjs.com/), or [Fastify](https://fastify.dev/). We are going to use Fastify here. Let's install it, along with our plugin for Fastify:

```shell
npm install fastify @apachedubbo/dubbo-fastify
```

Create a new file `server.ts` with the following contents and register the `ExampleService` implemented in the previous step with it.
Next, you can directly initialize and start the server, which will receive requests on the specified port:

```typescript
import { fastify } from "fastify";
import { fastifyDubboPlugin } from "@apachedubbo/dubbo-fastify";
import routes from "./dubbo";

async function main() {
  const server = fastify();
  await server.register(fastifyDubboPlugin, {
    routes,
  });
  server.get("/", (_, reply) => {
    reply.type("text/plain");
    reply.send("Hello World!");
  });
  await server.listen({ host: "localhost", port: 8080 });
  console.log("server is listening at", server.addresses());
}

void main();
```

Congratulations. Your endpoint is ready to go! You can start your server with:

```Shell
npx tsx server.ts
```

# Make requests

The simplest way to consume your new API is an HTTP/1.1 POST with a JSON payload. If you have a recent version of cURL installed, it's a one-liner:

```Shell
curl \
 --header 'Content-Type: application/json' \
 --header 'TRI-Service-Version: 1.0.0' \
 --header 'TRI-Service-group: dubbo' \
 --data '{"sentence": "Hello World"}' \
 http://localhost:8080/apache.dubbo.demo.example.v1.ExampleService/Say
```

You can also use the standard Dubbo client request service. First, we need to obtain the service proxy from the generated code, which is the Dubbo node package, specify the server address for it, and initialize it. Then, we can initiate an RPC call.

Create a `client.ts` file.

```typescript
import { createPromiseClient } from "@apachedubbo/dubbo";
import { ExampleService } from "./gen/example_dubbo";
import { createDubboTransport } from "@apachedubbo/dubbo-node";

const transport = createDubboTransport({
  baseUrl: "http://localhost:8080",
  httpVersion: "1.1",
});

async function main() {
  const client = createPromiseClient(ExampleService, transport, { serviceVersion: '1.0.0', serviceGroup: 'dubbo' });
  const res = await client.say({ sentence: "Hello World" });
  console.log(res);
}
void main();
```

Run client:

```Shell
npx tsx client.ts
```

---

# Others

Refer to [Developing Web Applications Running on Browsers](../dubboForWEB/GettingStarted.md) to learn how to develop browser pages that can access Dubbo backend services.
