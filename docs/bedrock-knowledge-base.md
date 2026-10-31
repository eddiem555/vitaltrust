# Bedrock Knowledge Base for Cisco AI Defense inventory

VitalTrust’s in-app assistant talks to Bedrock with MCP tools. That does **not** create a Knowledge Base resource. The KB below was added in AWS so Cisco AI Defense **AI Assets → Knowledge bases** can discover a persistent Bedrock artifact.

This is **outside** the Node app. There is no VitalTrust code path that queries the KB at runtime (unless you add one later).

## Account and region

| Item | Value |
|---|---|
| AWS account | `772180452080` (`CDW-security-pubcloud`) |
| Region | `us-east-1` |
| AI Defense AWS integration | `Eddie RunOn AWS` (Resource Discovery, CloudTrail, Bedrock Invoke) |

## Resources that already exist

Created in the Bedrock / S3 consoles (Gemini-assisted). Prefer **document and seed**, do not run create again if these names exist.

| Type | Identifier |
|---|---|
| S3 bucket | `vitaltrust-kb-data-772180452080` |
| Seed object | `vitaltrust-clinical-protocols.txt` |
| Knowledge base name | `vitaltrust-ehr-kb` |
| Data source name | `vitaltrust-s3-source` |
| S3 URI | `s3://vitaltrust-kb-data-772180452080/` |

Canonical seed in git: [`docs/seed/vitaltrust-clinical-protocols.txt`](seed/vitaltrust-clinical-protocols.txt). It is **synthetic lab text** (includes a fake John Doe / SSN example for DLP tests). Not real PHI.

Optional console extra (may or may not exist): Bedrock Guardrail `vitaltrust-hipaa-guard` with US SSN / DL PII filters. Confirm in **Bedrock → Guardrails** before creating a duplicate.

## Recreate S3 + re-upload seed

Federated CDW login (`aws login`), then:

```bash
cd /Users/eddiem/src/vitaltrust
./deployment/bedrock-kb/deploy-s3-seed.sh
```

CloudFormation (new accounts / disaster recovery only; **will fail if the bucket name is taken**):

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name vitaltrust-kb-s3 \
  --template-file deployment/bedrock-kb/s3-bucket.yaml \
  --parameter-overrides BucketName=vitaltrust-kb-data-772180452080
./deployment/bedrock-kb/deploy-s3-seed.sh
```

## Recreate the Knowledge Base (console)

Bedrock still “quick creates” the OpenSearch Serverless collection more reliably than a first-pass CFN index. Match the original lab:

1. Amazon Bedrock → **Knowledge bases** → **Create knowledge base** (us-east-1).
2. Name: `vitaltrust-ehr-kb` (use another name if this one exists).
3. IAM: **Create and use a new service role**.
4. Data source name: `vitaltrust-s3-source`, URI `s3://vitaltrust-kb-data-772180452080/`.
5. Embeddings: **Titan Text Embeddings V2** (or Titan Embeddings G1 - Text).
6. Vector database: **Quick create a new vector store**.
7. Create, then **Sync** the data source.

## AI Defense

After CloudTrail / Resource Discovery catches up, **AI Assets → Knowledge bases** should list `vitaltrust-ehr-kb` (Unreviewed is expected).

A KB does not populate **Discovered Agents**, **Skills**, or **MCP servers**. Those use AgentCore, GitHub, or MCP registration.

## Related but separate lab

Corporate HR inventory (AgentCore harness `AetherHrAssistant`, HR skills, MCP) lives in **`eddiem555/ai-inventory-lab`**, not this repo. Do not point that harness at `vitaltrust-ehr-kb`.
