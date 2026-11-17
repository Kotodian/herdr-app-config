# 地址策略与本地诊断

本地诊断不创建监控服务、后台原站测速或额外 HTTP 请求。
开发阶段只编译测试源码；本文示例与测试没有在 dev 执行。

## 地址策略

Rust `DirectOutbound<S>` 的 S 是 `DirectAddressStrategy`，底层 `TcpDialer` 独立保存：

1. `resolve(dialer, domain, port)` 为真实业务提供地址，默认调用宿主 dialer 的解析能力。
2. `order(domain, generation, &mut [DirectAddress])` 接收本代的地址历史快照。
3. 每次已完成且未取消的 TCP 建连调用 `feedback`，带 domain、generation、IP:port 和真实耗时/错误。

NativeFactory 通过既有 dialer 依赖的默认方法 `TcpDialer::direct_addresses()` 取得策略。
宿主可覆盖此方法返回自定义策略，再沿原 `Dependencies::with_dialer` 注入；
原 dialer 实现无需增加方法，默认仍为 `HistoricalAddresses`。
TCP 经 NativeStream，HTTP 经 NativeHttp connector，均实际调用同一 DirectOutbound。
HTTP 复用连接时不重新解析，新连接由策略提供地址；反代的原 DNS 缓存路径保持独立。
TLS SNI、authority 和目标头仍由原域名映射确定。

Go 沿用 `Dependencies.Resolver` 提供地址来源。宿主 Dialer 可额外实现小接口
`DirectAddressProvider.DirectAddresses() DirectAddressStrategy`，替换 Order/Feedback；
未实现或返回 nil 则为 HistoricalAddresses。Factory → prepareRoutes → connectRoute →
dialRoute 同时服务 Connect 与 HTTP 新连接，没有强行复制 Rust 泛型。

内建策略保留解析顺序作为初始顺序，稳定排序时先比较失败次数，
再优先成功历史中耗时较好的地址，不建立新的评分算法。
DNS、全部地址建连、TLS 和跨出口尝试仍共享既有执行器 deadline。
仅 TCP 建连未发送业务数据时轮换地址，不因目标响应或正文失败重放。
网络变化创建新代直连历史；旧对象迟到反馈不会写入新对象。
Go 反馈也检查获取上下文、route 和 session generation。

策略同步方法不在健康锁内调用，须快速、可并发调用；异步来源必须遵守取消。
外部策略若自行保存历史，必须按传入 generation 隔离，不能把旧代反馈当成新网络测量。

## 探测窗口

Rust 通过 Observer 的默认回调 `probe_diagnostics` 交付只读
`Arc<dyn ProbeDiagnosticsSource>`，自定义 observer 可保留它并调用 snapshot。
`DiagnosticRecorder::snapshot().probes` 和 `snapshot_if_changed` 已消费此入口。
源通过弱引用读取当前 Registry，不延长实例资源寿命。
读取时过滤过期样本，窗口过期或 generation 改变会更新 recorder revision。
Go 使用 `Mode.Diagnostics()` 读取生产 probeBatch/probeLoop 写入的 accessHealth 副本，
原 Status 字段与行为不变。

| 字段 | 两种实现共用的含义 |
| --- | --- |
| generation / Generation | 当前网络代际，网络变化后重新开始 |
| endpoints / Probes | 仅实际接入点；同地址共用探测的线路编号合并到 routes/Routes，不重复累计 |
| completed / Completed | 读取时最近 60 秒内完成的成功、失败和超时 |
| success / Success | 上述完成样本的成功数 |
| canceled / Canceled | 独立的最近 60 秒取消数，不进入完成分母 |
| success_rate / SuccessRate | success/completed；零分母为 None/nil，不是 0% |
| truncated / Truncated | 窗口内样本因容量被逐出，计数仅代表保留样本 |
| capacity_per_outcome / CapacityPerOutcome | 完成和取消各最多 256 条；成功为完成样本的子集 |

C-only 的接入点列表为空，不生成原站测量。
Rust 没有注册源、实例已释放或当代已失效时 probes 为 None。
读取不改变资格、选择或熔断；真实业务接入结果不进入探测窗口。
诊断以线路编号关联宿主持有的配置，不输出带凭据节点 URL。

## 业务指标与真实口径

