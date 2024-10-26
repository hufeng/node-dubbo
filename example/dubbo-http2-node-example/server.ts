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