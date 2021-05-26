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

import debug from 'debug'
import compose from 'koa-compose'
import Queue from './queue'
import config from './config'
import Context from './context'
import { go, util } from '@apache/dubbo-common'
import Scheduler from './scheduler'
import qs from 'querystring'
import ip from 'ip'
import {
  IDubboProps,
  IDubboProvider,
  Middleware,
  TDubboInterface,
  TDubboService,
  TDubboUrl
} from './types'
import { DubboSetting } from './dubbo-setting'

const log = debug('dubbo:bootstrap')
const packageVersion = require('../../package.json').version
log('dubbo-js version :=> %s', packageVersion)

/**
 * Dubbo
 *
 * 1. Connect to the registration center zookeeper
 * 2. Initiate method call of remote dubbo service
 * 3. Serialization/deserialization of dubbo protocol
 * 4. Manage tcp connection and heartbeat
 * 5. The corresponding method of automatically proxying interface through proxy mechanism
 * 6. Provide quick test interface in direct connection mode
 * 7. Middleware
 * 8. Full link tracking of dubbo calls can be realized through zone-context
 * 9. Centralized message management
 */
export default class Dubbo<TService = Object> {
  private readonly queue: Queue
  private readonly dubboSetting: DubboSetting
  private readonly props: IDubboProps
  private readonly middlewares: Array<Middleware<Context>>
  private readonly service: TDubboService<TService>
  private readonly consumers: Array<{
    dubboServiceInterface: TDubboInterface
    dubboServiceUrl: TDubboUrl
  }>

  constructor(props: IDubboProps) {
    this.props = props

    // check dubbo setting
    if (!props.dubboSetting) {
      throw new Error('Please specify dubboSetting')
    }

    // check dubbo register
    if (!util.isObj(this.props.registry)) {
      throw new Error('please specify registry instance')
    }

    this.consumers = []
    this.middlewares = []
    this.queue = Queue.init()
    this.dubboSetting = props.dubboSetting
    this.service = <TDubboService<TService>>{}

    //Initialize config
    //Global timeout (maximum fusing time) similar to <dubbo:consumer timeout="sometime"/>
    //For the consumer client, if the user sets the interface level timeout time, the interface level is used
    //If the user does not set the user level, the default is the maximum timeout
    const { dubboInvokeTimeout } = props
    config.dubboInvokeTimeout = dubboInvokeTimeout || config.dubboInvokeTimeout

    log(`initial:|> %O`, props)
    log('config:|> %O', config)

    this.init()
  }

  // ========================private method=======================
  private async init() {
    await this.props.registry.ready()
    this.consumeService(this.props.service)
    log('consumerService: %O', this.consumers)
    this.props.registry.registyConsumers(this.consumers)
    //create scheduler
    Scheduler.from(this.props.registry, this.queue)
  }

  /**
   * registry consume service
   * @param service
   * service style:
   * {[key: string]: (dubbo): T => dubbo.proxyService<T>({...})}
   */
  private consumeService(services: Object) {
    for (let [shortName, serviceProxy] of Object.entries(services)) {
      const service = serviceProxy(this) as IDubboProvider
      const meta = this.dubboSetting
        ? this.dubboSetting.getDubboSetting({
            dubboServiceShortName: shortName,
            dubboServiceInterface: service.dubboInterface
          })
        : {
            group: '',
            version: '0.0.0'
          }
      service.group = meta.group
      service.version = meta.version
      this.service[shortName] = this.composeService(service)
    }
  }

  private composeService = (provider: IDubboProvider) => {
    const { application, isSupportedDubbox } = this.props
    const { dubboInterface, methods, timeout, group, version } = provider
    const proxyObj = Object.create(null)

    this.consumers.push({
      dubboServiceInterface: dubboInterface,
      dubboServiceUrl: `consumer://${ip.address()}/${dubboInterface}?${qs.stringify(
        {
          interface: dubboInterface,
          application: this.props.application.name,
          category: 'consumers',
          method: '',
          revision: '',
          version: group,
          group: version,
          timeout: timeout,
          side: 'consumer',
          check: false
        }
      )}`
    })

    //proxy methods
    Object.keys(methods).forEach((name) => {
      proxyObj[name] = async (...args: any[]) => {
        log('%s create context', name)
        //创建dubbo调用的上下文
        const ctx = Context.init()
        ctx.application = application
        ctx.isSupportedDubbox = isSupportedDubbox

        // set dubbo version
        ctx.dubboVersion = this.props.dubboVersion

        const method = methods[name]
        ctx.methodName = name
        ctx.methodArgs = method.call(provider, ...args) || []

        ctx.dubboInterface = dubboInterface
        ctx.version = version
        ctx.timeout = timeout
        ctx.group = group

        const self = this
        const middlewares = [
          ...this.middlewares, //handle request middleware
          async function handleRequest(ctx) {
            log('start middleware handle dubbo request')
            ctx.body = await go(self.queue.push(ctx))
            log('end handle dubbo request')
          }
        ]

        log('middleware->', middlewares)
        const fn = compose(middlewares)

        try {
          await fn(ctx)
        } catch (err) {
          log(err)
        }

        return ctx.body
      }
    })

    return proxyObj
  }

  //========================public method===================
  /**
   * static factory method
   * @param props
   */
  static from(props: IDubboProps) {
    return new Dubbo(props)
  }

  /**
   * 代理dubbo的服务
   */
  proxyService(provider: IDubboProvider) {
    return provider
  }

  /**
   * extends middleware, api: the same as koa
   * @param fn
   */
  use(fn: Middleware<Context>) {
    if (typeof fn != 'function') {
      throw new TypeError('middleware must be a function')
    }
    log('use middleware %s', (fn as any)._name || fn.name || '-')
    this.middlewares.push(fn)
    return this
  }

  /**
   * The connection of dubbo is asynchronous. Whether the connection is successful or not is usually known at runtime.
   * At this time, it may give us some trouble, we must send a request to know the status of dubbo
   * Based on this scenario, we provide a method to tell the outside whether dubbo is initialized successfully,
   * In this way, we will know the connection status of dubbo during node startup, if we can't connect, we can
   * Timely fixed
   *
   * For example, in conjunction with egg, egg provides a beforeStart method
   * Wait for the successful initialization of dubbo through the ready method
   *
   * //app.js
   * export default (app: EggApplication) => {
   * const dubbo = Dubbo.from({....})
   * app.beforeStart(async () => {
   *  await dubbo.ready();
   *  console.log('dubbo was ready...');
   * })
   *}
   *
   * Other frameworks are similar
   */
  ready() {
    return this.props.registry.ready()
  }
}