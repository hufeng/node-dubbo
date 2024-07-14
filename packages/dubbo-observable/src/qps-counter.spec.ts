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

import { QpsCounter } from "./qps-counter.js";

describe("QpsCounter", function () {
  let qpsCounter = new QpsCounter();

  beforeEach(function () {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date());
    qpsCounter = new QpsCounter();
  });

  afterEach(function () {
    jasmine.clock().uninstall();
    qpsCounter.stop();
  });

  it("should initialize counter correctly", function () {
    expect(qpsCounter).toBeDefined();
    expect(qpsCounter.getQps()).toBe(0);
  });

  it("should increment the counter correctly", function () {
    qpsCounter.increment();
    qpsCounter.increment();
    qpsCounter.increment();
    expect(qpsCounter.getQps()).toBe(0);

    jasmine.clock().tick(1000);

    expect(qpsCounter.getQps()).toBe(3);
  });
});
