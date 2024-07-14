import { fastify } from "fastify";
import cors from "@fastify/cors";
import { createPromiseClient } from "@apachedubbo/dubbo";
import { ExampleService } from "./gen/example_dubbo";
import { createDubboTransport } from "@apachedubbo/dubbo-node";
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
// import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'

const transport = createDubboTransport({
  baseUrl: "http://localhost:8080",
  httpVersion: "1.1",
  /**
   * Enable Observable Service on service consumer.
   */
  observableOptions: {
    enable: true,
    configuration: {
      serviceName: "dubbo-observable-example",
      // instrumentations: [getNodeAutoInstrumentations()],
      // traceExporter: new ConsoleSpanExporter(),
      metricReader: new PrometheusExporter({
        port: 9465
      })
    }
  }
});

async function main() {
  const server = fastify();
  await server.register(cors, {
    origin: true,
  });

  const client = createPromiseClient(ExampleService, transport, { serviceVersion: '1.0.0', serviceGroup: 'dubbo' });

  server.get("/", (_, reply) => {
    client.say({ sentence: "Hello World" }).then(rs => {
      reply.type("application/json");
      reply.send(rs.toJsonString());
    }).catch(e => {
      reply.code(500);
      reply.send(String(e));
    });
  });

  await server.listen({ host: "localhost", port: 8081 });
  console.log("customer server is listening at", server.addresses());
}
void main();
