# TyProX Telemetry Engine Specification

> **Engine Module**: `src/telemetry/`  
> **Schema Version**: `1` (ADR-005)

---

## 1. Mathematical Attributes Formulas

### Net Words Per Minute (WPM)
$$\text{WPM} = \frac{\text{Correct Characters} / 5}{\text{Duration in Minutes}}$$

### Raw Words Per Minute (Raw WPM)
$$\text{Raw WPM} = \frac{\text{Total Inputs Occupied} / 5}{\text{Duration in Minutes}}$$

### Precision Percentage
$$\text{Precision (\%)} = \left( \frac{\text{Correct Characters}}{\text{Total Inputs Occupied}} \right) \times 100$$

### Consistency Score (Relative Standard Deviation / RSD)
Given inter-keystroke intervals $\Delta t_i$:
$$\mu = \frac{1}{N} \sum_{i=1}^N \Delta t_i, \quad \sigma^2 = \frac{1}{N} \sum_{i=1}^N (\Delta t_i - \mu)^2$$
$$\text{RSD} = \frac{\sigma}{\mu}$$
$$\text{Consistency} = \max\left(0, \min\left(100, \text{Math.round}\left(100 \times (1 - \text{RSD})\right)\right)\right)$$

---

## 2. Typing DNA Vectors
- **Alphabet Speeds**: Average millisecond keypress interval for letters $a-z$ and numbers $0-9$.
- **Bigram Transition Speeds**: Matrix of 676 letter pairs (e.g. `'th'`, `'in'`, `'er'`, `'on'`) capturing two-key sequence timings.
- **Error Frequencies**: Frequency map of key position mis-strikes and backspace occurrences.
