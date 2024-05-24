import { fastify } from "fastify";
import { fastifyDubboPlugin } from "@apachedubbo/dubbo-fastify";
import routes from "./dubbo";
import cors from "@fastify/cors";
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
// import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'

async function main() {
  const server = fastify();
  await server.register(fastifyDubboPlugin, {
    routes,

    /**
     * Enable Observable Service on service provider.
     */
    observableOptions: {
      enable: true,
      configuration: {
        serviceName: "dubbo-observable-example",
        // instrumentations: [getNodeAutoInstrumentations()],
        // traceExporter: new ConsoleSpanExporter(),
        metricReader: new PrometheusExporter({
          port: 9464
        })
      }
    }
  });
  await server.register(cors, {
    origin: true,
  });
  server.get("/", (_, reply) => {
    reply.type("text/plain");
    reply.send("Hello World!");
  });
  await server.listen({ host: "localhost", port: 8080 });
  console.log("provider server is listening at", server.addresses());
}

void main();
