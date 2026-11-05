# Recommended AWS resources for Cisco AI Defense labs

This list is for **system-engineer enablement**: what to have in an AWS account so you can connect Cisco AI Defense, populate **AI Assets**, and run realistic agent / RAG / gateway demos.

**Required** is too strong. Treat these as **recommended** for a complete public-cloud lab. A tenant can still use AI Defense (Inspect API, Gateway, red teaming) with little or no AWS. AWS is what fills **cloud-discovered** inventory (agents, models, knowledge bases) and hosts the sample workloads.

Lab evidence in this environment: AWS account `772180452080`, region `us-east-1`, AI Defense integration **Eddie RunOn AWS** (Resource Discovery, CloudTrail, Bedrock Invoke). Discovered examples: Bedrock AgentCore harness `AetherHrAssistant`, knowledge bases `vitaltrust-ehr-kb` and `aether-hr-kb`, model **Nova 2 Lite**. Skills in this tenant were **manually uploaded**, not discovered from AWS.

Cisco AI Defense does **not** read S3 (or EC2) by itself. It discovers **AWS AI control-plane objects** (Bedrock, AgentCore, CloudTrail-backed invokes) and optionally steers traffic via **Multicloud Defense**. S3 matters because **Bedrock Knowledge Bases** use it as a data source.

---

## How to use this list

| Lab goal | AWS you need |
|---|---|
| AI Assets → Knowledge bases | S3 + Bedrock Knowledge Base (+ embeddings + vector store) |
| AI Assets → Models | Bedrock model access + **InvokeModel / Converse** that CloudTrail can see (app or CLI). AgentCore Playground may **not** create a Models row |
| AI Assets → Discovered Agents | Bedrock **AgentCore Harness** (Agents Classic is maintenance-mode / often blocked) |
| RAG through an agent | AgentCore **Gateway** + Managed Knowledge Base target + IAM |
| App + Inspect / Defense Gateway | EC2 (or similar) running the sample app (VitalTrust) |
| East-west inspection / MCD | Two or more VPCs + Multicloud Defense gateways |
| Utility scripts (BOM upload, cron invoke) | EC2 or a laptop with IAM; not a unique AWS product |

---

## Account, identity, and discovery

**Name:** AWS account (dedicated lab account)

**Description:** A single account (or a well-scoped org unit) where SEs can create Bedrock, AgentCore, S3, and VPC resources without production blast radius. Discovery is account-scoped; mixing with unrelated production accounts fills inventory with noise.

---

**Name:** AWS Region (`us-east-1` recommended for US labs)

**Description:** Bedrock model availability, AgentCore, Managed Knowledge Bases, and the AI Defense AWS connector must share a region. Cross-region mismatch is a common “nothing showed up” failure.

---

**Name:** IAM Identity Center / federated roles (no long-lived access keys)

**Description:** Lab users should assume a role (for example CDW federated `admin`) via `aws login` or console SSO. AI Defense’s AWS integration also assumes an inventory role in the account. Do not put access keys in git or in the sample app source.

---

**Name:** IAM role for Cisco AI Defense AWS integration (inventory / Resource Discovery)

**Description:** The connector (often created from the AI Defense AWS integration wizard) needs a role that can read Bedrock, AgentCore, CloudTrail, and related metadata. This is what populated **Knowledge bases**, **Models** (from Invoke/CloudTrail), and **Discovered Agents** (AgentCore harness). Without this role, AWS resources exist but never appear in AI Assets.

---

**Name:** AWS CloudTrail (management events, Bedrock data events if offered)

**Description:** AI Defense **Models** inventory is driven by **Bedrock Invoke / CloudTrail**, not by “a model exists in the catalog.” Something must actually call `InvokeModel` or `Converse`. Enable a trail in the lab region. If Bedrock data events are available, turn them on so invokes are visible.

---

**Name:** Amazon SQS (integration-created queues)

**Description:** Some AI Defense AWS integrations use SQS (plus EventBridge/CloudTrail) to receive resource-change notifications. Prefer the queues the **wizard creates**. You do not need to design a custom SQS topology for the first lab.

---

## Amazon Bedrock (models and RAG)

**Name:** Amazon Bedrock (service access + model access)

**Description:** Core AI control plane for this lab. Enable Bedrock in the lab region and grant **model access** for at least one Nova family model and one Claude Sonnet (for example Nova 2 Lite for CloudTrail-visible invokes, Claude Sonnet 4.6 for AgentCore tool use). Serverless FMs do **not** show in AI Assets until they are invoked (or attached to a discovered artifact).

---

**Name:** Bedrock foundation models / inference profiles (Nova, Claude, Titan Embeddings)

**Description:**

- **Nova 2 Lite** (or similar): good **Models** tab row when invoked from an app or `bedrock-runtime converse` (VitalTrust-style).
- **Claude Sonnet 4.6** (US or global inference profile): reliable **tool calling** on AgentCore Harness + Gateway RAG. Nova Micro/Lite often fail with `invalid sequence as part of ToolUse`.
- **Titan Text Embeddings V2** (or G1 Text): required when creating a Knowledge Base that embeds S3 objects.

