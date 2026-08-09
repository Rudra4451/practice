# TyProX Telemetry Protocol v1 & v2

Specification for capturing, computing, and serializing high-frequency keystroke telemetry.

## Event Payload Structure
```json
{
  "t": 142.5,
  "u": 215.0,
  "k": "a",
  "y": 0,
  "i": 0,
  "finger": "L4",
  "hand": "left",
  "holdDuration": 72.5,
  "flightTime": 110.0
}
```

## Derived 5 Core Attributes
- **Reaction Time**: $t_{\text{first\_keystroke}}$ (ms)
- **Precision**: $(N_{\text{total}} - N_{\text{errors}}) / N_{\text{total}} \times 100$ (%)
- **Consistency**: $100 - \sigma(\text{WPM}_{\text{segments}})$ (%)
- **Rhythm Stability**: $100 - \sigma(\Delta t_{\text{inter\_keystroke}})$ (%)
- **Acceleration**: Slope of linear regression across 5-second WPM intervals
