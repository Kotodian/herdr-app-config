# Komari in kansō

Native server monitoring alongside Magpie. Inherit kansō's semantic colors, font, ui.js controls, 4/8/12/16/24 px spacing and 6 px control corners. Compact, restrained, quiet, legible. The existing kansō panel is the reference.

Overview: online count, aggregate bandwidth, search and online filter, then flat node rows. CPU, RAM and disk use aligned labels, muted bars and right-aligned values. Color only adds warning meaning alongside explicit text. Detail: back navigation, metrics, recent CPU samples, traffic, ping, hardware and expiration. Keep content inside one scroll region at 440 px. Use native Buttons, labelled Input and accessible icon controls; no decorative animation.

Read public Komari metadata and RPC status only, never store administrator credentials. Intersect status with the public node catalog. An unsuccessful refresh preserves the previous sample and labels it stale; it must not count cached nodes as currently online. Refresh every ten seconds through one persistent collector, with independent detail-history fetches. The summary and open panel share a single snapshot.

Validation: native mod check and live overview/detail screenshots; check errors and original session IDs. No unrelated app, session or layout changes.
