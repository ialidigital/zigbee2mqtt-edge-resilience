# zigbee2mqtt-edge-resilience

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Zigbee2MQTT](https://img.shields.io/badge/Platform-Zigbee2MQTT-orange.svg)](https://www.zigbee2mqtt.io/)

A robust state-management extension for Zigbee2MQTT (Z2M). This module is engineered to provide **Edge Resilience** for hardware that suffers from "Ghost Updates," "Micro-Brownouts," and unreliable power-on behavior—specifically targeting **Aurora AOne (mPro)** no-neutral dimmers.

This was built primarily for Aurora (AU-A1ZB2WDM) Zigbee Rotary Dimmers, but is in theory applicable to any master/slave dimmer setup in a Z2M mesh network.

**The result is that you get a wired-hardware-like user experience with the dimmers.**

## 0. Introduction: The XP Experiment
This repository is the result of an Extreme Programming (XP) experiment between Imran Ali (Engineering Lead | Ex-Sky, BBC iPlayer) and Gemini (AI Pair Programmer). Our goal was to explore the boundaries of AI-human collaboration on "messy" real-world hardware problems.

By treating the AI as the "Driver" and the human as the "Navigator/Architect," we successfully reverse-engineered proprietary hardware behavior and built a resilient state-sanitization layer that traditionally requires closed-ecosystem hubs.

Planning and brainstorming huddles proved especially useful, and giudance on when to 
stop, pause and analyse, review, pivot, test and progress was welcomed.

## 1. The Problem: "Ghost State" Interference
No-neutral smart switches (power-stealing hardware) often experience momentary voltage drops when driving inductive or low-wattage LED loads. In the case of **Aurora AOne** hardware, these "micro-brownouts" trigger a radio reset, causing the device to broadcast a default state update of **brightness: 128 (50%)**.

In a standard "Last Message Wins" architecture, this ghost update incorrectly dims the entire lighting group, creating a "flicker" effect and desyncing the physical UI from the logical state.

## 2. Included Extensions
A. Edge Resilience `(edge-resilience.js)`
The primary Source of Truth (SoT) engine. It intercepts incoming state transitions from designated "Slaves" and reconciles them against a "Gold Master."

* **Illegal State Interception:** Detects the "128-Brightness" ghost signature and prevents it from propagating to the coordinator.

* **State Reconciliation:** Forces Slaves back to the Master's current state upon a detected reset.

* **Idempotent Execution:** Prevents Zigbee mesh congestion by only acting on genuine deltas.

* **Power-On Recovery:** (v2.0) Logic to restore "Last Known Good State" following a circuit-level power outage.

B. Backlight Nightly `(backlight_nightly.js)`
An environmental UX manager that controls the blue LED ring on Aurora dimmers based on a time-of-day schedule.

* **Stealth Mode:** Automatically kills the blue "halo" backlight at night for total darkness in bedrooms/ensuites.

* **Daylight Restoration:** Restores the backlight during the day for easy switch location.

* **Configuration:** Dynamically driven by the `edge-resilience.yaml` config file.

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
1. Clone this repository or copy `edge-resilience.yaml` and `backlight_nightly.yaml` from the /config folder of this repo into your zigbee2mqtt/data/ folder

```yaml
zigbee2mqtt/data/
  - edge-resilience.yaml
  - backlight-nightly.yaml
```

2. Go to Z2M Console > Settings > Dev Console > External Extensions.
3. Select 'Create New Extension'.
4. Create two new extensions: `edge-resilience.js` and `backlight_nightly.js`.
5. In the editor copy the respective code from the /src folder of this repo.
6. Save and watch the logs for successful initialization.
7. It is now loaded :)

### Manual Setup
1. Clone this repository or copy `edge-resilience.yaml` and `backlight_nightly.yaml` from the /config folder of this repo into your zigbee2mqtt/data/ folder
2.  Create a folder named `external_extensions` in your Z2M data directory (if it doesn't exist) `zigbee2mqtt\data\external_extensions`
3.  Clone this repository or copy `edge-resilience.js` and `backlight_nightly.js` into that folder.

```yaml
zigbee2mqtt/data/external_extensions/
  - edge-resilience.js
  - backlight-nightly.js
```

```yaml
zigbee2mqtt/data/
  - edge-resilience.yaml
  - backlight-nightly.yaml
```

4. Stop zigbee2mqtt service, ensure it has completely stoppped.
5. Start zigbee2mqtt service. (This ensures all Z2M extensions are loaded).
6. Watch the logs for successful initialization.

## 5. Collaborative Credits
Co-Authors:

- Imran Ali ([LinkedIn](https://www.linkedin.com/in/imranali)) - Architect, Navigator & Quality Gate

- Gemini (Google AI) - Driver & Implementation Specialist

This project was co-authored as an experiment in human-AI Pair Programming (XP), focusing on solving complex electrical and logic issues in real-world Zigbee environments. The project serves as a proving ground to encourage other engineers to leverage AI for complex systems-level problem solving.