| 指标 | Rust 生产写入 → 消费 | Go 生产写入 → 消费 |
| --- | --- | --- |
| 首字节 | managed_stream::ObservedStream 首次写入后开始、首次读到字节结束的 UpstreamFirstByte → recorder events/metrics；可能是 TLS 记录 | Request 提交后开始；HTTP/1 在 reader 首次可读字节处采集，HTTP/2 用固定依赖的 GotFirstResponseByte 回调；FirstByteBoundary 标明 response-byte 或 http2-response-headers |
| HTTP 响应头 | upstream_request_filter → upstream_response_filter 的 HttpHeaders；不是精确 HTTP 首字节 | Business 的 headers.Elapsed；交换失败也保留 interrupted 记录 |
| 正文数据/中断 | upstream_response_filter 创建 HttpBody、response_body_filter 累计数据、logging/Operation Drop 结算 → events、metrics、resources.incomplete_body_bytes | responseBody.Read 计真实字节、EOF、错误，Close 结算 body 事件；提前关闭标 Interrupted |
| 缓存 | request_cache_filter 的实际 cache-hit 回调 → HttpCacheHit 字节/耗时，与上游 HttpBody 分开 | 没有响应缓存，CacheAvailable=false；不表示命中率 0% |
| 复用 | connected_to_upstream 的 reused → HttpReuse/Http2Reuse → recorder | pool.take 实际命中 → connectHTTP → Business.Reused；单次请求标记，不写入共享连接 |

Rust 精确逐请求 HTTP 首字节尚无可用采集边界，现有 Pingora 回调给的是完整响应头。
Go 固定版本的 HTTP/2 trace 在完整首个 HEADERS 处理时调用，不能称作线上第一个字节；
因此明确标为 http2-response-headers。Go 原始 TCP 首字节/字节吞吐诊断尚未实现。
这些限制不通过用响应头或 TLS 握手耗时冒充缺失测量来销项。

Rust 业务 counters/resources 为会话累积，events 为最近 256 条事件，
与新增的 60 秒探测窗口独立。默认不输出目标名，目标捕获沿原 opt-in。
Go Business 为最近 60 秒内保留的最多 256 条 headers/body 记录，带出口编号、协议、代际，
不包含 URL/正文。正文在调用方关闭 Body 时结算，活跃正文尚无最终观测。
TimedOut 保留 SDK 预算、调用方 deadline 和实际 I/O 超时；Canceled 仅表示调用方/实例取消，
不会因 SDK 预算内部使用 cancelRequest 终止 HTTP/2 而冒充取消。
HTTP/1 上传失败触发的立即读 deadline 只是唤醒读者，诊断通过同步保存的写失败原因区分，
不会把普通上传错误变成超时。
旧代正文仍能读取，但迟到记录不进入当前代诊断；Restart 的新句柄读取新 session。

正文 bytes 与 elapsed 是被动业务数据，不是主动带宽测试或可跨目标排名的吞吐值；
编码、缓存和客户端背压都会影响它们。dial_elapsed 是拨号总成本，不是 RTT；
探测失败比例不是 IP 丢包率。没有合成未测量的 RTT、丢包率或吞吐指标。

## 无需真实节点的示例

以下 Rust C-only 示例无业务请求，接入点列表为空；没有在 dev 运行：

```rust
use steam_proxy::{Config, Dependencies, DiagnosticRecorder, Factory, Payload, Routes, Whitelist};
use tokio_util::sync::CancellationToken;

async fn inspect_local() -> steam_proxy::Result<()> {
    let recorder = DiagnosticRecorder::default();
    let sdk = Factory::new(Dependencies::new().with_observer(recorder.clone()))
        .create(Config::new("local", Routes {
            payload: Payload::Tcp,
            reverse: vec![],
            direct: true,
            tunnel: vec![],
        }.into(), Whitelist::steam()))?;
    sdk.start(CancellationToken::new()).await?;
    if let Some(probes) = recorder.snapshot().probes {
        assert!(probes.endpoints.is_empty());
    }
    sdk.close().await
}
```

Go Create 后可直接读取零样本，无须启动或连接：

```go
mode, err := steamproxy.NewFactory(steamproxy.Dependencies{}).Create(steamproxy.Config{
    Routes: &steamproxy.Routes{Payload: steamproxy.PayloadTCP, Direct: true},
    Whitelist: steamproxy.Whitelist{"example.test": "example.test"},
})
if err != nil { return err }
snapshot := mode.Diagnostics()
fmt.Println(snapshot.Generation, len(snapshot.Probes), snapshot.CacheAvailable)
return mode.Close()
```

真实业务只需在原 Request/Connect 调用后读取，无须附加测试请求。
策略替换、Native HTTP/TCP 组装、窗口过期/去重/代际隔离与 Go 本地 HTTP 采集的测试源码
均纳入本任务允许的编译检查；编译不代表行为运行通过。

## 兼容范围

Dependencies 的原字段、配置 wire、Factory/start/serve/close/restart 和既有 Status 不改。
Rust TcpDialer、Observer 只增加带默认实现的方法，原实现仍可编译；
Go DirectAddressProvider 是可选接口，原 Dialer 无需实现。
Rust DiagnosticSnapshot 的 serde 表示增加可选 probes；未注册源时省略，
旧快照反序列化默认为 None。这是诊断 JSON 的增量扩展，不是配置 wire 或 C ABI 变化。
Go Diagnostics 使用独立方法。没有为此修改 C/TS/Swift/Kotlin 绑定。