Cross-region inference profile IDs (`us.…`, `global.…`) need matching IAM `InvokeModel` on both the **inference-profile** ARN and the **foundation-model** ARNs.

---

**Name:** Amazon S3 (buckets for Knowledge Base corpora)

**Description:** S3 is **not** an “AI Defense knowledge base.” Cisco does not inventory a random bucket as a KB. S3 holds the **source documents** for an **Amazon Bedrock Knowledge Base**. After you create the Bedrock KB and point its data source at `s3://bucket/prefix/`, Resource Discovery can list the KB in **AI Assets → Knowledge bases**. Use private buckets, Block Public Access, SSE-S3 or SSE-KMS. Lab examples: `vitaltrust-kb-data-…` (clinical seed) and `aether-hr-kb-data-…` (HR handbook). Keep EHR/PHI-shaped lab text off the HR KB.

---

**Name:** Amazon Bedrock Knowledge Bases (customer-managed, OpenSearch Serverless)

**Description:** Console path: Knowledge bases → S3 data source → Titan embeddings → **Quick create a new vector store**. That provisions an OpenSearch Serverless collection. This pattern discovered `vitaltrust-ehr-kb`. Good for **KB inventory**. The AgentCore Gateway **Knowledge Bases connector** may **reject** this type (it wants **Managed** KBs).

---

**Name:** Amazon OpenSearch Serverless (vector collection)

**Description:** Created automatically by Bedrock **Quick create a new vector store**. You rarely build the collection by hand. It is the vector index behind a customer-managed KB. Expect a standing cost even when idle; call this out in SE costing.

---

**Name:** Amazon Bedrock Knowledge Bases (Managed / AgentCore Knowledge Bases)

**Description:** AgentCore → Knowledge Bases (KB). Fully managed RAG (no OSS collection for you to run). This is what the **AgentCore Gateway → Knowledge Bases connector** attaches to (`Retrieve` / `AgenticRetrieveStream`). Lab example: `aether-hr-kb`. Use this type when the goal is **agent + KB**, not only a KB inventory row.

---

**Name:** Bedrock Knowledge Base data source sync

**Description:** After uploading S3 objects, **Sync** the data source. An empty or unsynced KB can be “Available” in inventory but return no chunks. Gateway targets created before the KB is ready often fail at retrieve time.

---

**Name:** Amazon Bedrock Guardrails (optional)

**Description:** Optional inventory / demo asset (for example PII filters for SSN). Useful for “policy object in AWS” discussions. Not required for Agents/KBs/Models tabs. Confirm the name does not already exist before creating a duplicate.

---

## AgentCore (discovered agents and tools)

**Name:** Amazon Bedrock AgentCore Harness

**Description:** Recommended **Discovered Agents** object. You declare model, system prompt, tools, and limits; AgentCore runs the loop in a session microVM. Lab: `AetherHrAssistant`. Agents for Amazon Bedrock (**Agents Classic**, `AWS::Bedrock::Agent`) is in maintenance mode and is often **CreateAgent AccessDenied** on accounts with no prior classic usage. Do not plan SE labs around classic agents.

---

**Name:** IAM execution role for the AgentCore Harness

**Description:** Separate from the AI Defense inventory role. The harness assumes this role to call Bedrock and the Gateway. It needs `bedrock:InvokeModel` / `Converse` on the models you test, and `bedrock-agentcore:InvokeGateway` on the gateway ARN. The CloudFormation starter role often has **model invoke only**; adding a Gateway tool without updating this role yields **403** on `/mcp`. Console **Update IAM execution role** (or an extra inline policy) is part of the lab.

---

**Name:** Amazon Bedrock AgentCore Gateway

**Description:** MCP endpoint in front of tools (Knowledge Base connector, Lambda, OpenAPI, web search). The harness does **not** take a classic `KnowledgeBases:` list. RAG is: KB → Gateway target → harness **Tools → Gateway**. Lab: `aether-hr-kb-gw` exposing `Retrieve` against `aether-hr-kb`. Also the natural AWS object if you later want **MCP / Tools** stories from cloud composition (this tenant’s Skills/Tools tabs did **not** auto-fill from Gateway).

---

**Name:** IAM service role for AgentCore Gateway

**Description:** Distinct from the harness execution role. The Gateway role needs permission to retrieve from the bound Knowledge Base (`bedrock:Retrieve` on the KB ARN, or whatever the console attaches when you pick the KB target). Console **Create default role** is appropriate for labs.

---

**Name:** AgentCore inbound auth (IAM SigV4)

**Description:** For playground and scripts, inbound **IAM (SigV4)** on both Gateway and Harness avoids Cognito/JWT. Production SEs should still see JWT as the “per-user identity” option; it is not required to populate inventory.

---

## Compute, network, and Multicloud Defense

**Name:** Amazon VPC (one for a simple app lab)

**Description:** Place EC2/ECS sample apps, and optionally VPC endpoints for Bedrock, in a lab VPC. AI Defense discovery does not require a custom VPC (Bedrock is regional/serverless), but every **workload** demo does.

---

**Name:** Additional Amazon VPCs (two or three) + routing

