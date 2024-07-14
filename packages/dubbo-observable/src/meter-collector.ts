/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
  Attributes,
  Counter,
  Histogram,
  Meter,
  MeterOptions,
  MetricOptions,
  ObservableCounter,
  UpDownCounter,
} from "@opentelemetry/api"
import { metrics, ValueType } from "@opentelemetry/api";
import { QpsCounter } from "./qps-counter.js";

export { ValueType } from "@opentelemetry/api";
export type { MetricOptions } from "@opentelemetry/api";

declare type MeterCache = {
  [meterName: string]: Counter | ObservableCounter | UpDownCounter | Histogram
};

/**
 * Configuration for meter collector.
 */
export interface MeterCollectorOptions extends MeterOptions{
  /**
   * The name of the meter or instrumentation library.
   */
  name?: string;

  /**
   * The version of the meter or instrumentation library.
   */
  version?: string;
}

export class MeterCollector {

  /**
   * Meter to collector metrics.
   * @private
   */
  private readonly meter: Meter | undefined;

  /**
   * Meter cache
   * @private
   */
  private readonly meter_cache: MeterCache | undefined;

  /**
   * Create a new MeterCollector.
   * If no options to provided, default option <code>{name: 'dubbo-js', version: '0.0.1'}</code> is used.
   * @param options
   */
  constructor(options?: MeterCollectorOptions) {
    // Get a meter from the global meter provider.
    this.meter = metrics.getMeter(options?.name || "dubbo-js", options?.version || "0.0.1", options);
    this.meter_cache = {} as MeterCache;
  }

  /**
   * Private method. Get a cached meter by `cacheKey`.
   * @param cacheKey Cache key for meter.
   * @param creator When the meter does not exist, this method will be called to create the Meter
   */
  __getCachedMeter(cacheKey: string, creator: () => Counter | ObservableCounter | undefined):
    Counter | ObservableCounter | undefined {

    if (!this.meter || !this.meter_cache) {
      return undefined;
    }

    if (!this.meter_cache[cacheKey]) {
      const meter = creator();
      if (meter) {
        this.meter_cache[cacheKey] = meter;
      } else {
        return undefined;
      }
    }
    return this.meter_cache[cacheKey] as Counter;
  }

  /**
   * Get a counter, first use the cached meter, if not, creates a new Counter metric.
   * Generally, this kind of metric when the value is a quantity,
   * the sum is of primary interest, and the event count and value distribution are not of primary interest.
   *
   * @param name the name of the metric.
   * @param options the metric options.
   */
  getCounter(name: string, options?: MetricOptions) : Counter | undefined{
    const cacheKey = `counter-${name}`;
    return this.__getCachedMeter(cacheKey, () => this.meter?.createCounter(name, options)) as Counter
  }

  /**
   * Get a observable counter, first use the cached meter, if not, creates a new ObservableCounter metric.
   * The callback SHOULD be safe to be invoked concurrently.
   *
   * @param name the name of the metric.
   * @param options the metric options.
   */
  getObservableCounter(name: string, options?: MetricOptions): ObservableCounter | undefined {
    const cacheKey = `observable-counter-${name}`;
    return this.__getCachedMeter(cacheKey,
      () => this.meter?.createObservableCounter(name, options)) as ObservableCounter
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.meter_cache) {
      Object.keys(this.meter_cache).forEach( key => {
        if (this.meter_cache) {
          delete this.meter_cache[key];
        }
      });
    }
  }

}

/**
 * Service provider metrics collector
 */
export class ProviderMeterCollector extends MeterCollector {
  /**
   * The counter of total number of received requests by the provider
   * @private
   */
  private providerRequestTotal: Counter | undefined;

  /**
   * The counter of total number of successfully received requests by the provider
   * @private
   */
  private providerRequestSucceedTotal: Counter | undefined;

  /**
   * The counter of total number of unsuccessfully received requests by the provider
   * @private
   */
  private providerRequestFailedTotal: Counter | undefined

  /**
   * The counter of number of requests received by the provider per second counter
   * @private
   */
  private providerRequestQps: ObservableCounter | undefined;

  /**
   * The QPS counter
   * @private
   */
  private qpsCounter: QpsCounter | undefined;

