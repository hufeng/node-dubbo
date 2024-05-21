# 启动步骤

1. 启动服务提供者

```shell
npx tsx server.ts
```

2. 启动服务消费者

```shell
npx tsx server.ts
```

3. 请求服务

```shell

curl localhost:8081/

```

4. 获取服务提供者监控指标

```shell
curl http://localhost:9464/metrics
```

5. 获取服务消费者监控指标

```shell
curl http://localhost:9465/metrics
```
