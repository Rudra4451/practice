# 3D Driving Simulation & Car Game

A high-performance, immersive 3D car simulator and driving game built with **Three.js** (for WebGL graphics) and **cannon-es** (for 3D rigid-body physics). The project is bundled and run using **Vite**.

## 🚀 Features

- **Realistic Vehicle Physics**: Detailed vehicle simulation (acceleration, steering, suspension, and braking) powered by `cannon-es`.
- **Diverse Game Zones**: Explore a rich, expansive map featuring multiple zones:
  - **City Zone**: Urban streets with traffic and pedestrians.
  - **Beach Zone**: Relaxed, sandy coastal driving.
  - **Off-Road Zone**: Rugged terrain testing suspension and control.
  - **Race Circuit**: High-speed lap racing track.
  - **Speed Zone**: Straightaways for top-speed testing.
- **Dynamic Environments**: 
  - **Day/Night Cycle**: Smooth transitional skyboxes, ambient lighting, and headlights.
  - **Weather System**: Real-time atmospheric weather changes.
- **Interactive Garage**: Customize and select from multiple car models (Ferrari, Lamborghini, Porsche, BMW, and Off-Road).
- **Rich Neon HUD**: Fully functional head-up display featuring a needle speedometer, current gear, speed zones, and dashboard diagnostics.
- **NPC Traffic & Pedestrians**: Living world containing AI-driven traffic systems and pedestrian pathfinding.
- **Advanced Core Systems**:
  - **Audio Manager**: Engine noises, ambient sounds, and interface audio.
  - **Post-Processing**: Immersive visual shader effects.
  - **Save Manager**: Local persistence for game state and unlocked progress.

## 🛠️ Technology Stack

- **Graphics**: [Three.js](https://threejs.org/)
- **Physics**: [cannon-es](https://github.com/pmndrs/cannon-es)
- **Bundler**: [Vite](https://vite.dev/)
- **Logic**: ES6+ JavaScript
- **Styling**: Custom CSS (Vanilla)

## 💻 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Rudra4451/practice.git
   cd practice
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

To start the Vite local development server:
```bash
npm run dev
```
Open the URL shown in your terminal (usually `http://localhost:5173`) in your browser.

### Building for Production

To build the optimized static assets for deployment:
```bash
npm run build
```
You can preview the built production app locally using:
```bash
npm run preview
```

## 📂 Project Structure

- `src/cars/`: Core vehicle logic and physical model definitions.
- `src/world/`: Zone creators, obstacles, and terrain builders.
- `src/systems/`: Managers for input, weather, audio, daylight, post-processing, and storage.
- `src/hud/`: SVG and Canvas rendering for the game HUD and Garage UI.
- `src/npc/`: Simple AI scripts managing pedestrians and active traffic routes.
- `public/assets/`: 3D Models (`.glb`) and sound files.
