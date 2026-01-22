# 3D Procedural Terrain V2 JSX - Integration Guide

This guide covers how to integrate the `ProceduralTerrainV2.jsx` component into your React/Three.js projects.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Basic Integration](#basic-integration)
4. [Component Props Reference](#component-props-reference)
5. [Working with the Structure Layer](#working-with-the-structure-layer)
6. [Preview Mode & Adjacent Tiles](#preview-mode--adjacent-tiles)
7. [Exporting & Importing Structure Data](#exporting--importing-structure-data)
8. [Customizing Biomes](#customizing-biomes)
9. [Adding Custom Structure Types](#adding-custom-structure-types)
10. [Performance Optimization](#performance-optimization)
11. [Advanced Usage Examples](#advanced-usage-examples)

---

## Prerequisites

### Required Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "three": "^0.128.0"
  }
}
```

### CDN Alternative (for vanilla HTML)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

---

## Installation

### Option 1: Direct File Copy

1. Copy `ProceduralTerrainV2.jsx` to your project's components directory
2. Import and use as shown below

### Option 2: As a Module

```bash
# Clone the repository
git clone https://github.com/MushroomFleet/3D-Procedural-Terrain-V2-JSX.git

# Copy the component file
cp 3D-Procedural-Terrain-V2-JSX/ProceduralTerrainV2.jsx ./src/components/
```

---

## Basic Integration

### Minimal Setup

```jsx
import React from 'react';
import ProceduralTerrainV2 from './components/ProceduralTerrainV2';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ProceduralTerrainV2 />
    </div>
  );
}

export default App;
```

### With Custom Configuration

```jsx
import React, { useState } from 'react';
import ProceduralTerrainV2 from './components/ProceduralTerrainV2';

function TerrainEditor() {
  const [structures, setStructures] = useState([]);
  
  const handleStructurePlace = (structure) => {
    setStructures(prev => [...prev, structure]);
  };
  
  const handleStructureRemove = (id) => {
    setStructures(prev => prev.filter(s => s.id !== id));
  };
  
  return (
    <ProceduralTerrainV2
      seed="my-custom-seed-123"
      biome="volcanic"
      resolution={96}
      gridSize={20}
      cellSize={2.5}
      structures={structures}
      editorMode={true}
      onStructurePlace={handleStructurePlace}
      onStructureRemove={handleStructureRemove}
    />
  );
}
```

---

## Component Props Reference

### Terrain Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `seed` | `string` | `'cosmic-landscape-42'` | Deterministic seed for terrain generation |
| `biome` | `string` | `'grassland'` | Biome type: `grassland`, `desert`, `tundra`, `volcanic`, `alien`, `canyon` |
| `resolution` | `number` | `64` | Terrain mesh resolution (16-128) |
| `tileSize` | `number` | `50` | Size of terrain tile in world units |

### Grid Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gridSize` | `number` | `16` | Number of cells per axis (8-24) |
| `cellSize` | `number` | `3` | World units per grid cell (2-5) |

### Mode Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `editorMode` | `boolean` | `true` | Enable structure placement/removal |
| `previewMode` | `boolean` | `false` | Show adjacent 8 tiles for seamless preview |

### Structure Management

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `structures` | `array` | `[]` | Array of placed structure objects |
| `selectedTool` | `string` | `null` | Currently selected structure type |
| `onStructurePlace` | `function` | `null` | Callback when structure is placed |
| `onStructureRemove` | `function` | `null` | Callback when structure is removed |

---

## Working with the Structure Layer

### Structure Object Schema

```javascript
{
  id: 'struct-1234567890-abc123def',  // Unique identifier
  type: 'cuboid',                      // Structure type
  gridX: 2,                            // Grid X coordinate (relative to center)
  gridZ: -1,                           // Grid Z coordinate (relative to center)
  width: 2,                            // Width (for cuboid/tower/pyramid)
  height: 4,                           // Height
  depth: 2,                            // Depth (for cuboid/tower/pyramid)
  radius: 1.2,                         // Radius (for cylinder/dome)
}
```

### Available Structure Types

| Type | Icon | Color | Parameters |
|------|------|-------|------------|
| `cuboid` | ▢ | Cyan | width, height, depth |
| `pyramid` | △ | Yellow | width, height, depth |
| `cylinder` | ○ | Magenta | radius, height |
| `tower` | ▣ | Green | width, height, depth |
| `dome` | ◠ | Orange | radius |

### Terrain Masking System

When a structure is placed, the terrain mask creates flat areas:

```
OOOOO
OXXXO
OXSXO    S = Structure cell (fully flat)
OXXXO    X = Reserved/padding cells (blended flat)
OOOOO    O = Normal terrain
```

---

## Preview Mode & Adjacent Tiles

### Enabling Preview Mode

```jsx
<ProceduralTerrainV2
  seed="base-world-seed"
  previewMode={true}
  editorMode={false}  // Automatically disabled in preview mode
/>
```

### Understanding Tile Coordinates

```
┌────────┬────────┬────────┐
│ NW     │ N      │ NE     │
│ (-1,-1)│ (0,-1) │ (1,-1) │
├────────┼────────┼────────┤
│ W      │ C      │ E      │
│ (-1,0) │ (0,0)  │ (1,0)  │  ← Center tile is editable
├────────┼────────┼────────┤
│ SW     │ S      │ SE     │
│ (-1,1) │ (0,1)  │ (1,1)  │
└────────┴────────┴────────┘
```

### Accessing Adjacent Tile Seeds

```javascript
import { getAdjacentTileSeeds, getTileSeed } from './ProceduralTerrainV2';

const baseSeed = 'my-world-seed';

// Get all 9 tile seeds
const allSeeds = getAdjacentTileSeeds(baseSeed);
console.log(allSeeds.NW.seed);  // Seed for North-West tile
console.log(allSeeds.C.seed);   // Same as baseSeed

// Get seed for any tile coordinate
const tileSeed = getTileSeed(baseSeed, 5, -3);  // Tile at (5, -3)
```

---

## Exporting & Importing Structure Data

### Export Format (JSON)

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
      "type": "cuboid",
      "gridX": 2,
      "gridZ": -1,
      "width": 2,
      "height": 4,
      "depth": 2
    }
  ]
}
```

### Programmatic Export

```javascript
import { createStructureLayerData } from './ProceduralTerrainV2';

const exportData = createStructureLayerData(
  'my-seed',      // Base seed
  0,              // Tile X coordinate
  0,              // Tile Z coordinate
  structures      // Array of structures
);

// Convert to JSON string
const jsonString = JSON.stringify(exportData, null, 2);

// Download as file
const blob = new Blob([jsonString], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'terrain-structures.json';
a.click();
```

### Importing Structure Data

```javascript
function importStructures(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.version === '2.0' && data.baseSeed && data.structures) {
      // Set the seed to match
      setSeed(data.baseSeed);
      
      // Load structures
      setStructures(data.structures);
      
      return true;
    }
  } catch (e) {
    console.error('Import failed:', e);
  }
  return false;
}
```

---

## Customizing Biomes

### Biome Configuration Structure

```javascript
const CUSTOM_BIOME = {
  name: 'Crystal Caves',
  heightScale: 10,          // Maximum terrain height
  noiseScale: 0.07,         // Noise frequency (smaller = larger features)
  octaves: 5,               // Fractal noise octaves
  colors: {
    deep: 0x1a0033,         // Lowest elevation
    low: 0x4a0080,
    mid: 0x7b1fa2,
    high: 0x00e676,
    peak: 0x76ff03,         // Highest elevation
  },
  wireColor: 0x00c853,      // Wireframe color
  thresholds: {
    deep: -0.35,            // Height thresholds for color bands
    low: 0,
    mid: 0.35,
    high: 0.65
  }
};
```

### Adding a Custom Biome

Modify the `BIOMES` object in the component:

```javascript
const BIOMES = {
  // ... existing biomes ...
  
  crystalCaves: {
    name: 'Crystal Caves',
    heightScale: 10,
    noiseScale: 0.07,
    octaves: 5,
    colors: {
      deep: 0x0d0d26,
      low: 0x1a1a4d,
      mid: 0x4d4d99,
      high: 0x9999ff,
      peak: 0xccccff,
    },
    wireColor: 0x6666ff,
    thresholds: { deep: -0.4, low: -0.1, mid: 0.2, high: 0.5 }
  },
};
```

---

## Adding Custom Structure Types

### Structure Type Configuration

```javascript
const STRUCTURE_TYPES = {
  // ... existing types ...
  
  obelisk: {
    name: 'Obelisk',
    icon: '▲',
    color: 0x9933ff,
    defaultHeight: 12,
    defaultWidth: 1,
    defaultDepth: 1,
  },
};
```

### Adding Geometry Generation

In the `updateStructures` method of `TerrainSceneManager`:

```javascript
case 'obelisk':
  const ow = structure.width || structType.defaultWidth;
  const oh = structure.height || structType.defaultHeight;
  // Create tapered box geometry
  geo = new THREE.BoxGeometry(ow, oh, ow);
  // Or use ConeGeometry for true obelisk shape
  yOffset += oh / 2;
  break;
```

---

## Performance Optimization

### Resolution Guidelines

| Use Case | Recommended Resolution |
|----------|----------------------|
| Mobile devices | 32-48 |
| Standard desktop | 64 |
| High-end systems | 96-128 |

### Optimizing Multi-Tile Preview

```jsx
// Use lower resolution for adjacent tiles in custom implementation
const adjacentResolution = Math.floor(resolution * 0.5);
```

### Memory Management

```javascript
// Clean up when component unmounts
useEffect(() => {
  return () => {
    sceneManagerRef.current?.dispose();
  };
}, []);
```

---

## Advanced Usage Examples

### Procedural World Generation

```javascript
// Generate an infinite world grid
function getWorldTileSeed(baseSeed, worldX, worldZ) {
  return getTileSeed(baseSeed, worldX, worldZ);
}

// Player at world position (150, 0, -200) with tileSize=50
const playerTileX = Math.floor(150 / 50);   // = 3
const playerTileZ = Math.floor(-200 / 50);  // = -4

const currentTileSeed = getWorldTileSeed('world-seed', playerTileX, playerTileZ);
```

### Real-time Structure Sync (Multiplayer)

```javascript
// Broadcast structure changes
const handleStructurePlace = (structure) => {
  setStructures(prev => [...prev, structure]);
  
  // Send to server
  socket.emit('structure:place', {
    tileSeed: currentTileSeed,
    structure: structure
  });
};

// Receive from server
socket.on('structure:place', (data) => {
  if (data.tileSeed === currentTileSeed) {
    setStructures(prev => [...prev, data.structure]);
  }
});
```

### Terrain Height Queries

```javascript
// Get terrain height at a world position
function getTerrainHeight(worldX, worldZ, seed, biome) {
  const rng = new SeededRNG(seed);
  const noise = new SeededNoise(rng);
  const biomeConfig = BIOMES[biome];
  
  let height = noise.fractalNoise(
    worldX * biomeConfig.noiseScale,
    worldZ * biomeConfig.noiseScale,
    biomeConfig.octaves,
    2.0,
    0.5
  );
  
  return height * biomeConfig.heightScale;
}
```

---

## Troubleshooting

### Common Issues

**Issue:** Terrain appears flat or uniform
- Check that the seed is a non-empty string
- Verify biome configuration has valid noiseScale

**Issue:** Structures don't appear
- Ensure `editorMode` is `true`
- Check that `selectedTool` matches a valid structure type

**Issue:** Adjacent tiles don't match at edges
- All tiles must use the same `baseSeed`
- Verify world-space coordinates are calculated correctly

### Debug Mode

Add console logging to trace issues:

```javascript
useEffect(() => {
  console.log('Terrain config:', { seed, biome, resolution, structures });
}, [seed, biome, resolution, structures]);
```

---

## Support & Resources

- **Repository:** https://github.com/MushroomFleet/3D-Procedural-Terrain-V2-JSX
- **Demo:** Open `demo.html` in a browser
- **Issues:** Submit via GitHub Issues

---

*Last updated: January 2025*
