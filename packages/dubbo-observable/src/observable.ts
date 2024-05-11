import { NodeSDK } from '@opentelemetry/sdk-node';
import type {NodeSDKConfiguration} from '@opentelemetry/sdk-node';

export type ObservableOptions = {
  /**
   * Enable the monitor, default is false.
   */
  enable?: boolean,

  /**
   * Configuration for the monitor. Can see all the configuration options in the
   * [OpenTelemetry docs](https://opentelemetry.io/docs/languages/js/automatic/configuration/).
   */
  configuration?: Partial<NodeSDKConfiguration>
};

/**
 * Observability service management for managing the complete lifecycle of OT services
 */
export class Observable {
  private sdk?: NodeSDK;

  constructor(options?: ObservableOptions) {
    const config = validateOpenTelemetryOption(options);
    this.sdk = new NodeSDK(config);
  }
  start(){
    this.sdk?.start();
  }
  shutdown() {
    return this.sdk?.shutdown();
  }
}

/**
 * Creates a new instance of the Observable.
 */
export function createObservable(options?: ObservableOptions): Observable {
  return new Observable(options)
}

/**
 * Asserts that the options are within sane limits, and returns default values
 * where no value is provided.
 *
 * @param options
 */
export function validateOpenTelemetryOption(options?: ObservableOptions): Partial<NodeSDKConfiguration> {

  return {
    serviceName: options?.configuration?.serviceName ?? "Dubbo",
    ...options?.configuration,
  };
}
