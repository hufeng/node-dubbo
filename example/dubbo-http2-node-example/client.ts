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