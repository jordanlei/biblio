# Benchmarks

This file records local latency baselines for operations that should stay boringly fast as the
library grows: Drive-format serialization/parsing, BibTeX export, citation-context extraction, and a
metadata/notes/saved-reason search scan.

Run:

```sh
npm run bench:latency
```

The benchmark is deterministic and synthetic. It is not a substitute for browser profiling, but it is
a cheap regression tripwire for the core library path.

## 2026-10-07T14:40:02.506Z

Local deterministic benchmark on synthetic libraries. Times are milliseconds.

| Papers | Operation | Median | Min | Max |
| ---: | --- | ---: | ---: | ---: |
| 100 | serializeLibrary | 0.75 | 0.67 | 1.35 |
| 100 | parseLibrary | 0.37 | 0.35 | 0.80 |
| 100 | exportBibtex | 0.29 | 0.26 | 0.34 |
| 100 | local search scan | 0.11 | 0.09 | 0.25 |
| 100 | citation contexts | 0.08 | 0.07 | 0.21 |
| 1000 | serializeLibrary | 6.70 | 5.64 | 7.41 |
| 1000 | parseLibrary | 3.09 | 2.85 | 3.20 |
| 1000 | exportBibtex | 3.16 | 2.71 | 4.62 |
| 1000 | local search scan | 0.93 | 0.85 | 1.86 |
| 1000 | citation contexts | 0.58 | 0.54 | 0.69 |
| 5000 | serializeLibrary | 29.02 | 28.41 | 32.19 |
| 5000 | parseLibrary | 15.86 | 15.62 | 18.89 |
| 5000 | exportBibtex | 12.45 | 12.18 | 12.86 |
| 5000 | local search scan | 4.15 | 3.88 | 4.65 |
| 5000 | citation contexts | 2.74 | 2.59 | 3.63 |