  constructor(options?: MeterCollectorOptions) {
    super(options)
    this.providerRequestTotal = this.getCounter("dubbo_provider_requests_total", {
      description: `The total number of received requests by the provider`,
      valueType: ValueType.INT
    });

    this.providerRequestSucceedTotal =
      this.getCounter("dubbo_provider_requests_succeed_total", {
        description: `The total number of successfully received requests by the provider`,
        valueType: ValueType.INT
      });

    this.providerRequestFailedTotal =
      this.getCounter("dubbo_provider_requests_failed_total", {
        description: `The total number of unsuccessfully received requests by the provider`,
        valueType: ValueType.INT
      });

    this.providerRequestQps = this.getObservableCounter("dubbo_provider_qps_total", {
      description: "The number of requests received by the provider per second",
      valueType: ValueType.INT
    });
  }

  /**
   * Total number of requests received by collecting provider.
   * Usually, the Provider immediately performs indicator collection when it receives the request.
   * @param attributes The options of metrics.
   */
  providerRequest(attributes?: Attributes) {
    this.providerRequestTotal?.add(1, attributes);
    if (this.qpsCounter == undefined) {
      const qpsCounter = new QpsCounter();
      this.qpsCounter = qpsCounter;
      this.providerRequestQps?.addCallback((observableResult) => {
        observableResult.observe(qpsCounter.getQps());
      })
    }
    this.qpsCounter?.increment();
  }

  /**
   * The total number of requests processed successfully
   * This indicator is usually collected after the request is successfully processed.
   * @param attributes The options of metrics.
   */
  providerRequestSucceed(attributes?: Attributes) {
    this.providerRequestSucceedTotal?.add(1, attributes);
  }

  /**
   * The total number of requests processed failed.
   * This indicator is usually collected after the request is failed processed.*
   * @param attributes The options of metrics.
   */
  providerRequestFailed(attributes?: Attributes) {
    this.providerRequestFailedTotal?.add(1, attributes);
  }

  /**
   * Stop collector metrics.
   */
  override shutdown() {
    super.shutdown();
    this.qpsCounter?.stop();
  }
}

/**
 * Service consumer metrics collector
 */
export class ConsumerMeterCollector extends MeterCollector {
  /**
   * The counter of total number of received requests by the consumer
   * @private
   */
  private consumerRequestTotal: Counter | undefined;

  /**
   * The counter of total number of successfully received requests by the consumer
   * @private
   */
  private consumerRequestSucceedTotal: Counter | undefined;

  /**
   * The counter of total number of unsuccessfully received requests by the consumer
   * @private
   */
  private consumerRequestFailedTotal: Counter | undefined

  /**
   * The counter of number of requests received by the consumer per second counter
   * @private
   */
  private consumerRequestQps: ObservableCounter | undefined;

  /**
   * The QPS counter.
   * @private
   */
  private qpsCounter: QpsCounter | undefined;

  constructor(options?: MeterCollectorOptions) {
    super(options)
    this.consumerRequestTotal = this.getCounter("dubbo_consumer_requests_total", {
      description: `The total number of received requests by the consumer`,
      valueType: ValueType.INT
    });

    this.consumerRequestSucceedTotal =
      this.getCounter("dubbo_consumer_requests_succeed_total", {
        description: `The total number of successfully received requests by the consumer`,
        valueType: ValueType.INT
      });

    this.consumerRequestFailedTotal =
      this.getCounter("dubbo_consumer_requests_failed_total", {
        description: `The total number of unsuccessfully received requests by the consumer`,
        valueType: ValueType.INT
      });

    this.consumerRequestQps = this.getObservableCounter("dubbo_consumer_qps_total", {
      description: "The number of requests received by the consumer per second",
      valueType: ValueType.INT
    });
  }

  /**
   * Total number of sent requests by consumers
   * Usually you need to call this method to collect metrics before the client sends a request
   * @param attributes The options of metrics.
   */
  consumerRequest(attributes?: Attributes) {
    this.consumerRequestTotal?.add(1, attributes);
    if (this.qpsCounter == undefined) {
      const qpsCounter = new QpsCounter();
      this.qpsCounter = qpsCounter;
      this.consumerRequestQps?.addCallback((observableResult) => {
        observableResult.observe(qpsCounter.getQps());
      })
    }
    this.qpsCounter?.increment();
  }

  /**
   * Collect metrics of successful consumer calls to remote service method
   * @param attributes The options of metrics.
   */
  consumerRequestSucceed(attributes?: Attributes) {
    this.consumerRequestSucceedTotal?.add(1, attributes);
  }

  /**
   * Collect metrics of fail consumer calls to remote service method
   * @param attributes The options of metrics.
   */
  consumerRequestFailed(attributes?: Attributes) {
    this.consumerRequestFailedTotal?.add(1, attributes);
  }

  /**
   * Stop collector metrics.
   */
  override shutdown() {
    super.shutdown();
    this.qpsCounter?.stop();
  }
}

