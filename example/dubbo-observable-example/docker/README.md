# 介绍
这个 docker compose 配置目前只提供了一套测试验证使用的指标采集及可视化展示环境，
指标采集和存储使用 [victoria-metrics](https://victoriametrics.com/)，指标展示使用 [Grafana](https://grafana.com/)。详细使用步骤如下：

1. 启动服务
```shell
cd dubbo-js/example/dubbo-observable-example/docker
docker compose up -d
```

2. 访问 Grafana 控制台: http://localhost:13000

3. 首次启动，需要添加 victoria metrics 数据源，如下：
   1. 打开 [Grafana Data Source](http://localhost:13000/connections/datasources)
   2. 点击 “+ Add new data source” 添加数据源
   3. 选择 “Prometheus“数据源
   4. Prometheus server URL 填写：http://vm:8428
   5. 保存数据源

4. 默认配置采集 Provider 和 Consumer 指标，配置请查看 [prometheus.yml](prometheus.yml)

