---
name: elevenlabs-docs
description: Authoritative ElevenLabs documentation index — covers ElevenAgents (Conversational AI), Text-to-Speech, Speech-to-Text, Music, Voice Changer, Voice Isolator, Voice Cloning, Dubbing, Sound Effects, SDKs (Python/JS/React/React Native/Kotlin/Swift), WebSocket/WebRTC, tools (client/server/system/MCP), knowledge base/RAG, telephony (Twilio/SIP/Vonage/Telnyx/Plivo), WhatsApp, widgets, and the full ElevenAgents REST API reference. Use this BEFORE building, configuring, or integrating any ElevenLabs agent or API call so you ground answers in the latest doc URLs instead of guessing. Trigger when the user mentions ElevenLabs, ElevenAgents, Eleven Music, Eleven Creative, conversational voice agents, voice cloning with ElevenLabs, or any `elevenlabs.io/docs/*` URL.
---

# ElevenLabs Documentation Skill

This skill is your **doc lookup map** for everything ElevenLabs. Before answering questions about ElevenLabs features, configuring an agent, picking an SDK, wiring up tools, or writing API calls — consult the relevant URL(s) in `references/elevenlabs-docs-index.md` and (when needed) fetch the page with `WebFetch`.

## How to use

1. **Identify the area** the user is working in (Agents / TTS / STT / Music / SDK / Telephony / Tools / Knowledge Base / Voice Cloning / Webhooks / etc.).
2. **Open `references/elevenlabs-docs-index.md`** — find the matching URL(s).
3. **Append `.md`** to any ElevenLabs doc URL to get clean Markdown (already done in the index).
4. **WebFetch the page** before recommending a flag, field, endpoint name, or SDK method — names change.
5. For full content in one shot, you can fetch `https://elevenlabs.io/docs/llms-full.txt`.
6. For a section index, append `/llms.txt` to any section URL.

## Building an ElevenAgent — canonical references

When asked to build or configure an ElevenAgent, ALWAYS check these first:

- **Quickstart**: `https://elevenlabs.io/docs/eleven-agents/quickstart.md`
- **Build overview**: `https://elevenlabs.io/docs/eleven-agents/build/overview.md`
- **Prompting guide**: `https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide.md`
- **Tools (overview)**: `https://elevenlabs.io/docs/eleven-agents/customization/tools.md`
- **Client tools** (frontend-side): `https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools.md`
- **Server tools** (backend webhook): `https://elevenlabs.io/docs/eleven-agents/customization/tools/server-tools.md`
- **JavaScript SDK**: `https://elevenlabs.io/docs/eleven-agents/libraries/java-script.md`
- **React SDK**: `https://elevenlabs.io/docs/eleven-agents/libraries/react.md`
- **Python SDK**: `https://elevenlabs.io/docs/eleven-agents/libraries/python.md`
- **WebSocket reference**: `https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets.md`
- **Widget customization**: `https://elevenlabs.io/docs/eleven-agents/customization/widget.md`
- **Dynamic variables**: `https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables.md`
- **Get signed URL** (auth for private agents): `https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url.md`
- **Create agent** (REST): `https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create.md`

## Decision shortcuts

| User goal | Doc to read first |
|---|---|
| Voice-driven shopping site / UI updates from voice | client-tools.md + java-script.md |
| Phone-call agent (inbound/outbound) | twilio-integration / sip-trunking |
| Multi-language agent | language.md + voice customization |
| Agent that searches your DB | server-tools.md (webhook) |
| Agent that uses 3rd-party APIs (Slack/HubSpot/Cal.com) | integrations/<vendor>.md |
| Agent that needs your own LLM | custom-llm.md |
| Knowledge-grounded agent | knowledge-base.md + rag.md |

## Rules

- Don't guess SDK method names, tool config field names, or API parameters — fetch the doc.
- When recommending a code snippet, cite which doc URL it came from so the user can verify.
- If multiple SDKs apply (React vs vanilla JS), ask which the user prefers before scaffolding.
- For private/production agents, prefer the **signed URL** flow (server fetches a token, frontend uses it) over exposing the agent ID directly.

## Files

- `references/elevenlabs-docs-index.md` — full URL index of every ElevenLabs docs page (Docs + API Reference). Grep this for the topic before fetching.
