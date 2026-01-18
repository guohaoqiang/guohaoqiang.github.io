# LLM Inference Terminology

A reference guide for fundamental terms used in designing and analyzing LLM inference engines.

## Model Components

- **Prefill**: 
>>The phase where the model processes the entire input prompt in parallel. The model reads all prompt tokens at once and generates key-value (KV) caches, preparing for the decode phase. This phase is throughput-optimized.

- **Decode**: 
>>The phase where the model generates output tokens one at a time (autoregressive), using previously computed KV caches. Each decode step takes the previously generated token and predicts the next one. This phase is latency-sensitive.

## System Metrics

- **Time-To-First-Token ([TTFT](https://arxiv.org/pdf/2407.07000))**: 
>>The latency between request arrival and the generation of the first output token. It encompasses scheduling delay (time from arrival to prompt processing start) and prompt processing time (prefill phase). Critical for perceived responsiveness.

- **Time-Per-Output-Token ([TPOT](https://arxiv.org/pdf/2407.07000))**: 
>>The average time taken to generate each output token, calculated as Total Decode Time / Number of Tokens. Measures the throughput efficiency of the decode phase and impacts user experience for long-form generation.

- **Time Between Tokens ([TBT](https://arxiv.org/pdf/2407.07000))**: 
>>The exact time interval between consecutive output tokens. Used to analyze consistency and smoothness of text generation, identifying potential bottlenecks or variable latencies during decoding.

- **Inter-token Latency (ITL)**: 
>>The time between consecutive tokens, equivalent to TPOT. Referenced by [NVIDIA NIM](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html), [AWS Neuron](https://awsdocs-neuron.readthedocs-hosted.com/en/latest/libraries/nxd-inference/developer_guides/llm-inference-benchmarking-guide.html), and [vLLM](https://docs.vllm.ai/en/stable/design/metrics/#interval-calculations-vs-preemptions) benchmarking tools. 

- **Service Level Objective ([SLO](https://arxiv.org/pdf/2410.14257))**: 
>>Measurable performance targets defining acceptable thresholds for latency, availability, and quality. For LLM systems, includes metrics like TTFT for prompt processing, TPOT for token generation, error rates (timeouts, schema violations), and content quality benchmarks. SLOs balance speed with accuracy across different inference stages. 

