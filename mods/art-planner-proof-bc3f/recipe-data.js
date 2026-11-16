// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "Planner 已接入可替换过滤器和同层选择器，固定顺序由规划器保证。\n\n本次只补齐这一组合缺口；完整台账区分实现、静态证据和未运行验收。"
    },
    {
      "type": "callout",
      "tone": "warn",
      "title": "运行验收留待 main",
      "md": "遵守“dev 不回归，main 才回归”。本次编译了测试源码，没有执行测试；其他明确实现缺口仍需先补实现。"
    },
    {
      "type": "tabs",
      "tabs": [
        {
          "label": "本次修复与证据",
          "blocks": [
            {
              "type": "heading",
              "text": "Planner 组合前后",
              "level": 2
            },
            {
              "type": "text",
              "md": "基线 `eeb40b49005ffe0872f07d4dd8d254764a03f105` → 最终候选 `bfe9fcbf5b89e0ed59d938cae8465d5852898f83`。只改三个 routing 文件。"
            },
            {
              "type": "details",
              "summary": "过滤",
              "blocks": [
                {
                  "type": "text",
                  "md": "**之前**：Planner 直接调用 filter::allows\n\n**之后**：CandidateFilter / DefaultFilter 实际调用；原资格 helper 保留"
                }
              ]
            },
            {
              "type": "details",
              "summary": "同层选择",
              "blocks": [
                {
                  "type": "text",
                  "md": "**之前**：Planner 内联整个排序与哈希\n\n**之后**：NodeSelector / DefaultNodeSelector 承载原算法"
                }
              ]
            },
            {
              "type": "details",
              "summary": "固定顺序",
              "blocks": [
                {
                  "type": "text",
                  "md": "**之前**：Planner 内固定 A→B→C→D\n\n**之后**：仍由 Planner 固定；校验策略返回编号属于当前候选"
                }
              ]
            },
            {
              "type": "details",
              "summary": "调用入口",
              "blocks": [
                {
                  "type": "text",
                  "md": "**之前**：routing::select → 单元 Planner\n\n**之后**：同一入口 → Planner<DefaultFilter, DefaultNodeSelector>"
                }
              ]
            },
            {
              "type": "details",
              "summary": "资源边界",
              "blocks": [
                {
                  "type": "text",
                  "md": "**之前**：调用侧取出口、复查；AttemptLoop 或 HTTP 控制提交与重试\n\n**之后**：保留；Planner 只读借用、返回编号"
                }
              ]
            },
            {
              "type": "text",
              "md": "同一个源码契约核对在基线报缺失、候选具备；这是结构证据，不是运行复现。"
            },
            {
              "type": "code",
              "lang": "text",
              "text": "Source-only contract check at eeb40b49005ffe0872f07d4dd8d254764a03f105:\n  MISSING: CandidateFilter contract and default implementation\n  MISSING: NodeSelector contract and default implementation\n  MISSING: Planner owns and invokes the two strategies\n  MISSING: Returned ID is checked against this tier's filtered candidates\nSource-only contract check at bfe9fcbf5b89e0ed59d938cae8465d5852898f83:\n  PASS: CandidateFilter contract and default implementation\n  PASS: NodeSelector contract and default implementation\n  PASS: Planner owns and invokes the two strategies\n  PASS: Returned ID is checked against this tier's filtered candidates\nExisting execution-time eligibility helper is byte-for-byte unchanged.\nFixed tiers, operation boundary, 20% threshold and hash inputs retained in source.\nAll pre-existing routing test bodies preserved except default Planner construction.\nOnly filter.rs, select.rs and routing/tests.rs changed; public API/wire untouched.\nThis is static source inspection, not execution of Planner or behavior tests.\n"
            },
            {
              "type": "text",
              "md": "真实静态命令结果：测试源码编译成功；没有运行测试。"
            },
            {
              "type": "code",
              "lang": "json",
              "text": "{\n  \"candidate\": \"bfe9fcbf5b89e0ed59d938cae8465d5852898f83\",\n  \"base\": \"eeb40b49005ffe0872f07d4dd8d254764a03f105\",\n  \"cargo_check\": {\n    \"command\": \"cargo check --offline --locked --tests\",\n    \"exit_code\": 0,\n    \"scope\": \"default features, compilation only; no tests executed\",\n    \"last_line\": \"Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 28s\"\n  },\n  \"source_files\": [\n    \"src/routing/filter.rs\",\n    \"src/routing/select.rs\",\n    \"src/routing/tests.rs\"\n  ],\n  \"format\": {\n    \"command\": \"cargo fmt --all -- --check\",\n    \"exit_code\": 0,\n    \"output\": \"\"\n  },\n  \"diff_check\": {\n    \"command\": \"git diff --check eeb40b49005ffe0872f07d4dd8d254764a03f105 bfe9fcbf5b89e0ed59d938cae8465d5852898f83\",\n    \"exit_code\": 0,\n    \"output\": \"\"\n  }\n}"
            },
            {
              "type": "details",
              "summary": "完整 cargo check 输出（含未修改模块的警告）",
              "blocks": [
                {
                  "type": "code",
                  "lang": "text",
                  "text": "   Compiling proc-macro2 v1.0.107\n   Compiling unicode-ident v1.0.27\n   Compiling quote v1.0.47\n   Compiling libc v0.2.191\n   Compiling syn v3.0.10\n   Compiling syn v2.0.119\n    Checking cfg-if v1.0.5\n   Compiling serde_core v1.0.229\n   Compiling serde v1.0.229\n   Compiling serde_derive v1.0.229\n   Compiling zeroize_derive v1.5.0\n    Checking typenum v1.20.1\n    Checking zeroize v1.9.1\n   Compiling jobserver v0.1.35\n   Compiling shlex v2.0.1\n   Compiling find-msvc-tools v0.1.15\n    Checking cmov v0.5.4\n   Compiling cc v1.11.1\n    Checking smallvec v1.16.5\n    Checking ctutils v0.4.8\n    Checking rand_core v0.10.1\n    Checking memchr v2.8.3\n   Compiling getrandom v0.4.3\n    Checking hybrid-array v0.4.15\n    Checking pin-project-lite v0.2.17\n    Checking scopeguard v1.2.0\n   Compiling parking_lot_core v0.9.12\n    Checking crypto-common v0.2.2\n    Checking bytes v1.12.1\n    Checking lock_api v0.4.14\n   Compiling portable-atomic v1.15.0\n   Compiling autocfg v1.5.1\n    Checking parking_lot v0.12.5\n    Checking critical-section v1.2.0\n    Checking block-buffer v0.12.1\n   Compiling version_check v0.9.5\n    Checking errno v0.3.14\n    Checking socket2 v0.6.5\n    Checking once_cell v1.21.4\n   Compiling pkg-config v0.3.34\n    Checking signal-hook-registry v1.4.8\n   Compiling cmake v0.1.58\n   Compiling tokio-macros v2.7.2\n    Checking mio v1.2.4\n   Compiling num-traits v0.2.19\n    Checking tokio v1.54.1\n   Compiling displaydoc v0.2.7\n    Checking futures-core v0.3.34\n    Checking itoa v1.0.19\n    Checking getrandom v0.2.17\n    Checking cpufeatures v0.3.1\n    Checking const-oid v0.10.3\n    Checking digest v0.11.3\n   Compiling zerocopy v0.8.63\n   Compiling thiserror v2.0.21\n    Checking slab v0.4.12\n   Compiling thiserror-impl v2.0.21\n    Checking futures-sink v0.3.34\n   Compiling fs_extra v1.3.0\n   Compiling dunce v1.0.5\n    Checking futures-io v0.3.34\n   Compiling aws-lc-sys v0.45.0\n    Checking futures-channel v0.3.34\n   Compiling futures-macro v0.3.34\n   Compiling synstructure v0.14.0\n    Checking subtle v2.6.1\n    Checking futures-task v0.3.34\n    Checking futures-util v0.3.34\n   Compiling zerofrom-derive v0.1.8\n   Compiling ring v0.17.14\n    Checking foldhash v0.2.0\n   Compiling num-conv v0.2.2\n    Checking equivalent v1.0.3\n    Checking allocator-api2 v0.2.21\n   Compiling time-core v0.1.9\n   Compiling aws-lc-rs v1.18.1\n   Compiling time-macros v0.2.32\n    Checking hashbrown v0.17.1\n    Checking zerofrom v0.1.8\n   Compiling yoke-derive v0.8.4\n    Checking ppv-lite86 v0.2.21\n    Checking http v1.5.0\n    Checking rustls-pki-types v1.16.0\n   Compiling synstructure v0.13.2\n    Checking log v0.4.35\n    Checking minimal-lexical v0.2.1\n    Checking deranged v0.5.9\n    Checking stable_deref_trait v1.2.1\n   Compiling getrandom v0.3.4\n    Checking alloc-no-stdlib v2.0.4\n    Checking powerfmt v0.2.1\n    Checking time v0.3.55\n    Checking alloc-stdlib v0.2.4\n    Checking yoke v0.8.4\n    Checking nom v7.1.3\n    Checking keccak v0.2.2\n    Checking inout v0.2.6\n   Compiling thiserror v1.0.69\n   Compiling cfg_aliases v0.2.2\n    Checking untrusted v0.9.0\n    Checking rusticata-macros v4.1.0\n    Checking tracing-core v0.1.36\n   Compiling thiserror-impl v1.0.69\n   Compiling asn1-rs-impl v0.2.0\n   Compiling tracing-attributes v0.1.31\n   Compiling zerovec-derive v0.11.7\n   Compiling crossbeam-utils v0.8.23\n    Checking zerovec v0.11.9\n    Checking tracing v0.1.44\n    Checking cipher v0.5.2\n    Checking sponge-cursor v0.1.0\n   Compiling crunchy v0.2.4\n    Checking shake v0.1.0\n    Checking brotli-decompressor v5.0.3\n    Checking indexmap v2.14.2\n    Checking rand_core v0.6.4\n   Compiling generic-array v0.14.7\n   Compiling tiny-keccak v2.0.2\n   Compiling syn v1.0.109\n   Compiling strsim v0.11.1\n   Compiling rustls v0.23.40 (https://github.com/aimalygin/shaped-rustls?rev=3a131beaef0183b0cb61e5a9070a703b6be39ed3#3a131bea)\n   Compiling ident_case v1.0.1\n    Checking brotli v8.0.4\n    Checking num-integer v0.1.47\n   Compiling zstd-sys v2.1.2+zstd.1.5.7\n    Checking arrayvec v0.7.8\n   Compiling crc32fast v1.5.5\n    Checking zlib-rs v0.6.8\n    Checking data-encoding v2.11.1\n    Checking fnv v1.0.7\n    Checking lazy_static v1.5.1\n   Compiling httparse v1.10.1\n    Checking rustls-webpki v0.103.16\n    Checking num-bigint v0.4.8\n    Checking rand_chacha v0.3.1\n    Checking tinystr v0.8.5\n   Compiling libz-ng-sys v1.1.33\n    Checking aho-corasick v1.1.5\n   Compiling heck v0.5.0\n    Checking writeable v0.6.4\n    Checking litemap v0.8.3\n    Checking bitflags v2.13.2\n    Checking regex-syntax v0.8.11\n    Checking utf_types v1.0.0\n    Checking utf8_iter v1.1.0\n    Checking icu_locale_core v2.4.0\n   Compiling const-random-macro v0.1.16\n    Checking regex-automata v0.4.18\n    Checking rand v0.8.8\n    Checking potential_utf v0.1.6\n    Checking zerotrie v0.2.5\n    Checking tokio-util v0.7.20\n   Compiling ahash v0.8.12\n    Checking core-foundation-sys v0.8.7\n   Compiling icu_normalizer_data v2.4.0\n    Checking adler2 v2.0.1\n   Compiling icu_properties_data v2.4.0\n    Checking simd-adler32 v0.3.10\n   Compiling zstd-safe v8.2.0\n    Checking miniz_oxide v0.9.1\n    Checking icu_provider v2.4.0\n    Checking icu_collections v2.4.0\n    Checking const-random v0.1.18\n    Checking crypto-common v0.1.7\n    Checking block-buffer v0.10.4\n    Checking chacha20 v0.10.2\n   Compiling asn1-rs-derive v0.5.1\n    Checking futures-executor v0.3.34\n   Compiling proc-macro2-diagnostics v0.10.1\n    Checking universal-hash v0.6.1\n    Checking thread_local v1.1.10\n   Compiling semver v1.0.28\n    Checking ryu v1.0.23\n    Checking cpubits v0.1.1\n    Checking atomic-waker v1.1.2\n    Checking utf8parse v0.2.2\n   Compiling rustversion v1.0.23\n    Checking anstyle-parse v1.0.0\n    Checking h2 v0.4.20 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking flate2 v1.1.11\n   Compiling rustc_version v0.4.1\n    Checking futures v0.3.34\n    Checking asn1-rs v0.6.2\n    Checking digest v0.10.7\n    Checking security-framework-sys v2.17.0\n    Checking core-foundation v0.9.4\n    Checking regex v1.13.1\n   Compiling darling_core v0.24.1\n    Checking crossbeam-queue v0.3.14\n   Compiling asn1-rs-derive v0.6.0\n   Compiling memoffset v0.9.1\n    Checking parking v2.2.1\n   Compiling anyhow v1.0.104\n    Checking is_terminal_polyfill v1.70.2\n   Compiling oid-registry v0.7.1\n   Compiling yansi v1.0.1\n    Checking anstyle v1.0.14\n    Checking anstyle-query v1.1.5\n   Compiling zmij v1.0.23\n    Checking colorchoice v1.0.5\n    Checking pingora-error v0.9.1\n   Compiling rust_decimal v1.43.0\n    Checking percent-encoding v2.3.2\n    Checking anstream v1.0.0\n   Compiling darling_macro v0.24.1\n    Checking event-listener v5.4.2\n    Checking asn1-rs v0.7.2\n    Checking security-framework v2.11.1\n    Checking icu_properties v2.4.0\n    Checking icu_normalizer v2.4.0\n    Checking zstd v0.14.3\n   Compiling curve25519-dalek v4.1.3\n    Checking tokio-rustls v0.26.6\n   Compiling darling_core v0.23.0\n    Checking rand_core v0.9.5\n   Compiling quinn-udp v0.5.16\n   Compiling nix v0.31.3\n    Checking rustls-pemfile v2.2.0\n   Compiling blake3 v1.8.5 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n   Compiling async-trait v0.1.92\n    Checking num_cpus v1.17.0\n   Compiling typeid v1.0.3\n    Checking fastrand v2.5.0\n    Checking httpdate v1.0.3\n   Compiling either v1.19.0\n    Checking seize v0.3.3\n    Checking base64 v0.22.1\n   Compiling oid-registry v0.8.1\n    Checking hashbrown v0.14.5\n    Checking tinyvec v1.13.3\n   Compiling serde_json v1.0.154\n    Checking clap_lex v1.1.1\n    Checking base64 v0.23.1\n   Compiling protobuf v3.7.2\n    Checking fixedbitset v0.5.9\n   Compiling heck v0.4.1\n    Checking petgraph v0.7.1\n   Compiling ouroboros_macro v0.18.5\n    Checking clap_builder v4.6.7\n    Checking dashmap v5.5.3\n    Checking flurry v0.5.2\n   Compiling itertools v0.14.0\n   Compiling darling_macro v0.23.0\n    Checking rustls-native-certs v0.7.3\n    Checking rand_chacha v0.9.0\n   Compiling strum_macros v0.26.4\n    Checking idna_adapter v1.2.2\n    Checking event-listener-strategy v0.5.4\n   Compiling darling v0.24.1\n    Checking pingora-http v0.9.1\n    Checking der-parser v9.0.0\n    Checking aes v0.9.4\n    Checking pingora-timeout v0.9.1\n    Checking rand v0.10.3\n   Compiling clap_derive v4.6.7\n   Compiling prometheus-client-derive-text-encode v0.3.0\n    Checking concurrent-queue v2.5.0\n    Checking protobuf-support v3.7.2\n   Compiling quinn v0.11.9 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking aead v0.6.1\n    Checking brotli-decompressor v2.5.1\n    Checking lru v0.18.5\n    Checking tokio-stream v0.1.19\n   Compiling indexmap v1.9.3\n    Checking lock_api v0.5.0\n    Checking rand_pcg v0.10.2\n    Checking parking_lot_core v0.10.0\n    Checking static_assertions v1.1.0\n   Compiling crossbeam-epoch v0.9.21\n    Checking aliasable v0.1.3\n    Checking arrayref v0.3.9\n    Checking dtoa v1.0.11\n    Checking no_debug v3.1.0\n   Compiling erased-serde v0.4.11\n    Checking lru-slab v0.1.3\n    Checking rustc-hash v2.1.3\n   Compiling prometheus v0.14.0\n    Checking constant_time_eq v0.4.2\n    Checking unsafe-libyaml v0.2.11\n    Checking serde_yaml v0.9.34+deprecated\n    Checking quinn-proto v0.11.16 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking pingora-rustls v0.9.1\n    Checking prometheus-client v0.18.1\n    Checking ouroboros v0.18.5\n    Checking parking_lot v0.13.0\n    Checking brotli v3.5.0\n    Checking tokio-test v0.4.6\n    Checking pingora-pool v0.9.1\n    Checking clap v4.6.7\n    Checking async-channel v2.5.0\n    Checking x509-parser v0.16.0\n   Compiling serde_with_macros v3.24.0\n    Checking sfv v0.10.4\n    Checking strum v0.26.3\n   Compiling prost-derive v0.14.5\n    Checking idna v1.1.0\n    Checking rand v0.9.5\n   Compiling darling v0.23.0\n    Checking daggy v0.8.1\n    Checking der-parser v10.0.0\n    Checking polyval v0.7.3\n    Checking pingora-runtime v0.9.1\n    Checking poly1305 v0.9.1\n    Checking bstr v1.13.1\n   Compiling derivative v2.2.0\n    Checking ctr v0.10.1\n    Checking http-body v1.1.0\n    Checking rmp v0.8.15\n    Checking chrono v0.4.45\n   Compiling uncased v0.9.10\n    Checking daemonix v0.1.0\n    Checking hashbrown v0.12.3\n    Checking unicase v2.10.0\n    Checking compression-core v0.4.34\n    Checking openssl-probe v0.1.6\n   Compiling foundations v5.12.0\n    Checking pingora-core v0.9.1\n    Checking compression-codecs v0.4.47\n    Checking rmp-serde v1.3.1\n    Checking chacha20poly1305 v0.11.0\n    Checking x509-parser v0.18.1\n    Checking ghash v0.6.0\n   Compiling foundations-macros v5.12.0\n    Checking x25519-dalek v2.0.1\n    Checking prost v0.14.5\n    Checking serde_with v3.24.0\n    Checking pingora-lru v0.9.1\n    Checking prometools v0.2.3\n    Checking pingora-header-serde v0.9.1\n    Checking h3 v0.0.8 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking form_urlencoded v1.2.2\n    Checking xray-routing v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking blake2 v0.10.6\n    Checking sha3 v0.11.0\n    Checking md-5 v0.11.0\n    Checking sha2 v0.11.1\n    Checking hmac v0.13.0\n    Checking signature v3.0.0\n    Checking module-lattice v0.2.4\n   Compiling figment v0.10.19\n    Checking uuid v1.29.0\n    Checking cpufeatures v0.2.17\n    Checking try-lock v0.2.5\n    Checking hex v0.4.3\n   Compiling rustix v1.1.6\n    Checking pingora-cache v0.9.1\n    Checking want v0.3.2\n    Checking xray-proxy v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking sha1 v0.10.7\n    Checking ml-dsa v0.1.2\n    Checking hkdf v0.13.0\n    Checking h3-quinn v0.0.10 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking url v2.5.8\n    Checking crossbeam v0.8.5\n    Checking aes-gcm v0.11.1\n    Checking async-compression v0.4.42\n    Checking pem v4.0.0\n   Compiling enum-as-inner v0.6.1\n    Checking yasna v0.6.0\n    Checking webpki-roots v1.0.12\n    Checking sha1 v0.11.0\n    Checking blake2 v0.11.0\n    Checking xray-utls v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking ipnet v2.12.2\n    Checking xray-transport v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking hickory-proto v0.25.2\n    Checking rcgen v0.14.10\n    Checking buffer-pool v0.2.1\n    Checking tungstenite v0.29.0\n    Checking hyper v1.12.0\n    Checking pingora-proxy v0.9.1\n    Checking xray-vless-encryption v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking http-body-util v0.1.5\n    Checking pem v3.0.6\n    Checking backon v1.6.0\n    Checking pingora-limits v0.9.1\n    Checking tempfile v3.27.0\n    Checking hyper-util v0.1.21\n    Checking tokio-tungstenite v0.29.0\n    Checking steam-proxy v0.1.0 (__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-6-planner)\nwarning: unused imports: `DiagnosticRecorder`, `Kind`, and `ObservationContext`\n --> src/inspection_tests.rs:2:13\n  |\n2 | use crate::{DiagnosticRecorder, Kind, ObservationContext};\n  |             ^^^^^^^^^^^^^^^^^^  ^^^^  ^^^^^^^^^^^^^^^^^^\n  |\n  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default\n\nwarning: unused import: `bytes::Bytes`\n --> src/inspection_tests.rs:3:5\n  |\n3 | use bytes::Bytes;\n  |     ^^^^^^^^^^^^\n\nwarning: unused import: `sync::Arc`\n --> src/inspection_tests.rs:4:34\n  |\n4 | use std::{collections::BTreeMap, sync::Arc};\n  |                                  ^^^^^^^^^\n\nwarning: method `matches` is never used\n   --> src/inspection.rs:135:19\n    |\n134 | impl ClientIpRule {\n    | ----------------- method in this implementation\n135 |     pub(crate) fn matches(&self, host: &str, path: &str) -> bool {\n    |                   ^^^^^^^\n    |\n    = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: method `child` is never used\n  --> src/managed_stream.rs:38:12\n   |\n36 | impl Connections {\n   | ---------------- method in this implementation\n37 |     #[cfg(feature = \"reverse-proxy\")]\n38 |     pub fn child(self: &Arc<Self>) -> crate::Result<Arc<Self>> {\n   |            ^^^^^\n\nwarning: fields `cipher` and `password` are never read\n  --> src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- fields in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n17 |     pub(crate) password: Zeroizing<String>,\n   |                ^^^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: field `path` is never read\n  --> src/tunnel_url.rs:25:16\n   |\n21 | pub struct WebSocketUrl {\n   |            ------------ field in this struct\n...\n25 |     pub(crate) path: String,\n   |                ^^^^\n   |\n   = note: `WebSocketUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: `steam-proxy` (lib) generated 4 warnings\nwarning: variants `CacheSlow`, `CacheSized`, `CacheVary`, and `CacheRange` are never constructed\n   --> src/http_proxy_tests.rs:157:5\n    |\n155 | enum ResponseMode {\n    |      ------------ variants in this enum\n156 |     RoutesTimeout,\n157 |     CacheSlow,\n    |     ^^^^^^^^^\n...\n165 |     CacheSized,\n    |     ^^^^^^^^^^\n...\n169 |     CacheVary,\n    |     ^^^^^^^^^\n170 |     CacheRange,\n    |     ^^^^^^^^^^\n    |\n    = note: `ResponseMode` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n    = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: method `matches` is never used\n   --> src/inspection.rs:135:19\n    |\n134 | impl ClientIpRule {\n    | ----------------- method in this implementation\n135 |     pub(crate) fn matches(&self, host: &str, path: &str) -> bool {\n    |                   ^^^^^^^\n\nwarning: field `cipher` is never read\n  --> src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- field in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: `steam-proxy` (lib test) generated 7 warnings (1 duplicate) (run `cargo fix --lib -p steam-proxy --tests` to apply 3 suggestions)\n    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 28s\n"
                }
              ]
            },
            {
              "type": "details",
              "summary": "最终提交对 dev 的真实 diff",
              "blocks": [
                {
                  "type": "code",
                  "lang": "diff",
                  "text": "diff --git a/src/routing/filter.rs b/src/routing/filter.rs\nindex 587a608..74f13fe 100644\n--- a/src/routing/filter.rs\n+++ b/src/routing/filter.rs\n@@ -1,7 +1,37 @@\n-use super::{classify::Traffic, config::Route};\n+use super::{Attempt, classify::Traffic, config::Route};\n use crate::health::{Eligibility, Health};\n use std::time::Duration;\n use tokio::time::Instant;\n+\n+pub(crate) trait CandidateFilter {\n+    fn allows(\n+        &self,\n+        index: usize,\n+        route: &Route,\n+        state: &Health,\n+        traffic: &Traffic<'_>,\n+        attempt: &Attempt,\n+        now: Instant,\n+    ) -> bool;\n+}\n+\n+#[derive(Default)]\n+pub(crate) struct DefaultFilter;\n+\n+impl CandidateFilter for DefaultFilter {\n+    fn allows(\n+        &self,\n+        index: usize,\n+        route: &Route,\n+        state: &Health,\n+        traffic: &Traffic<'_>,\n+        attempt: &Attempt,\n+        now: Instant,\n+    ) -> bool {\n+        !attempt.tried.contains(&index) && allows(route, state, traffic, now)\n+    }\n+}\n+\n pub(crate) fn allows(route: &Route, state: &Health, traffic: &Traffic<'_>, now: Instant) -> bool {\n     route.payload == traffic.payload\n         && (!traffic.download || route.downloads)\ndiff --git a/src/routing/select.rs b/src/routing/select.rs\nindex 2e2749b..2129064 100644\n--- a/src/routing/select.rs\n+++ b/src/routing/select.rs\n@@ -1,6 +1,7 @@\n use super::{\n     Attempt, Traffic,\n     config::{Route, Tier},\n+    filter::{CandidateFilter, DefaultFilter},\n };\n use crate::{Error, Result, backend::Backend, health::Health, outbound::Registry};\n use std::{\n@@ -14,7 +15,8 @@ pub(crate) fn select(\n     traffic: &Traffic<'_>,\n     attempt: &mut Attempt,\n ) -> Result<(usize, Arc<Backend>)> {\n-    let index = Planner.select(\n+    let planner: Planner = Planner::default();\n+    let index = planner.select(\n         traffic,\n         &registry.routes,\n         &registry.health.read(),\n@@ -25,9 +27,63 @@ pub(crate) fn select(\n     Ok((index, registry.get(index)))\n }\n \n-pub(crate) struct Planner;\n+pub(crate) trait NodeSelector {\n+    fn select(\n+        &self,\n+        traffic: &Traffic<'_>,\n+        candidates: &[(usize, &Route)],\n+        health: &[Health],\n+        session: u64,\n+    ) -> Option<usize>;\n+}\n+\n+#[derive(Default)]\n+pub(crate) struct DefaultNodeSelector;\n \n-impl Planner {\n+impl NodeSelector for DefaultNodeSelector {\n+    fn select(\n+        &self,\n+        traffic: &Traffic<'_>,\n+        candidates: &[(usize, &Route)],\n+        health: &[Health],\n+        session: u64,\n+    ) -> Option<usize> {\n+        let failures = candidates\n+            .iter()\n+            .map(|(index, _)| health[*index].failures)\n+            .min()?;\n+        let candidates: Vec<_> = candidates\n+            .iter()\n+            .filter(|(index, _)| health[*index].failures == failures)\n+            .collect();\n+        let fastest = candidates\n+            .iter()\n+            .filter_map(|(index, _)| health[*index].dial_elapsed)\n+            .min();\n+        let candidates: Vec<_> = candidates\n+            .into_iter()\n+            .filter(|(index, _)| {\n+                fastest.is_none_or(|fastest| {\n+                    health[*index]\n+                        .dial_elapsed\n+                        .is_some_and(|elapsed| elapsed <= fastest.mul_f64(1.2))\n+                })\n+            })\n+            .collect();\n+        let mut hash = std::collections::hash_map::DefaultHasher::new();\n+        traffic.host.hash(&mut hash);\n+        session.hash(&mut hash);\n+        Some(candidates[hash.finish() as usize % candidates.len()].0)\n+    }\n+}\n+\n+#[derive(Default)]\n+pub(crate) struct Planner<F = DefaultFilter, N = DefaultNodeSelector> {\n+    pub filter: F,\n+    pub nodes: N,\n+}\n+\n+impl<F: CandidateFilter, N: NodeSelector> Planner<F, N> {\n     pub fn select(\n         &self,\n         traffic: &Traffic<'_>,\n@@ -45,41 +101,20 @@ impl Planner {\n                 .iter()\n                 .enumerate()\n                 .filter(|(index, route)| {\n-                    let state = &health[*index];\n                     route.tier == tier\n-                        && !attempt.tried.contains(index)\n-                        && super::filter::allows(route, state, traffic, now)\n+                        && self\n+                            .filter\n+                            .allows(*index, route, &health[*index], traffic, attempt, now)\n                 })\n                 .collect();\n-            let Some(failures) = candidates\n-                .iter()\n-                .map(|(index, _)| health[*index].failures)\n-                .min()\n-            else {\n+            if candidates.is_empty() {\n                 continue;\n-            };\n-            let candidates: Vec<_> = candidates\n-                .into_iter()\n-                .filter(|(index, _)| health[*index].failures == failures)\n-                .collect();\n-            let fastest = candidates\n-                .iter()\n-                .filter_map(|(index, _)| health[*index].dial_elapsed)\n-                .min();\n-            let candidates: Vec<_> = candidates\n-                .into_iter()\n-                .filter(|(index, _)| {\n-                    fastest.is_none_or(|fastest| {\n-                        health[*index]\n-                            .dial_elapsed\n-                            .is_some_and(|elapsed| elapsed <= fastest.mul_f64(1.2))\n-                    })\n-                })\n-                .collect();\n-            let mut hash = std::collections::hash_map::DefaultHasher::new();\n-            traffic.host.hash(&mut hash);\n-            session.hash(&mut hash);\n-            return Ok(candidates[hash.finish() as usize % candidates.len()].0);\n+            }\n+            return self\n+                .nodes\n+                .select(traffic, &candidates, health, session)\n+                .filter(|selected| candidates.iter().any(|(index, _)| index == selected))\n+                .ok_or(Error::NoEndpoint);\n         }\n         Err(Error::NoEndpoint)\n     }\ndiff --git a/src/routing/tests.rs b/src/routing/tests.rs\nindex 0607d00..c2716e6 100644\n--- a/src/routing/tests.rs\n+++ b/src/routing/tests.rs\n@@ -1,4 +1,10 @@\n-use super::{attempt::Executor, config::Tier, select::Planner, *};\n+use super::{\n+    attempt::Executor,\n+    config::Tier,\n+    filter::{CandidateFilter, DefaultFilter},\n+    select::{NodeSelector, Planner},\n+    *,\n+};\n use crate::{\n     Config, Error, Payload, Result,\n     backend::Backend,\n@@ -12,6 +18,10 @@ use std::{collections::BTreeSet, sync::Arc, time::Duration};\n use tokio::time::Instant;\n use tokio_util::sync::CancellationToken;\n \n+fn planner() -> Planner {\n+    Planner::default()\n+}\n+\n async fn routes() -> (Vec<Route>, Vec<Health>) {\n     let config = Config::new(\n         \"planner\",\n@@ -68,12 +78,12 @@ async fn fixed_tiers_exhaust_same_tier_and_hash_is_stable() {\n         download: false,\n     };\n     let mut attempt = Attempt::new(Duration::from_secs(3));\n-    let first = Planner\n+    let first = planner()\n         .select(&traffic, &routes, &health, &attempt, 9)\n         .unwrap();\n     let distributed: BTreeSet<_> = (0..128)\n         .map(|session| {\n-            Planner\n+            planner()\n                 .select(&traffic, &routes, &health, &attempt, session)\n                 .unwrap()\n         })\n@@ -82,19 +92,19 @@ async fn fixed_tiers_exhaust_same_tier_and_hash_is_stable() {\n     assert!(first < 2);\n     assert_eq!(\n         first,\n-        Planner\n+        planner()\n             .select(&traffic, &routes, &health, &attempt, 9)\n             .unwrap()\n     );\n     attempt.tried.insert(first);\n-    let second = Planner\n+    let second = planner()\n         .select(&traffic, &routes, &health, &attempt, 9)\n         .unwrap();\n     assert!(second < 2 && second != first);\n     attempt.tried.insert(second);\n     for expected in [2, 3, 4] {\n         assert_eq!(\n-            Planner\n+            planner()\n                 .select(&traffic, &routes, &health, &attempt, 9)\n                 .unwrap(),\n             expected\n@@ -102,7 +112,7 @@ async fn fixed_tiers_exhaust_same_tier_and_hash_is_stable() {\n         attempt.tried.insert(expected);\n     }\n     assert!(\n-        Planner\n+        planner()\n             .select(&traffic, &routes, &health, &attempt, 9)\n             .is_err()\n     );\n@@ -119,14 +129,14 @@ async fn failure_count_then_twenty_percent_window_then_capability_filter() {\n     let attempt = Attempt::new(Duration::from_secs(3));\n     health[1].dial_elapsed = Some(Duration::from_millis(80));\n     assert_eq!(\n-        Planner\n+        planner()\n             .select(&traffic, &routes, &health, &attempt, 9)\n             .unwrap(),\n         0\n     );\n     health[0].failures = 1;\n     assert_eq!(\n-        Planner\n+        planner()\n             .select(&traffic, &routes, &health, &attempt, 9)\n             .unwrap(),\n         1\n@@ -138,13 +148,263 @@ async fn failure_count_then_twenty_percent_window_then_capability_filter() {\n         ..traffic\n     };\n     assert_eq!(\n-        Planner\n+        planner()\n             .select(&traffic, &routes, &health, &attempt, 9)\n             .unwrap(),\n         2\n     );\n }\n \n+struct AllowedNodes<'a>(&'a [usize]);\n+\n+impl CandidateFilter for AllowedNodes<'_> {\n+    fn allows(\n+        &self,\n+        index: usize,\n+        route: &Route,\n+        state: &Health,\n+        traffic: &Traffic<'_>,\n+        attempt: &Attempt,\n+        now: Instant,\n+    ) -> bool {\n+        self.0.contains(&index) && DefaultFilter.allows(index, route, state, traffic, attempt, now)\n+    }\n+}\n+\n+#[derive(Default)]\n+struct LastNode {\n+    seen: std::cell::RefCell<Vec<Vec<usize>>>,\n+}\n+\n+impl NodeSelector for LastNode {\n+    fn select(\n+        &self,\n+        _: &Traffic<'_>,\n+        candidates: &[(usize, &Route)],\n+        _: &[Health],\n+        _: u64,\n+    ) -> Option<usize> {\n+        assert!(\n+            candidates\n+                .iter()\n+                .all(|(_, route)| route.tier == candidates[0].1.tier)\n+        );\n+        self.seen\n+            .borrow_mut()\n+            .push(candidates.iter().map(|(index, _)| *index).collect());\n+        candidates.last().map(|(index, _)| *index)\n+    }\n+}\n+\n+struct SpecifiedNode(Option<usize>);\n+\n+impl NodeSelector for SpecifiedNode {\n+    fn select(\n+        &self,\n+        _: &Traffic<'_>,\n+        _: &[(usize, &Route)],\n+        _: &[Health],\n+        _: u64,\n+    ) -> Option<usize> {\n+        self.0\n+    }\n+}\n+\n+#[tokio::test]\n+async fn injected_filter_and_selector_borrow_candidates_with_fixed_tier_order() {\n+    let (routes, health) = routes().await;\n+    let traffic = Traffic {\n+        host: \"store.steampowered.com\",\n+        payload: Payload::Tcp,\n+        download: false,\n+    };\n+    let mut attempt = Attempt::new(Duration::from_secs(3));\n+    let planner = Planner {\n+        filter: AllowedNodes(&[0, 1, 2, 3, 4]),\n+        nodes: LastNode::default(),\n+    };\n+    for expected in [1, 0, 2, 3, 4] {\n+        assert_eq!(\n+            planner\n+                .select(&traffic, &routes, &health, &attempt, 9)\n+                .unwrap(),\n+            expected\n+        );\n+        assert!(!attempt.tried.contains(&expected));\n+        attempt.tried.insert(expected);\n+    }\n+    assert!(\n+        planner\n+            .select(&traffic, &routes, &health, &attempt, 9)\n+            .is_err()\n+    );\n+    assert_eq!(\n+        *planner.nodes.seen.borrow(),\n+        [vec![0, 1], vec![0], vec![2], vec![3], vec![4]]\n+    );\n+    let planner = Planner {\n+        filter: AllowedNodes(&[1, 2, 4]),\n+        nodes: LastNode::default(),\n+    };\n+    let mut attempt = Attempt::new(Duration::from_secs(3));\n+    for expected in [1, 2, 4] {\n+        assert_eq!(\n+            planner\n+                .select(&traffic, &routes, &health, &attempt, 9)\n+                .unwrap(),\n+            expected\n+        );\n+        attempt.tried.insert(expected);\n+    }\n+    assert_eq!(*planner.nodes.seen.borrow(), [vec![1], vec![2], vec![4]]);\n+}\n+\n+#[tokio::test]\n+async fn selector_cannot_return_filtered_tried_other_tier_or_unknown_indices_or_skip_a_tier() {\n+    let (routes, health) = routes().await;\n+    let traffic = Traffic {\n+        host: \"store.steampowered.com\",\n+        payload: Payload::Tcp,\n+        download: false,\n+    };\n+    let mut attempt = Attempt::new(Duration::from_secs(3));\n+    attempt.tried.insert(0);\n+    for selected in [None, Some(0), Some(2), Some(3), Some(4), Some(usize::MAX)] {\n+        let planner = Planner {\n+            filter: DefaultFilter,\n+            nodes: SpecifiedNode(selected),\n+        };\n+        assert!(matches!(\n+            planner.select(&traffic, &routes, &health, &attempt, 9),\n+            Err(Error::NoEndpoint)\n+        ));\n+    }\n+    let planner = Planner {\n+        filter: AllowedNodes(&[1, 2]),\n+        nodes: SpecifiedNode(Some(0)),\n+    };\n+    assert!(matches!(\n+        planner.select(\n+            &traffic,\n+            &routes,\n+            &health,\n+            &Attempt::new(Duration::from_secs(3)),\n+            9\n+        ),\n+        Err(Error::NoEndpoint)\n+    ));\n+}\n+\n+#[tokio::test(start_paused = true)]\n+async fn default_filter_preserves_health_capability_cooldown_expiry_and_attempt_boundaries() {\n+    let (mut routes, mut health) = routes().await;\n+    let traffic = Traffic {\n+        host: \"store.steampowered.com\",\n+        payload: Payload::Tcp,\n+        download: false,\n+    };\n+    let mut attempt = Attempt::new(Duration::from_secs(120));\n+    let now = Instant::now();\n+    let allowed = |route: &Route, state: &Health, attempt: &Attempt| {\n+        DefaultFilter.allows(0, route, state, &traffic, attempt, Instant::now())\n+    };\n+    assert!(allowed(&routes[0], &health[0], &attempt));\n+    health[0].eligibility = Eligibility::Unavailable;\n+    assert!(!allowed(&routes[0], &health[0], &attempt));\n+    health[0].eligibility = Eligibility::Available;\n+    health[0].isolated = true;\n+    assert!(!allowed(&routes[0], &health[0], &attempt));\n+    health[0].isolated = false;\n+    health[0]\n+        .targets\n+        .insert(traffic.host.into(), now + Duration::from_secs(15));\n+    assert!(!allowed(&routes[0], &health[0], &attempt));\n+    tokio::time::advance(Duration::from_secs(15)).await;\n+    assert!(allowed(&routes[0], &health[0], &attempt));\n+    routes[0].payload = Payload::Http;\n+    assert!(!allowed(&routes[0], &health[0], &attempt));\n+    routes[0].payload = Payload::Tcp;\n+    routes[0].downloads = false;\n+    assert!(!DefaultFilter.allows(\n+        0,\n+        &routes[0],\n+        &health[0],\n+        &Traffic {\n+            download: true,\n+            ..traffic\n+        },\n+        &attempt,\n+        Instant::now(),\n+    ));\n+    attempt.tried.insert(0);\n+    assert!(!allowed(&routes[0], &health[0], &attempt));\n+    attempt.tried.clear();\n+    tokio::time::advance(Duration::from_secs(45)).await;\n+    assert!(!allowed(&routes[0], &health[0], &attempt));\n+    routes[0].endpoint = None;\n+    assert!(allowed(&routes[0], &health[0], &attempt));\n+    let planner = Planner {\n+        filter: AllowedNodes(&[0]),\n+        nodes: LastNode::default(),\n+    };\n+    attempt.committed = true;\n+    assert!(\n+        planner\n+            .select(&traffic, &routes, &health, &attempt, 9)\n+            .is_err()\n+    );\n+    attempt.committed = false;\n+    tokio::time::advance(Duration::from_secs(60)).await;\n+    assert!(\n+        planner\n+            .select(&traffic, &routes, &health, &attempt, 9)\n+            .is_err()\n+    );\n+    assert!(planner.nodes.seen.borrow().is_empty());\n+}\n+\n+#[tokio::test]\n+async fn default_selector_keeps_inclusive_latency_window_and_unmeasured_fallback() {\n+    let (routes, mut health) = routes().await;\n+    let traffic = Traffic {\n+        host: \"store.steampowered.com\",\n+        payload: Payload::Tcp,\n+        download: false,\n+    };\n+    let mut attempt = Attempt::new(Duration::from_secs(3));\n+    health[1].dial_elapsed = Some(Duration::from_millis(48));\n+    let distributed: BTreeSet<_> = (0..128)\n+        .map(|session| {\n+            planner()\n+                .select(&traffic, &routes, &health, &attempt, session)\n+                .unwrap()\n+        })\n+        .collect();\n+    assert_eq!(distributed, BTreeSet::from([0, 1]));\n+    health[1].dial_elapsed = None;\n+    assert_eq!(\n+        planner()\n+            .select(&traffic, &routes, &health, &attempt, 9)\n+            .unwrap(),\n+        0\n+    );\n+    attempt.tried.insert(0);\n+    assert_eq!(\n+        planner()\n+            .select(&traffic, &routes, &health, &attempt, 9)\n+            .unwrap(),\n+        1\n+    );\n+    health[0].dial_elapsed = None;\n+    attempt.tried.clear();\n+    assert!(\n+        planner()\n+            .select(&traffic, &routes, &health, &attempt, 9)\n+            .unwrap()\n+            < 2\n+    );\n+}\n+\n #[tokio::test(start_paused = true)]\n async fn delayed_probe_publication_preserves_completion_time_and_ignores_older_evidence() {\n     let mut state = Health::new(1);\n@@ -195,7 +455,7 @@ async fn health_ewma_recovery_backoff_expiry_and_generation() {\n     let (routes, mut health) = routes().await;\n     tokio::time::advance(Duration::from_secs(61)).await;\n     assert!(\n-        Planner\n+        planner()\n             .select(\n                 &Traffic {\n                     host: \"target\",\n@@ -213,7 +473,7 @@ async fn health_ewma_recovery_backoff_expiry_and_generation() {\n     let mut attempt = Attempt::new(Duration::from_secs(1));\n     attempt.committed = true;\n     assert!(\n-        Planner\n+        planner()\n             .select(\n                 &Traffic {\n                     host: \"target\",\n"
                }
              ]
            },
            {
              "type": "heading",
              "text": "本轮交付事实",
              "level": 2
            },
            {
              "type": "text",
              "md": "- 最终候选：bfe9fcbf5b89e0ed59d938cae8465d5852898f83。基线以上仅修改 src/routing/filter.rs、select.rs、tests.rs；公开配置、Go、绑定与 wire 未改。\n- §4/5/10 和 §12 场景 21 的 Planner 组合缺口从 C 更新为 A（仅源码组合及静态证据）；行为运行仍为 B，未宣称运行验收通过。\n- CandidateFilter::allows 借用 Route / 单条 Health / Traffic / Attempt，并接收编号及统一 now；DefaultFilter 委托原资格 helper，再排除本次 tried。执行前 Registry::usable 的原 helper 逐字保留。\n- NodeSelector::select 读取本层候选引用与 Health；DefaultNodeSelector 保持最少 failures、最快 20% 窗口和 host+session 哈希。Planner<F,N> 实际持有并调用两策略。\n- Planner 固定 A→B→C→D。只有空候选层才继续；非空层的选择器拒绝选择或返回不在该层过滤结果中的编号时返回 NoEndpoint，不能借此跳层。\n- 默认 routing::select 组装 Planner，依旧由调用侧更新 tried、取得 backend。Native 的 Backend::connect_observed → AttemptLoop 和 HTTP::upstream_peer 都继续调用该默认入口；短锁、执行前复查、统一 deadline 和 committed 不变。\n- 增加四项测试源码：injected_filter_and_selector_borrow_candidates_with_fixed_tier_order、selector_cannot_return_filtered_tried_other_tier_or_unknown_indices_or_skip_a_tier、default_filter_preserves_health_capability_cooldown_expiry_and_attempt_boundaries、default_selector_keeps_inclusive_latency_window_and_unmeasured_fallback。基线已有 routing 测试断言保留，只替换默认 Planner 构造。\n- 静态证据所属候选：cargo check --offline --locked --tests 成功退出，默认 features，耗时 1m28s（仅编译测试，不执行）；cargo fmt --all -- --check 和 git diff --check 成功；源码核对脚本对同一结构契约在基线报缺失、候选通过。\n- cargo check 的警告位于未修改的 inspection_tests / inspection / managed_stream / tunnel_url / http_proxy_tests；没有本轮 routing 文件警告。不顺手修其他模块。\n- 指定 codex / auto/gpt-6-astra / medium 唯一正式评审核对 bfe9fcb，对本次范围没有 blocker/major/minor；round 1 of 1 已登记在该提交。评审仍不是运行验收。\n- PR 信息列在 proof 中。其他实现缺口按前文保留，不因本轮 Planner 完成而销项。"
            },
            {
              "type": "heading",
              "text": "正式评审",
              "level": 2
            },
            {
              "type": "text",
              "md": "正式独立评审：codex / auto/gpt-6-astra / medium，read-only，sps-6-review（SPS-6 的唯一一轮）。\n\nReviewer 最后报告：\n\nNo findings—no blocker, major, or minor issues identified within the SPS-6 Planner scope.\n\nReviewed exact SHA bfe9fcbf5b89e0ed59d938cae8465d5852898f83 against base eeb40b49005ffe0872f07d4dd8d254764a03f105. The actual git diff dev...HEAD matches /private/tmp/sps6-review.diff byte-for-byte.\n\nStatic review confirmed:\n\n- Planner<F, N> actually calls both strategy traits, borrows the existing inputs, and returns only a route index.\n- A→B→C→D traversal remains fixed. The selector receives immutable candidates from one tier; its returned ID must belong to that filtered set. An invalid ID or None cannot skip a nonempty tier.\n- Default filtering and selection preserve eligibility, capability/download restrictions, isolation, evidence expiry, target cooldown, tried-node exclusion, minimum failures, the inclusive 20% latency window, and host/session hashing.\n- Native HTTP and byte-stream paths reach the default wrapper. Health locks remain short-lived; outlet lookup stays outside Planner; execution-time eligibility rechecks, shared deadlines, and commit boundaries remain intact.\n- Public signatures, configuration, bindings, and wire formats are unchanged.\n\ncargo fmt --all -- --check and git diff --check dev...HEAD both exited 0. Git emitted sandbox cache-write diagnostics but completed the diff check. The supplied worker compilation log records a successful check; I did not rerun compilation.\n\nNo runtime tests, regressions, feature/race/cross-language/device runs, network requests, or dependency downloads were performed. This review and the compilation log are not runtime acceptance evidence. Other design gaps remain outside this review as recorded in the ledger.\n\n登记结果：herdr-task reviewed 已把 round 1 of 1 记录在 bfe9fcb。未修改候选提交；没有待修 finding。reviewer 已结束。"
            },
            {
              "type": "heading",
              "text": "PR",
              "level": 2
            },
            {
              "type": "text",
              "md": "PR #6: https://github.com/gamesir123/steam-proxy-sdk/pull/6\n\n真实 gh pr view 结果：\n{\"baseRefName\":\"dev\",\"headRefName\":\"task/6-planner\",\"headRefOid\":\"bfe9fcbf5b89e0ed59d938cae8465d5852898f83\",\"mergeStateStatus\":\"CLEAN\",\"number\":6,\"state\":\"OPEN\",\"statusCheckRollup\":[]}\n\n只推送任务分支；未合并、未 Accept / Done、未推送 main、未打 tag、未部署。GitHub 当前没有检查结果，不能据此声称 CI 或运行矩阵通过。"
            }
          ]
        },
        {
          "label": "章节台账",
          "blocks": [
            {
              "type": "text",
              "md": "原笔记已完整读取，与设计快照一致。源码/原测试基线 eeb40b4；新增 Planner 证据归属候选 bfe9fcb。"
            },
            {
              "type": "text",
              "md": "- A：实现已有且有对应证据。仅用于明确标注的结构/源码事实或本轮静态检查，绝不表示业务运行验收。\n- B：有实现但运行未验收。列出的测试名称仅是测试源码，存在于基线 eeb40b4；没有本轮最终 SHA 的运行结果。\n- C：明确实现缺口。源码已确认缺少设计所需组合/行为；本轮除 Planner 外不修改。\n- D：尚待核实。未找到完整对应测试或无法由已读源码证明端到端要求。\n- 本轮不运行任何 Rust/Go 测试、回归、race、feature 矩阵、跨语言/设备/Steam/真实节点请求。静态编译和独立评审不能替代运行验收。旧 SHA 的历史矩阵不计入最终代码的通过证据。\n- 第一步台账在修改前建立。Planner 基线为 C；交付时以最终提交及静态证据追加更新，不覆盖基线事实。"
            },
            {
              "type": "details",
              "summary": "§1 原有接口、注入与宿主边界",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust src/lifecycle.rs，src/network.rs；Go mode.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ntests/serve_connection.rs；policy_lifecycle.rs"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；宿主系统接管与设备行为未验收"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§2 能力与固定层级、下载排除",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust routing/config.rs、filter.rs、select.rs；Go routing.go::usable/selectRoute"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nrouting/tests.rs::fixed_tiers_exhaust_same_tier_and_hash_is_stable、failure_count_then_twenty_percent_window_then_capability_filter；Go routing_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；Go usable 对所有 B 排除下载，Rust 只禁止 CloudflareWorker/EdgeOne，跨实现契约差异需后续核实"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§2/10 共享反代实际流程",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust http_proxy.rs::upstream_peer/upstream_request_filter，outbound/reverse.rs::http_route"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nsrc/http_proxy_tests.rs::pingora_h1_reuses_relay_and_preserves_headers_query_and_upload"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；共享 Pingora 栈存在，不等于泛型 backend 流程完整"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§2/10 ReverseBackend / ReverseProxy<B>",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust outbound/reverse.rs；routing/config.rs；http_proxy.rs"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\n基线源码：trait 仅 allows_download/target_headers，http_route 直接匹配 ModeConfig；header 行为仍由公共流程判断"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC，P1：泛型包装未承载接入身份、SNI、authority、目标头差异及反代流程；不以类型名认定完成"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§3 Routes、旧配置归一化、payload、CA/feature 校验",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust config.rs、routing/config.rs；Go routes_config.go、config.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ntests/routes.rs::dynamic_routes_round_trip_and_payload_policy；Go TestRoutesConfiguration"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；公共配置本轮不改"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§4/5 Planner 可组合且只借用数据返回编号",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust routing/filter.rs、select.rs"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\n基线单元 struct Planner；算法内联；只有 filter::allows，未有策略契约"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC，P1，本轮修复对象"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§4/5 健康所有权、短锁、执行前复查",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust outbound/registry.rs、routing/attempt.rs、http_proxy.rs::upstream_peer；Go routing.go::connectRoute"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nrouting/tests.rs；Go TestAttemptCandidatesShareDeadline"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；选择返回后锁释放，获取出口和 tried 更新在调用侧"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§4/10 执行与归因替换",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust routing/attempt.rs::Executor/AttemptLoop<E,O>/StreamExecutor，health/outcome.rs；HTTP 直接 Pingora callbacks"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nrouting/tests.rs::attempt_loop_shares_deadline_across_candidates_and_stops_after_commit"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC，P1：字节流 Executor 参数仍是 Arc<Backend>，HTTP 没有对应可替换小出口契约；已有复用流程不能代替 Executor<H>/Executor<S> 组合"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§6/6.1 独立 Probe、仅接入地址、dial 总耗时、关闭不写业务",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust probe/{mod,tcp,runner}.rs；native_plane.rs::check_routes；Go probe.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nsrc/probe/tests.rs::tcp_probe_only_opens_access_socket_and_closes_without_writing；Go TestTCPProbeOnlyDialsAccessAndImmediatelyCloses / TestTCPProbeDialElapsedExcludesClosingCost"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；TcpProbe 不导入 Route/Backend，计时包括 dial，非 RTT"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§6.1/6.2 并发、去重、单次与总预算、取消",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust probe/scheduler.rs，native_plane.rs::check_routes（3 / 3s / 15s）；Go probe.go、routing.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nsrc/probe/tests.rs::scheduler_summarizes_all_timeouts_and_bounds_concurrency_and_total_budget、cancel_drains_running_and_queued_probes；Go probe_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；Rust 分批串行维护，同批按 endpoint 去重，跨实例“全局”并发含义尚待核实"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§6.2 健康阈值、恢复、防抖、过期",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust health/state.rs、routing/filter.rs；Go routing.go::accessHealth.record/usable"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nrouting/tests.rs::health_ewma_recovery_backoff_expiry_and_generation；Go TestAccessHealthIsolationBackoffRecoveryAndEWMA"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；3 失败、2 成功、15..120s、60s 证据规则有实现"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§6.3 EWMA / 最少失败 / 20% / 稳定哈希 / 同层用尽",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust health/state.rs、routing/select.rs；Go routing.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nrouting/tests.rs 前两项；Go TestPlannerFixedTierAndSameTierFallback / TestPlannerFailurePreferenceLatencyAndCapabilities"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB（算法）；Rust 策略替换为 C，本轮修复；默认阈值不改"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§6.3 统计与诊断",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust health/state.rs::samples/cancellations、observation.rs；Go accessHealth 只保留失败/恢复/elapsed 等"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\n无完整近期成功率、首字节/吞吐/复用分类对应运行证据"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nD；Go 60s 成功/完成样本及取消单列未见对应存储，Rust samples 暴露与业务诊断链待核实"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§6.3/11 C 真实业务地址排序与历史",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust outbound/direct.rs::DirectOutbound<S>；Go routing.go::directKey/connectDirect"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ndirect.rs::direct_addresses_only_learn_from_business_and_history_is_per_generation；Go TestDirectBusinessIPRotationAndMapping"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；Rust S 为 TcpDialer，地址选择算法固定，未有独立可替换选择策略；是否要求另拆策略待核实"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§7 Start 先汇总全部资格、仅 C 可启动、无候选失败",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust native_plane.rs::prepare_routes/check_routes，lifecycle.rs；Go lifecycle.go、routing.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ntests/routes.rs::startup_collects_failed_and_good_candidates_and_rejects_all_failed、direct_only_start_never_connects_origin_and_close_stops_pending_calls、canceled_start_drains_probes_and_never_accepts_business_before_publication；Go startup_contract_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§8 分离接入、出口隔离、目标冷却、响应和取消",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust health/outcome.rs、state.rs、outbound/registry.rs、http_proxy.rs::AcquisitionTarget；Go routing.go::businessFailure、http.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nRust routing/tests.rs、http_proxy_tests.rs::acquisition_watchdog_counts_access_timeouts_once；Go routing_http_test.go / review_regression_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；隔离不由 TCP 探测清除，状态码不作接入失败"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§8 同实例高层恢复、已有连接保持",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust health/state.rs、routing/select.rs、relay.rs；Go probeLoop/selectRoute"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\n有健康恢复与固定层级测试源码，未见完整“恢复时新旧流并存”专用测试"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nD：组合实现存在，完整验收缺证据"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§8 网络变化",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust native_plane.rs:636 仅 prepare_routes 新建 generation；Health 拒绝旧 generation；DirectOutbound generation 不可变；Go routing.go:63 仅 prepareRoutes 递增；pool.go 按 generation 隔离"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ngeneration 测试只验证旧结果拒绝 / 新会话，不证明网络事件处理"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC，P1：实例内网络事件、取消旧探测、更新 generation、废弃旧测量/池和重新检查整条链缺失；src/network.rs 是 TUN 契约；restart 不能替代"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§9 restart 关闭再新建、失败契约和旧 clone",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust lifecycle.rs::restart；Go lifecycle.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ntests/policy_lifecycle.rs::restart_validates_first_and_keeps_old_handle_when_close_fails、restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure；Go lifecycle_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；同类型 Profile 保留，创建新 Inner"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§10 TunnelOutbound<T>",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust outbound/tunnel.rs::TunnelOutbound / Forward；Backend 调用具体对象；Go tunnel.go 与各实现"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\ntests/tunnel_ingress.rs；Go tunnel_*test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC，P1：具体 cfg 字段 / enum 复用协议存在，但未实现可替换 T 的组合契约；不是协议未实现"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§10 HTTP 经 C/D 的 TLS、authority、connector、池隔离",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust http_proxy.rs::upstream_peer/UpstreamConnector，outbound/registry.rs::SocketBridge；Go pool.go / routing.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nRust http_proxy_tests.rs::http_over_tunnel_negotiates_origin_tls_and_reuses_only_its_own_pool、caller_mapped_origins_preserve_http_and_isolate_verified_tls_pools；Go TestConnectionPoolIdentityIsolation / TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；Rust backend 指针、generation、authority、SNI、port、WS 参与 group_key，ALPN 在 WS 分组；全部维度及 close 必须 main 运行"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§11 deadline、tried、commit、不跨线重放",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust routing/attempt.rs、retry.rs、backend.rs::connect_until、http_proxy.rs callbacks；Go routing.go/http.go"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nrouting/tests.rs::attempt_loop_shares_deadline_across_candidates_and_stops_after_commit；Go TestHTTPPoolReuseAndNoReplayAfterCommit / TestHTTP2RefusedStreamAndGoAwayDoNotReplay"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；本次只保留现有边界"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§12 目录和依赖方向",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nRust routing/、outbound/、health/、probe/；native_plane.rs 组装"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\neeb40b4 git tree 与实际文件（本轮读取）"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nA（仅结构事实）；目录到位不证明组合完成"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§3/9/12 独立 Go 同契约",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nbindings/go/{routes_config,routing,probe,pool,lifecycle}.go，独立 go.mod"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nGo routing/lifecycle/probe/http 等 *_test.go，所属 eeb40b4"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB / D；独立实现，不受 Rust trait 重构自动修复；网络变化明确 C；下载能力差异及统计待核实"
                }
              ]
            },
            {
              "type": "details",
              "summary": "§3/9/12 C / TS / Swift / Kotlin 绑定",
              "blocks": [
                {
                  "type": "text",
                  "md": "**范围及源码**\n\nbindings/c/src/{protocol,native,actor}.rs；ts/lib/index.d.ts；swift/NativeEngine.swift；kotlin/NativeEngine.kt"
                },
                {
                  "type": "text",
                  "md": "**对应测试源码 / 证据**\n\nC native_tests.rs::restart_retains_owner_on_close_failure_and_reports_start_failure，TS lifecycle.test.cjs；Swift/Kotlin 设备证据未有"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB（源码入口已有）；wire 本轮不改，跨语言/设备仍未运行验收"
                }
              ]
            }
          ]
        },
        {
          "label": "全部验收场景",
          "blocks": [
            {
              "type": "text",
              "md": "设计第 12 节全部 23 项。每项可展开查看位置、测试源码与结论；没有最终 SHA 的运行通过记录。"
            },
            {
              "type": "details",
              "summary": "1 Relay 与 CDN 同配",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust routing/config.rs、http_proxy.rs；routing/tests.rs 固定层级；Go routing_http_test.go::TestHTTPBusinessFallbackTriesA2BeforeFasterB"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；共享栈已有，backend 组合缺口见上"
                }
              ]
            },
            {
              "type": "details",
              "summary": "2 A1 失败 A2 可用 B 更快",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust select.rs；fixed_tiers_exhaust_same_tier_and_hash_is_stable；Go 同名业务 fallback 测试"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "3 40/45/10ms 稳定分配",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust select.rs；fixed_tiers_exhaust_same_tier_and_hash_is_stable；Go TestPlannerFixedTierAndSameTierFallback"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "4 慢 DNS / 地址轮换计 dial 非 RTT",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust probe/tcp.rs；tcp_probe_only_opens_access_socket_and_closes_without_writing；Go TestTCPProbeDialElapsedExcludesClosingCost"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；慢 DNS 专用组合断言待 main 核实"
                }
              ]
            },
            {
              "type": "details",
              "summary": "5 单次失败偏好 / 连续阈值",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust health/state.rs、select.rs；failure_count_then_twenty_percent_window_then_capability_filter / health_ewma_recovery_backoff_expiry_and_generation；Go routing_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "6 A 不可用逐级 B C D",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust select.rs；fixed_tiers_exhaust_same_tier_and_hash_is_stable；Go TestPlannerFixedTierAndSameTierFallback"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "7 TCP 过滤 HTTP backend",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust config.rs、filter.rs；tests/routes.rs::edgeone_websocket_is_filtered_from_http_candidates_before_probing、routing/tests.rs 能力测试；Go TestRoutesConfiguration"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；Rust 规范化直接略过不兼容入口"
                }
              ]
            },
            {
              "type": "details",
              "summary": "8 Start 部分超时",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust prepare_routes / ProbeScheduler；src/probe/tests.rs::scheduler_summarizes_all_timeouts_and_bounds_concurrency_and_total_budget；Go TestStartupBudgetAndCancellationWaitForAllProbes"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "9 仅 C 启动无原站探测",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust native_plane.rs::check_routes；tests/routes.rs::direct_only_start_never_connects_origin_and_close_stops_pending_calls；Go TestDirectOnlyStartAndBackgroundNeverDialOrigin"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "10 全部无资格",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust prepare_routes / select.rs；tests/routes.rs::startup_collects_failed_and_good_candidates_and_rejects_all_failed；Go TestStartupRejectsAllInaccessibleLegacyRoutes"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "11 反代隧道只探接入",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust probe/tcp.rs / normalize；tests/tunnel_ingress.rs::each_tunnel_starts_without_ca_and_only_probes_the_node_before_handoff；Go TestTCPProbeOnlyDialsAccessAndImmediatelyCloses"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "12 拒绝调用的全部业务出口不妨碍探测",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust Probe 不引用 Backend，probe/tests.rs 仅注入内存 dialer；Go Probe 同样独立"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nD：结构独立存在，但未找到“全部替换为拒绝业务实现”的完整场景源码/运行证明"
                }
              ]
            },
            {
              "type": "details",
              "summary": "13 TCP 成功不清凭据/429且不追加",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust state.rs/outcome.rs；routing/tests.rs 健康隔离；tests/routes.rs::direct_http_preserves_mapped_identity_and_does_not_replay_business_response；Go TestTunnelCredentialsRemainIsolatedAfterTCPProbeSuccess / TestHTTP429IsBusinessResponseAndDoesNotReplay"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "14 冷却/C 地址/网络变化",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust filter.rs/direct.rs/native_plane.rs；Go routing.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC：冷却与业务地址学习有实现，实例内网络变化链缺失；不得整体判通过"
                }
              ]
            },
            {
              "type": "details",
              "summary": "15 高优先级恢复新旧流",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust health/state.rs/select.rs、relay.rs；Go routing.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nD：单独健康和层级测试存在，完整流共存场景待验收"
                }
              ]
            },
            {
              "type": "details",
              "summary": "16 用户 B1 restart",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust lifecycle.rs::restart；policy_lifecycle.rs restart 测试；Go TestRestartFreshSessionClosesOldConnections"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；具体 backend 用户选择端到端待 main"
                }
              ]
            },
            {
              "type": "details",
              "summary": "17 Closed 创建新 Mode",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust lifecycle.rs::restart/start；restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure；Go lifecycle_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "18 切换旧连接结束不重放、启动后恢复",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust lifecycle.rs/native_plane.rs/stream.rs；同上 clone 测试，Go TestRestartFreshSessionClosesOldConnections"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；宿主交接/长流设备场景未验收"
                }
              ]
            },
            {
              "type": "details",
              "summary": "19 新 start 失败/旧 close 未完",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust restart 先 close? 再替换；policy_lifecycle.rs 两个 restart 测试；Go TestRestartCloseFailureDoesNotStartReplacement / TestRestartNewStartFailureAndCancellation"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB"
                }
              ]
            },
            {
              "type": "details",
              "summary": "20 可能发送后不重放",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust http_proxy.rs::upstream_request_filter committed / error callbacks；http_proxy_tests.rs::business_websocket_rejection_is_not_replayed；Go TestHTTPPoolReuseAndNoReplayAfterCommit"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；所有 HTTP/TCP/WS 提交边界矩阵待 main"
                }
              ]
            },
            {
              "type": "details",
              "summary": "21 Planner 纯内存输入",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust routing/tests.rs 借用 routes/health/Attempt；基线未可注入策略"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nC → 本轮修复；运行留 main"
                }
              ]
            },
            {
              "type": "details",
              "summary": "22 配置及绑定原入口",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust config/lifecycle；bindings/c/ts/swift/kotlin；Go 独立入口"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；测试见前文，不把静态/源码当跨语言运行"
                }
              ]
            },
            {
              "type": "details",
              "summary": "23 取消/close 全部收敛",
              "blocks": [
                {
                  "type": "text",
                  "md": "**实现位置 / 对应测试源码**\n\nRust lifecycle/native_plane/probe/registry/tunnel；probe cancel_drains_running_and_queued_probes、tests/routes.rs canceled_start、registry.rs::dropping_bridge_connection_drains_half_open_upstream_before_sdk_close；Go review_regression_test.go / lifecycle_test.go"
                },
                {
                  "type": "text",
                  "md": "**当前结论**\n\nB；池、排队、backoff、长流全组合留 main"
                }
              ]
            }
          ]
        },
        {
          "label": "剩余工作",
          "blocks": [
            {
              "type": "text",
              "md": "- P1，明确：§8 Rust 和独立 Go 的实例内网络变化生命周期；旧探测、测量、直连记录和池必须一起失效后重新检查。\n- P1，明确：§2/10 ReverseBackend 身份差异和实际共享反代流程组合；现有两个布尔方法不足。\n- P1，明确：§4/10 HTTP 与字节流小出口能力 / Executor 的组合；字节流仅包装 Backend，HTTP 直接 callbacks。\n- P1，明确：§2/10 TunnelOutbound<T> 的协议能力替换边界；当前为具体结构和 enum。\n- P2，待核实：独立 Go 下载 backend 能力差异、60 秒探测统计；DirectOutbound 地址选择策略的可替换要求；完整“拒绝业务出口仍探测”及恢复流共存场景。\n- 本任务只补齐 Planner，不创建下一任务、不修改上述模块。"
            },
            {
              "type": "text",
              "md": "未创建或处理其他开发任务；后续任务由 Assistant 排队，开发保持串行。"
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "text": "Not proven",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "当前最终提交的所有行为测试，第 12 节完整矩阵、feature / race、跨语言与设备验收均未执行；遵守“dev 不回归，main 才回归”。",
        "没有真实 Steam、节点连通、吞吐、证书/凭据、网络切换或设备证明。",
        "静态检查、测试源码及 reviewer 阅读只证明其各自范围，不证明运行正确。",
        "已明确的其他实现缺口仍然存在；等待 main 运行不能替代这些实现工作。"
      ]
    }
  ]
};
