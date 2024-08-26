# 使用 Node.js 开发后端服务

基于 Dubbo 定义的 Triple 协议，你可以轻松编写浏览器、gRPC 兼容的 RPC 服务，并让这些服务同时运行在 HTTP/1 和 HTTP/2 上。Dubbo Node.js SDK 支持使用 IDL 或编程语言特有的方式定义服务，并提供一套轻量的 API 来发布或调用这些服务。

本示例演示了基于 Triple 协议的 RPC 通信模式，示例使用 Protocol Buffer 定义 RPC 服务，并演示了代码生成、服务发布和服务访问等过程。

## <span id="precondition">前置条件</span>

因为使用 Protocol Buffer 的原因，我们首先需要安装相关的代码生成工具，这包括 `@bufbuild/protoc-gen-es`、`@bufbuild/protobuf`、`@apachedubbo/protoc-gen-apache-dubbo-es`、`@apachedubbo/dubbo`。

```Shell
npm install @bufbuild/protoc-gen-es @bufbuild/protobuf @apachedubbo/protoc-gen-apache-dubbo-es @apachedubbo/dubbo
```

## <span id="defineService">定义服务</span>

现在，使用 Protocol Buffer (IDL) 来定义一个 Dubbo 服务。

创建目录，并生成文件

```Shell
mkdir -p proto && touch proto/example.proto
```

写入内容

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

这个文件声明了一个叫做 `ExampleService` 的服务，为这个服务定义了 `Say` 方法以及它的请求参数 `SayRequest` 和返回值 `SayResponse`。

## <span id="generateCode">生成代码</span>

创建 gen 目录，做为生成文件放置的目标目录

```
mkdir -p gen
```

运行以下命令，在 gen 目录下生成代码文件

```Shell
PATH=$PATH:$(pwd)/node_modules/.bin \
  protoc -I proto \
  --es_out gen \
  --es_opt target=ts \
  --apache-dubbo-es_out gen \
  --apache-dubbo-es_opt target=ts \
  example.proto
```

运行命令后，应该可以在目标目录中看到以下生成的文件:

```Plain Text
├── gen
│   ├── example_dubbo.ts
│   └── example_pb.ts
├── proto
│   └── example.proto
```

## <span id="implementService">实现服务</span>

接下来我们就需要添加业务逻辑了，实现 ExampleService ，并将其注册到 DubboRouter 中。

创建 dubbo.ts 文件

```typescript
import type { DubboRouter } from "@apachedubbo/dubbo";
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

## <span id="startServer">启动 Server</span>

Dubbo 服务可以嵌入到普通的 Node.js 服务器、Next.js、Express 或 Fastify 中。
在这里我们将使用 Fastify，所以让我们安装 Fastify 以及我们为 Fastify 准备的插件。

```Shell
npm install fastify @apachedubbo/dubbo-fastify
```

创建 server.ts 文件，新建一个 Server，把上一步中实现的 `ExampleService` 注册给它。
接下来就可以直接初始化和启动 Server 了，它将在指定的端口接收请求。

```typescript
import { fastify } from "fastify";
import { fastifyDubboPlugin } from "@apachedubbo/dubbo-fastify";
import routes from "./dubbo";
import { readFileSync } from "fs";

async function main() {
  const server = fastify({
    http2: true,
    https: {
      key: readFileSync("localhost+1-key.pem", "utf8"),
      cert: readFileSync("localhost+1.pem", "utf8"),
    }
  });
  await server.register(fastifyDubboPlugin, {
    routes,
  });
  await server.listen({ host: "localhost", port: 8443 });
  console.log("server is listening at", server.addresses());
}
void main();
```

最后，运行代码启动服务

```Shell
npx tsx server.ts
```

## <span id="accessService">访问服务</span>

我们将使用 `mkcert` 来生成证书。如果你还没有安装它，请运行以下命令：

```
brew install mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
```

如果你没有使用 macOS 或 `brew`，请参阅 [mkcert 文档](https://github.com/FiloSottile/mkcert#installation) 获取安装说明。你可以将最后一行复制到你的 `~/.zprofile` 或 `~/.profile` 中，这样每次打开终端时，Node.js 的环境变量都会自动设置。

如果你已经在使用 `mkcert`，只需运行 `mkcert localhost 127.0.0.1 ::1` 来为我们的示例服务器生成证书。

```Shell
npx buf curl --protocol grpc --schema . -d '{"sentence": "Hello Word!"}' \
https://localhost:8443/apache.dubbo.demo.example.v1.ExampleService/Say
```

也可以使用标准的 Dubbo client 请求服务，我们首先需要从生成代码即 dubbo-node 包中获取服务代理，为它指定 server 地址并初始化，之后就可以发起起 RPC 调用了。

创建 client.ts 文件。

```typescript
import { createPromiseClient } from "@apachedubbo/dubbo";
import { ExampleService } from "./gen/example_dubbo";
import { stdin, stdout, env } from "process";
import * as readline from "node:readline/promises";
import { createDubboTransport } from "@apachedubbo/dubbo-node";

const rl = readline.createInterface(stdin, stdout);

let rejectUnauthorized = true;

if (process.env.NODE_EXTRA_CA_CERTS == undefined) {
  console.log(env.NODE_EXTRA_CA_CERTS);
  rl.write("It appears that you haven't configured Node.js with your certificate authority for local development. This is okay; we'll bypass TLS errors in this example client. \n");
  rejectUnauthorized = false;
}


const transport = createDubboTransport({
  baseUrl: "https://localhost:8443",
  httpVersion: "2",
  nodeOptions: { rejectUnauthorized },
});

async function main() {
  const client = createPromiseClient(ExampleService, transport, { serviceVersion: '1.0.0', serviceGroup: 'dubbo' });
  const res = await client.say({ sentence: "Hello World" });
  console.log(res);
}
void main();
```

运行客户端

```Shell
npx tsx client.ts
```

## 其他

参考[开发运行在浏览器上的 web 应用](../dubbo-web-example/README.md)，了解如何开发能访问 Dubbo 后端服务的浏览器页面。
