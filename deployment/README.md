# VitalTrust Deployment
This directory contains the configurations for deploying VitalTrust in either standalone or distributed modes.

## Deployment Options

### 1. Standalone (Single Node)
All components (UI, Database API, and AI Proxy) run in a single container.
```bash
docker build -t vitaltrust-standalone -f deployment/Dockerfile .
docker run -p 3000:3000 vitaltrust-standalone
```

### 2. Distributed (Multi-Node)
Simulate the target healthcare architecture with separate hosts for increased security testing.
- **appserver**: Application Server & Reverse Proxy
- **dbserver**: Clinical Database API
- **aibroker**: AI Agent / MCP Host

Use Docker Compose to launch the environment:
```bash
docker compose -f deployment/docker-compose.yml up
```

## Security Testing Scenarios
- **Cisco Secure Workload**: Configure micro-segmentation to allow traffic ONLY between `appserver` and `dbserver` on port 3000.
- **Cisco Secure Access (ZTNA)**: Deploy `appserver` and require authenticated access via ZTNA connector.
- **Cisco Duo**: The `appserver` host is the primary integration point for SAML/OIDC identity logic.