**Description:** Recommended when the enablement goal includes **Cisco Multicloud Defense (MCD)** as an inline/inspection gateway **between** VPCs (or VPC-to-egress). AI Defense **runtime via MCD** and “see traffic between app tiers” labs need more than one network segment. Park this until Bedrock inventory works; it is orthogonal to Knowledge Base discovery.

---

**Name:** Amazon EC2

**Description:** VMs for (1) sample apps such as VitalTrust, (2) utility hosts that run `cisco-aibom`, `aws bedrock-runtime converse`, or a later AgentCore `InvokeHarness` cron, (3) optional “developer workstation” images. Instance **IAM roles** should replace access keys. EC2 is not discovered as an AI agent.

---

**Name:** Elastic Load Balancing / public subnet or Elastic IP (as needed)

**Description:** Only if SEs must hit the sample app or an HTTP MCP from Cisco AI Defense **Defense Gateway**, Secure Access, or a browser. Not required for Bedrock Resource Discovery.

---

**Name:** Amazon ECS / EKS (optional)

**Description:** Recommended if the curriculum includes **containerized agents**, **hybrid AI Defense connector** on EKS, or scanning images with AI BOM. Skip for a first Bedrock-only inventory lab.

---

**Name:** AWS Lambda (optional)

**Description:** Common AgentCore Gateway **target** (REST/tool implemented in Lambda) and a clean “tool” object in architecture talks. Not required to discover a Harness or a KB.

---

**Name:** Amazon API Gateway (optional)

**Description:** Front door for a **Streamable HTTP MCP** or a webhook that invokes the harness. The AI Defense **MCP** product surface wants an HTTP MCP URL, not a stdio `mcp.json` in GitHub. Use this when teaching MCP registration, not for the first KB demo.

---

**Name:** Amazon EventBridge Scheduler / EventBridge rules (optional)

**Description:** Cloud-native alternative to cron on EC2 for unattended `InvokeHarness` or `converse` heartbeats (model last-activity, agent last-seen). The agent still runs in AgentCore; EventBridge is only the trigger.

---

## Supporting security and ops

**Name:** AWS KMS (optional customer-managed keys)

**Description:** Encrypt S3 KB buckets, CloudWatch log groups, and AgentCore/Gateway resources. Good hygiene for SE labs that mention HIPAA-shaped data; SSE-S3 is enough for a first pass.

---

**Name:** Amazon CloudWatch Logs and X-Ray

**Description:** Harness and Gateway troubleshooting (AccessDenied, tool-load 403, retrieve failures). AI Defense inventory does not replace these logs. Restrict log access if prompts or retrieved chunks may contain lab PII.

---

**Name:** AWS Secrets Manager / AgentCore Identity token vault (optional)

**Description:** Needed when Gateway outbound auth is API key or OAuth, or when the harness uses non-Bedrock model keys. IAM SigV4 labs can skip this.

---

**Name:** Amazon ECR (optional)

**Description:** Store custom agent or sample-app images. AgentCore Harness default runtime pulls from public ECR; VPC-only harnesses need NAT to pull that image unless you bring your own.

---

## IAM patterns SEs must be ready to grant

These are not extra “products,” but labs fail without them:

| Principal | Typical needs |
|---|---|
| AI Defense inventory role | Read Bedrock, AgentCore, CloudTrail; receive events |
| Harness execution role | `InvokeModel` / `Converse` on each demo model; `InvokeGateway` on the gateway |
| Gateway service role | `Retrieve` (and related) on the Managed KB |
| SE / EC2 instance role | `InvokeHarness` + `InvokeAgentRuntime` if calling the agent from a script; or only `converse` if filling **Models** |

Console **Update IAM execution role** after attaching a Gateway or changing models is a lab step, not optional trivia.

---

## What you do **not** need for a first AI Assets cloud lab

- Classic **Bedrock Agents** (`AWS::Bedrock::Agent`) if CreateAgent is denied.
- Making S3 buckets public.
- GitHub inside AWS (Skills in some tenants are **manual SKILL.md upload**, not GitHub App and not S3).
- GCP/Azure **in addition to** AWS for the Bedrock inventory story (add them when teaching **multi-cloud** connectors).
- A dedicated “AI Defense knowledge base” service in AWS — use **Bedrock Knowledge Bases**.

---

## Suggested minimum set for SE training (one account, `us-east-1`)

1. IAM federation + AI Defense AWS integration role + CloudTrail  
2. Bedrock model access (Nova + Claude Sonnet + Titan embeddings)  
3. S3 bucket + **Managed** Knowledge Base + sync  
4. AgentCore Harness + Gateway (KB connector) + updated execution role  
5. One EC2 (or laptop) that can invoke Bedrock and/or the harness  
6. Optional: second/third VPC + MCD when the course covers network inspection  

That set covers **Knowledge bases**, **Discovered Agents**, a **Models** row (via explicit `converse`/`InvokeModel`), and a live RAG agent. **Skills / Tools / MCP** tabs may still need product-specific registration (manual skill upload, HTTP MCP, BOM projection) rather than more AWS primitives.
