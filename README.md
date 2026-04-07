# zigbee2mqtt-edge-resilience

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Zigbee2MQTT](https://img.shields.io/badge/Platform-Zigbee2MQTT-orange.svg)](https://www.zigbee2mqtt.io/)

A robust state-management extension for Zigbee2MQTT (Z2M). This module is engineered to provide **Edge Resilience** for hardware that suffers from "Ghost Updates," "Micro-Brownouts," and unreliable power-on behavior—specifically targeting **Aurora AOne (mPro)** no-neutral dimmers.

## 0. Introduction: The XP Experiment
This repository is the result of an Extreme Programming (XP) experiment between Imran Ali (Lead Engineer | Ex-Sky, BBC iPlayer) and Gemini (AI Pair Programmer). Our goal was to explore the boundaries of AI-human collaboration on "messy" real-world hardware problems.

By treating the AI as the "Driver" and the human as the "Navigator/Architect," we successfully reverse-engineered proprietary hardware behavior and built a resilient state-sanitization layer that traditionally requires closed-ecosystem hubs.

## 1. The Problem: "Ghost State" Interference
No-neutral smart switches (power-stealing hardware) often experience momentary voltage drops when driving inductive or low-wattage LED loads. In the case of **Aurora AOne** hardware, these "micro-brownouts" trigger a radio reset, causing the device to broadcast a default state update of **brightness: 128 (50%)**.

In a standard "Last Message Wins" architecture, this ghost update incorrectly dims the entire lighting group, creating a "flicker" effect and desyncing the physical UI from the logical state.

## 2. The Solution: Master-Slave State Engine
This extension implements a **Source of Truth (SoT)** pattern. It designates a "Gold Master" device and intercepts incoming state transitions from designated "Slaves." 

### Key Features:
* **Illegal State Interception:** Detects the "128-Brightness" ghost signature and prevents it from propagating to the coordinator.
* **State Reconciliation:** Automatically forces Slaves back to the Master's current state upon a detected reset.
* **Idempotent Execution:** Commands are only sent if a genuine delta exists, preventing Zigbee mesh congestion.
* **Power-On Recovery:** (v2.0) Logic to restore "Last Known Good State" following a circuit-level power outage.

## 3. Architecture
The extension operates as a middleware layer within the Zigbee2MQTT lifecycle:

1.  **Ingress:** Slave device broadcasts a state update.
2.  **Evaluation:** The extension identifies if the update is a "Ghost" (e.g., Brightness 128 without a manual interaction event).
3.  **Correction:** If a ghost is detected, the extension queries the Master's state in the Z2M cache and issues a `set` command to the Slave to revert.

## 4. Installation & Configuration

### Prerequisites
- Zigbee2MQTT 1.30.0 or higher.
- Access to the Z2M `data` directory.

### Setup in Z2M Console (Recommended)
1. Go to Z2M Console > Settings > Dev Console > External Extensions
2. Select 'Create New Extension'.
3. Give it the name `edge-resilience.js`
4. In the editor delete the default extension content and copy paste the entire content of dist/edge-resilience.js.
5. Press Save button.
6. Watch the Z2M console logs for success message.
7. It is now loaded

### Manual Setup
1.  Create a folder named `external_extensions` in your Z2M data directory (if it doesn't exist) `zigbee2mqtt\data\external_extensions`
2.  Clone this repository or copy `edge-resilience.js` into that folder.

```yaml
external_extensions:
  - edge-resilience.js
```
3. Stop zigbee2mqtt service, ensure it has completely stoppped.
4. Start zigbee2mqtt service. (This ensures all Z2M extensions are loaded).

## 5. Collaborative Credits
Co-Authors:

Imran Ali ([LinkedIn](https://www.linkedin.com/in/imranali)) - Navigator & Quality Gate

Gemini (Google AI) - Driver & Implementation Specialist

This project serves as a proving ground to encourage other engineers to leverage AI for complex systems-level problem solving.
