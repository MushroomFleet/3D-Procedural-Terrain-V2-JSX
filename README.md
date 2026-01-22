# 3D Procedural Terrain V2 JSX

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Three.js](https://img.shields.io/badge/Three.js-r128-blue.svg)](https://threejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)

A deterministic, seed-based procedural terrain generation system with an integrated structure layer for map editing. Built with React and Three.js, featuring seamless infinite terrain tiling and JSON-exportable structure placement.

![Terrain Preview](https://via.placeholder.com/800x400/050505/00ff00?text=3D+Procedural+Terrain+V2)

---

## ✨ Features

### 🏔️ Procedural Terrain Generation
- **Deterministic Seeds:** Same seed always produces identical terrain
- **Simplex Noise:** Multi-octave fractal noise for natural-looking landscapes
- **6 Biomes:** Grassland, Desert, Tundra, Volcanic, Alien World, Canyon
- **Seamless Tiling:** World-space coordinates ensure perfect tile joins

### 🏗️ Structure Layer System
- **5 Wireframe Structure Types:** Cuboid, Pyramid, Cylinder, Tower, Dome
- **Grid-Based Placement:** Click-to-place on customizable grid overlay
- **Terrain Masking:** Automatic flattening of terrain under structures
- **Adjacent Cell Reservation:** Creates flat buffer zones around structures

```
OOOOO
OXXXO
OXSXO    S = Structure (flat)
OXXXO    X = Reserved padding (blended)
OOOOO    O = Normal terrain
```

### 🗺️ Preview Mode (9-Tile View)
- **Adjacent Tile Generation:** View surrounding 8 tiles for context
- **Seamless Joins:** Verify terrain continuity across tile boundaries
- **Tile Seed Display:** Access unique identifiers for each tile position

```
┌────┬────┬────┐
│ NW │ N  │ NE │
├────┼────┼────┤
│ W  │ C  │ E  │   C = Editable center tile
├────┼────┼────┤
│ SW │ S  │ SE │
└────┴────┴────┘
```

### 💾 JSON Export/Import
- **Structure Layer Export:** Save placement data tied to terrain seed
- **Version Control:** Schema versioning for forward compatibility
- **Tile Coordinates:** Full coordinate system for infinite world support

---

## 🚀 Quick Start

### Demo (Instant Preview)

Open `demo.html` in any modern browser - no build step required!

```bash
# Clone the repository
git clone https://github.com/MushroomFleet/3D-Procedural-Terrain-V2-JSX.git

# Open the demo
open demo.html
# or on Windows:
start demo.html
```

### React Integration

```jsx
import ProceduralTerrainV2 from './ProceduralTerrainV2';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ProceduralTerrainV2
        seed="my-world-seed"
        biome="volcanic"
        resolution={64}
        editorMode={true}
      />
    </div>
  );
}
```

---

## 📁 Project Structure

```
3D-Procedural-Terrain-V2-JSX/
├── ProceduralTerrainV2.jsx              # Main React component
├── demo.html                            # Standalone browser demo
├── 3D-Procedural-Terrain-V2-JSX-integration.md  # Developer guide
└── README.md                            # This file
```

---

## 🎮 Controls

| Action | Control |
|--------|---------|
| Rotate View | Click + Drag |
| Zoom | Mouse Wheel |
| Place Structure | Click on Grid (Editor Mode) |
| Remove Structure | Click on Existing Structure |

---

## ⚙️ Configuration Options

### Terrain Settings
| Option | Range | Description |
|--------|-------|-------------|
| Seed | Any string | Deterministic generation seed |
| Biome | 6 options | Terrain color palette & height |
| Resolution | 16-128 | Mesh detail level |

### Grid Settings
| Option | Range | Description |
|--------|-------|-------------|
| Grid Size | 8-24 | Cells per axis |
| Cell Size | 2-5 | World units per cell |

### Modes
| Mode | Description |
|------|-------------|
| Editor Mode | Enable structure placement |
| Preview Mode | Show 9-tile seamless view |

---

## 📤 Export Format

```json
{
  "version": "2.0",
  "baseSeed": "cosmic-landscape-42",
  "tileCoord": { "x": 0, "z": 0 },
  "tileSeed": "cosmic-landscape-42",
  "timestamp": 1706745600000,
  "structures": [
    {
      "id": "struct-1706745600000-abc123",
      "type": "pyramid",
      "gridX": 2,
      "gridZ": -1,
      "width": 3,
      "height": 5,
      "depth": 3
    }
  ]
}
```

---

## 📖 Documentation

For detailed integration instructions, API reference, and advanced usage examples, see:

**[📘 Integration Guide](./3D-Procedural-Terrain-V2-JSX-integration.md)**

Topics covered:
- Component props reference
- Structure layer system
- Biome customization
- Adding custom structure types
- Performance optimization
- Multiplayer sync examples

---

## 🛠️ Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| React | 18.2+ | UI Framework |
| React DOM | 18.2+ | DOM Rendering |
| Three.js | r128+ | 3D Graphics |

### CDN Links (for standalone use)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

---

## 🔮 Use Cases

- **Game Development:** Procedural world generation with structure placement
- **Level Editors:** Visual terrain & building layout tools
- **Visualization:** 3D terrain previews for geographic data
- **Education:** Demonstrating procedural generation techniques
- **Prototyping:** Quick 3D environment mockups

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{3d_procedural_terrain_v2_jsx,
  title = {3D Procedural Terrain V2 JSX: Deterministic terrain generation with structure layer system},
  author = {Drift Johnson},
  year = {2025},
  url = {https://github.com/MushroomFleet/3D-Procedural-Terrain-V2-JSX},
  version = {2.0.0}
}
```

### Donate

[![Ko-Fi](https://cdn.ko-fi.com/cdn/kofi3.png?v=3)](https://ko-fi.com/driftjohnson)
