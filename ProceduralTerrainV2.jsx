import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TILE COORDINATE SYSTEM - Deterministic seed generation for adjacent tiles
// ═══════════════════════════════════════════════════════════════════════════════
const TILE_DIRECTIONS = {
  NW: { x: -1, z: -1, name: 'North-West' },
  N:  { x:  0, z: -1, name: 'North' },
  NE: { x:  1, z: -1, name: 'North-East' },
  W:  { x: -1, z:  0, name: 'West' },
  C:  { x:  0, z:  0, name: 'Center' },
  E:  { x:  1, z:  0, name: 'East' },
  SW: { x: -1, z:  1, name: 'South-West' },
  S:  { x:  0, z:  1, name: 'South' },
  SE: { x:  1, z:  1, name: 'South-East' },
};

// Generate deterministic seed for a tile at given coordinates
function getTileSeed(baseSeed, tileX, tileZ) {
  if (tileX === 0 && tileZ === 0) return baseSeed;
  
  // Create a deterministic hash combining base seed with tile coordinates
  const coordString = `${baseSeed}_tile_${tileX}_${tileZ}`;
  let hash = 0;
  for (let i = 0; i < coordString.length; i++) {
    const char = coordString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Convert to alphanumeric seed string
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let tileSeed = '';
  let h = Math.abs(hash);
  for (let i = 0; i < 16; i++) {
    tileSeed += chars[h % chars.length];
    h = Math.floor(h / chars.length) + (hash >> i);
    h = Math.abs(h);
  }
  
  return tileSeed;
}

// Get all adjacent tile seeds
function getAdjacentTileSeeds(baseSeed) {
  const seeds = {};
  Object.entries(TILE_DIRECTIONS).forEach(([key, dir]) => {
    seeds[key] = {
      ...dir,
      seed: getTileSeed(baseSeed, dir.x, dir.z)
    };
  });
  return seeds;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDED PRNG - Mulberry32 algorithm for deterministic randomness
// ═══════════════════════════════════════════════════════════════════════════════
class SeededRNG {
  constructor(seed) {
    this.seed = this.hashString(seed);
    this.state = this.seed;
  }

  hashString(str) {
    if (typeof str === 'number') return str >>> 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  next() {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  reset() {
    this.state = this.seed;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLEX NOISE - Seeded implementation for coherent terrain
// ═══════════════════════════════════════════════════════════════════════════════
class SeededNoise {
  constructor(rng) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    
    this.F2 = 0.5 * (Math.sqrt(3) - 1);
    this.G2 = (3 - Math.sqrt(3)) / 6;
  }

  noise2D(xin, yin) {
    const { perm, permMod12, grad3, F2, G2 } = this;
    let n0, n1, n2;
    
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];
    
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 < 0) n0 = 0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0);
    }
    
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 < 0) n1 = 0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1);
    }
    
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 < 0) n2 = 0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2);
    }
    
    return 70 * (n0 + n1 + n2);
  }

  fractalNoise(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    return total / maxValue;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIOME CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const BIOMES = {
  grassland: {
    name: 'Grassland',
    heightScale: 8,
    noiseScale: 0.08,
    octaves: 4,
    colors: { deep: 0x1a472a, low: 0x2d5a27, mid: 0x4a7c23, high: 0x7cb342, peak: 0xa5d64a },
    wireColor: 0x1b5e20,
    thresholds: { deep: -0.3, low: 0, mid: 0.3, high: 0.6 }
  },
  desert: {
    name: 'Desert',
    heightScale: 6,
    noiseScale: 0.06,
    octaves: 3,
    colors: { deep: 0x8b4513, low: 0xc19a6b, mid: 0xd4a574, high: 0xe6c99a, peak: 0xfae5c3 },
    wireColor: 0x8b5a2b,
    thresholds: { deep: -0.4, low: -0.1, mid: 0.2, high: 0.5 }
  },
  tundra: {
    name: 'Tundra',
    heightScale: 5,
    noiseScale: 0.05,
    octaves: 5,
    colors: { deep: 0x2f4f4f, low: 0x607d8b, mid: 0x90a4ae, high: 0xb0bec5, peak: 0xeceff1 },
    wireColor: 0x455a64,
    thresholds: { deep: -0.35, low: -0.05, mid: 0.25, high: 0.55 }
  },
  volcanic: {
    name: 'Volcanic',
    heightScale: 12,
    noiseScale: 0.07,
    octaves: 4,
    colors: { deep: 0x1a1a1a, low: 0x3d2817, mid: 0x5d4037, high: 0xbf360c, peak: 0xff5722 },
    wireColor: 0xff3d00,
    thresholds: { deep: -0.4, low: -0.1, mid: 0.3, high: 0.7 }
  },
  alien: {
    name: 'Alien World',
    heightScale: 10,
    noiseScale: 0.09,
    octaves: 4,
    colors: { deep: 0x1a0033, low: 0x4a0080, mid: 0x7b1fa2, high: 0x00e676, peak: 0x76ff03 },
    wireColor: 0x00c853,
    thresholds: { deep: -0.35, low: 0, mid: 0.35, high: 0.65 }
  },
  canyon: {
    name: 'Canyon',
    heightScale: 18,
    noiseScale: 0.05,
    octaves: 6,
    colors: { deep: 0x3e2723, low: 0x6d4c41, mid: 0xa1887f, high: 0xd7ccc8, peak: 0xff8a65 },
    wireColor: 0x795548,
    thresholds: { deep: -0.4, low: -0.15, mid: 0.2, high: 0.55 }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURE TYPES
// ═══════════════════════════════════════════════════════════════════════════════
const STRUCTURE_TYPES = {
  cuboid: { name: 'Cuboid', icon: '▢', color: 0x00ffff, defaultHeight: 4, defaultWidth: 2, defaultDepth: 2 },
  pyramid: { name: 'Pyramid', icon: '△', color: 0xffff00, defaultHeight: 5, defaultWidth: 3, defaultDepth: 3 },
  cylinder: { name: 'Cylinder', icon: '○', color: 0xff00ff, defaultHeight: 4, defaultRadius: 1.2, segments: 8 },
  tower: { name: 'Tower', icon: '▣', color: 0x00ff00, defaultHeight: 8, defaultWidth: 1.5, defaultDepth: 1.5 },
  dome: { name: 'Dome', icon: '◠', color: 0xff8800, defaultRadius: 2, segments: 12 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR INTERPOLATION
// ═══════════════════════════════════════════════════════════════════════════════
function lerpColor(c1, c2, t) {
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
  return { r: (r1 + (r2 - r1) * t) / 255, g: (g1 + (g2 - g1) * t) / 255, b: (b1 + (b2 - b1) * t) / 255 };
}

function getVertexColor(height, biome) {
  const { colors, thresholds } = biome;
  if (height < thresholds.deep) return lerpColor(colors.deep, colors.deep, 0);
  if (height < thresholds.low) return lerpColor(colors.deep, colors.low, (height - thresholds.deep) / (thresholds.low - thresholds.deep));
  if (height < thresholds.mid) return lerpColor(colors.low, colors.mid, (height - thresholds.low) / (thresholds.mid - thresholds.low));
  if (height < thresholds.high) return lerpColor(colors.mid, colors.high, (height - thresholds.mid) / (thresholds.high - thresholds.mid));
  return lerpColor(colors.high, colors.peak, Math.min((height - thresholds.high) / (1 - thresholds.high), 1));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN MASK GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════
function generateTerrainMask(structures, gridSize) {
  const mask = new Map();
  structures.forEach(structure => {
    const { gridX, gridZ } = structure;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${gridX + dx},${gridZ + dz}`;
        mask.set(key, { masked: true, isStructure: dx === 0 && dz === 0, structureId: structure.id });
      }
    }
  });
  return mask;
}

function getMaskInfluence(worldX, worldZ, mask, gridSize, cellSize) {
  const halfGrid = (gridSize * cellSize) / 2;
  const gridX = Math.floor((worldX + halfGrid) / cellSize) - Math.floor(gridSize / 2);
  const gridZ = Math.floor((worldZ + halfGrid) / cellSize) - Math.floor(gridSize / 2);
  const cellData = mask.get(`${gridX},${gridZ}`);
  if (!cellData?.masked) return 0;
  
  const cellCenterX = (gridX + 0.5 + Math.floor(gridSize / 2)) * cellSize - halfGrid;
  const cellCenterZ = (gridZ + 0.5 + Math.floor(gridSize / 2)) * cellSize - halfGrid;
  const dist = Math.sqrt((worldX - cellCenterX) ** 2 + (worldZ - cellCenterZ) ** 2);
  
  if (cellData.isStructure) return 1.0;
  return Math.max(0, 1 - (dist / (cellSize * 0.7)) * 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURE LAYER DATA
// ═══════════════════════════════════════════════════════════════════════════════
function createStructureLayerData(baseSeed, tileX, tileZ, structures = []) {
  return {
    version: '2.0',
    baseSeed,
    tileCoord: { x: tileX, z: tileZ },
    tileSeed: getTileSeed(baseSeed, tileX, tileZ),
    timestamp: Date.now(),
    structures: structures.map(s => ({ 
      id: s.id, type: s.type, gridX: s.gridX, gridZ: s.gridZ, 
      width: s.width, height: s.height, depth: s.depth, radius: s.radius 
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREE.JS SCENE MANAGER - Now with multi-tile support
// ═══════════════════════════════════════════════════════════════════════════════
class TerrainSceneManager {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x050505);
    container.appendChild(this.renderer.domElement);
    
    this.camera.position.set(40, 30, 40);
    this.camera.lookAt(0, 0, 0);
    
    this.scene.fog = new THREE.Fog(0x050505, 80, 200);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(50, 50, 25);
    this.scene.add(dirLight);
    
    this.terrainGroup = new THREE.Group();
    this.adjacentTerrainGroup = new THREE.Group();
    this.structureGroup = new THREE.Group();
    this.gridGroup = new THREE.Group();
    this.maskGroup = new THREE.Group();
    this.hoverIndicator = null;
    this.tileBoundaries = new THREE.Group();
    
    this.scene.add(this.terrainGroup);
    this.scene.add(this.adjacentTerrainGroup);
    this.scene.add(this.structureGroup);
    this.scene.add(this.gridGroup);
    this.scene.add(this.maskGroup);
    this.scene.add(this.tileBoundaries);
    
    this.spherical = new THREE.Spherical(60, Math.PI / 4, Math.PI / 4);
    this.camera.position.setFromSpherical(this.spherical);
    this.camera.lookAt(0, 0, 0);
    
    this.setupControls();
    this.createBaseGrid();
    this.animate();
    
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }
  
  setupControls() {
    let isDragging = false;
    let prev = { x: 0, y: 0 };
    
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) isDragging = true;
      prev = { x: e.clientX, y: e.clientY };
    });
    
    this.renderer.domElement.addEventListener('mousemove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      if (isDragging) {
        this.spherical.theta -= (e.clientX - prev.x) * 0.01;
        this.spherical.phi -= (e.clientY - prev.y) * 0.01;
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.1, this.spherical.phi));
        this.camera.position.setFromSpherical(this.spherical);
        this.camera.lookAt(0, 0, 0);
        prev = { x: e.clientX, y: e.clientY };
      }
    });
    
    this.renderer.domElement.addEventListener('mouseup', () => isDragging = false);
    this.renderer.domElement.addEventListener('mouseleave', () => isDragging = false);
    
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius = Math.max(20, Math.min(180, this.spherical.radius + e.deltaY * 0.08));
      this.camera.position.setFromSpherical(this.spherical);
      this.camera.lookAt(0, 0, 0);
    }, { passive: false });
  }
  
  createBaseGrid() {
    const gridHelper = new THREE.GridHelper(300, 150, 0x2a2a2a, 0x1a1a1a);
    gridHelper.position.y = -0.1;
    this.scene.add(gridHelper);
  }
  
  // Generate a single terrain tile with world-space coordinate offset
  // Uses GLOBAL noise (from base seed) for seamless joins across all tiles
  generateTerrainTile(baseSeed, biomeType, resolution, size, tileX, tileZ, mask, gridSize, cellSize, flattenHeight, isCenter = false) {
    const biome = BIOMES[biomeType] || BIOMES.grassland;
    
    // CRITICAL: Use the SAME seed (base seed) for ALL tiles to ensure seamless noise
    // Each tile is just a "window" into the global noise field at different coordinates
    const rng = new SeededRNG(baseSeed);
    const noise = new SeededNoise(rng);
    
    const geo = new THREE.PlaneGeometry(size, size, resolution, resolution);
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position.array;
    const colors = new Float32Array(positions.length);
    const vertexCount = (resolution + 1) * (resolution + 1);
    
    // World offset based on tile coordinates
    const offsetX = tileX * size;
    const offsetZ = tileZ * size;
    
    for (let i = 0; i < vertexCount; i++) {
      const localX = positions[i * 3];
      const localZ = positions[i * 3 + 2];
      
      // WORLD-SPACE coordinates for seamless noise across tiles
      const worldX = localX + offsetX;
      const worldZ = localZ + offsetZ;
      
      let height = noise.fractalNoise(worldX * biome.noiseScale, worldZ * biome.noiseScale, biome.octaves, 2.0, 0.5);
      height += noise.noise2D(worldX * biome.noiseScale * 3, worldZ * biome.noiseScale * 3) * 0.15;
      height = Math.max(-1, Math.min(1, height));
      
      // Only apply mask to center tile
      let finalHeight = height;
      if (isCenter && mask && mask.size > 0) {
        const influence = getMaskInfluence(localX, localZ, mask, gridSize, cellSize);
        if (influence > 0) finalHeight = height * (1 - influence) + flattenHeight * influence;
      }
      
      positions[i * 3 + 1] = finalHeight * biome.heightScale;
      const color = getVertexColor(finalHeight, biome);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    
    const solidMat = new THREE.MeshBasicMaterial({ 
      vertexColors: true, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: isCenter ? 0.95 : 0.7 
    });
    const solidMesh = new THREE.Mesh(geo, solidMat);
    solidMesh.position.set(offsetX, 0, offsetZ);
    
    const wireMat = new THREE.MeshBasicMaterial({ 
      color: biome.wireColor, 
      wireframe: true, 
      transparent: true, 
      opacity: isCenter ? 0.6 : 0.25 
    });
    const wireMesh = new THREE.Mesh(geo.clone(), wireMat);
    wireMesh.position.set(offsetX, 0, offsetZ);
    
    return { solid: solidMesh, wire: wireMesh };
  }
  
  // Generate center tile only (editor mode)
  generateTerrain(seed, biomeType, resolution, size, mask, gridSize, cellSize, flattenHeight) {
    while (this.terrainGroup.children.length) this.terrainGroup.remove(this.terrainGroup.children[0]);
    
    const { solid, wire } = this.generateTerrainTile(seed, biomeType, resolution, size, 0, 0, mask, gridSize, cellSize, flattenHeight, true);
    this.terrainGroup.add(solid);
    this.terrainGroup.add(wire);
  }
  
  // Generate all 9 tiles for preview mode
  generatePreviewTerrain(baseSeed, biomeType, resolution, size, mask, gridSize, cellSize, flattenHeight) {
    while (this.terrainGroup.children.length) this.terrainGroup.remove(this.terrainGroup.children[0]);
    while (this.adjacentTerrainGroup.children.length) this.adjacentTerrainGroup.remove(this.adjacentTerrainGroup.children[0]);
    while (this.tileBoundaries.children.length) this.tileBoundaries.remove(this.tileBoundaries.children[0]);
    
    // Generate all 9 tiles using the SAME base seed for seamless terrain
    Object.entries(TILE_DIRECTIONS).forEach(([key, tileInfo]) => {
      const isCenter = key === 'C';
      const tileMask = isCenter ? mask : null;
      
      const { solid, wire } = this.generateTerrainTile(
        baseSeed, biomeType, resolution, size, 
        tileInfo.x, tileInfo.z, tileMask, gridSize, cellSize, flattenHeight, isCenter
      );
      
      if (isCenter) {
        this.terrainGroup.add(solid);
        this.terrainGroup.add(wire);
      } else {
        this.adjacentTerrainGroup.add(solid);
        this.adjacentTerrainGroup.add(wire);
      }
    });
    
    // Add tile boundary indicators
    this.createTileBoundaries(size);
  }
  
  createTileBoundaries(size) {
    const halfSize = size / 2;
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });
    
    // Create boundary lines for all 9 tiles
    for (let tx = -1; tx <= 1; tx++) {
      for (let tz = -1; tz <= 1; tz++) {
        const cx = tx * size;
        const cz = tz * size;
        
        const points = [
          new THREE.Vector3(cx - halfSize, 0.3, cz - halfSize),
          new THREE.Vector3(cx + halfSize, 0.3, cz - halfSize),
          new THREE.Vector3(cx + halfSize, 0.3, cz + halfSize),
          new THREE.Vector3(cx - halfSize, 0.3, cz + halfSize),
          new THREE.Vector3(cx - halfSize, 0.3, cz - halfSize),
        ];
        
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const isCenter = tx === 0 && tz === 0;
        const line = new THREE.Line(geo, isCenter 
          ? new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 })
          : boundaryMaterial
        );
        this.tileBoundaries.add(line);
        
        // Add tile label
        if (!isCenter) {
          const labelGeo = new THREE.PlaneGeometry(3, 1.5);
          labelGeo.rotateX(-Math.PI / 2);
          const labelMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
          const labelMesh = new THREE.Mesh(labelGeo, labelMat);
          labelMesh.position.set(cx, 0.2, cz - halfSize + 2);
          this.tileBoundaries.add(labelMesh);
        }
      }
    }
  }
  
  clearAdjacentTerrain() {
    while (this.adjacentTerrainGroup.children.length) this.adjacentTerrainGroup.remove(this.adjacentTerrainGroup.children[0]);
    while (this.tileBoundaries.children.length) this.tileBoundaries.remove(this.tileBoundaries.children[0]);
  }
  
  updateStructureGrid(gridSize, cellSize, mask) {
    while (this.gridGroup.children.length) this.gridGroup.remove(this.gridGroup.children[0]);
    while (this.maskGroup.children.length) this.maskGroup.remove(this.maskGroup.children[0]);
    
    const halfGrid = (gridSize * cellSize) / 2;
    const points = [];
    
    for (let i = 0; i <= gridSize; i++) {
      const pos = i * cellSize - halfGrid;
      points.push(new THREE.Vector3(pos, 0.1, -halfGrid), new THREE.Vector3(pos, 0.1, halfGrid));
      points.push(new THREE.Vector3(-halfGrid, 0.1, pos), new THREE.Vector3(halfGrid, 0.1, pos));
    }
    
    this.gridGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 })
    ));
    
    if (mask && mask.size > 0) {
      mask.forEach((data, key) => {
        const [gx, gz] = key.split(',').map(Number);
        const worldX = (gx + 0.5 + Math.floor(gridSize / 2)) * cellSize - halfGrid;
        const worldZ = (gz + 0.5 + Math.floor(gridSize / 2)) * cellSize - halfGrid;
        
        const cellGeo = new THREE.PlaneGeometry(cellSize * 0.9, cellSize * 0.9);
        cellGeo.rotateX(-Math.PI / 2);
        const cellMesh = new THREE.Mesh(cellGeo, new THREE.MeshBasicMaterial({
          color: data.isStructure ? 0x00ffff : 0x004444,
          transparent: true, opacity: 0.4, side: THREE.DoubleSide
        }));
        cellMesh.position.set(worldX, 0.15, worldZ);
        this.maskGroup.add(cellMesh);
      });
    }
  }
  
  updateStructures(structures, gridSize, cellSize, baseHeight) {
    while (this.structureGroup.children.length) this.structureGroup.remove(this.structureGroup.children[0]);
    
    const halfGrid = (gridSize * cellSize) / 2;
    
    structures.forEach(structure => {
      const worldX = (structure.gridX + 0.5 + Math.floor(gridSize / 2)) * cellSize - halfGrid;
      const worldZ = (structure.gridZ + 0.5 + Math.floor(gridSize / 2)) * cellSize - halfGrid;
      const structType = STRUCTURE_TYPES[structure.type];
      const color = structType.color;
      
      let geo, yOffset = baseHeight;
      
      switch (structure.type) {
        case 'cuboid':
        case 'tower':
          const w = structure.width || structType.defaultWidth;
          const h = structure.height || structType.defaultHeight;
          const d = structure.depth || structType.defaultDepth;
          geo = new THREE.BoxGeometry(w, h, d);
          yOffset += h / 2;
          break;
        case 'pyramid':
          const pw = structure.width || structType.defaultWidth;
          const ph = structure.height || structType.defaultHeight;
          geo = new THREE.ConeGeometry(pw / 2, ph, 4);
          geo.rotateY(Math.PI / 4);
          yOffset += ph / 2;
          break;
        case 'cylinder':
          const cr = structure.radius || structType.defaultRadius;
          const ch = structure.height || structType.defaultHeight;
          geo = new THREE.CylinderGeometry(cr, cr, ch, structType.segments);
          yOffset += ch / 2;
          break;
        case 'dome':
          const dr = structure.radius || structType.defaultRadius;
          geo = new THREE.SphereGeometry(dr, structType.segments, structType.segments, 0, Math.PI * 2, 0, Math.PI / 2);
          break;
        default: return;
      }
      
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 }));
      mesh.position.set(worldX, yOffset, worldZ);
      this.structureGroup.add(mesh);
      
      const lineSegments = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }));
      lineSegments.position.set(worldX, yOffset, worldZ);
      this.structureGroup.add(lineSegments);
    });
  }
  
  updateHoverIndicator(hoveredCell, gridSize, cellSize, selectedTool) {
    if (this.hoverIndicator) {
      this.scene.remove(this.hoverIndicator);
      this.hoverIndicator = null;
    }
    if (!hoveredCell) return;
    
    const halfGrid = (gridSize * cellSize) / 2;
    const worldX = (hoveredCell.x + 0.5) * cellSize - halfGrid;
    const worldZ = (hoveredCell.z + 0.5) * cellSize - halfGrid;
    const hc = cellSize * 0.48;
    
    const points = [
      new THREE.Vector3(worldX - hc, 0.2, worldZ - hc),
      new THREE.Vector3(worldX + hc, 0.2, worldZ - hc),
      new THREE.Vector3(worldX + hc, 0.2, worldZ + hc),
      new THREE.Vector3(worldX - hc, 0.2, worldZ + hc),
      new THREE.Vector3(worldX - hc, 0.2, worldZ - hc),
    ];
    
    const color = selectedTool ? STRUCTURE_TYPES[selectedTool]?.color || 0xffffff : 0xffffff;
    this.hoverIndicator = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color }));
    this.scene.add(this.hoverIndicator);
  }
  
  getHoveredCell(gridSize, cellSize) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersectPoint = new THREE.Vector3();
    
    if (this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
      const halfGrid = (gridSize * cellSize) / 2;
      if (Math.abs(intersectPoint.x) <= halfGrid && Math.abs(intersectPoint.z) <= halfGrid) {
        return {
          x: Math.floor((intersectPoint.x + halfGrid) / cellSize),
          z: Math.floor((intersectPoint.z + halfGrid) / cellSize)
        };
      }
    }
    return null;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
  
  resize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  dispose() {
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINIMAP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function Minimap({ seed, biomeType }) {
  const canvasRef = useRef(null);
  const biome = BIOMES[biomeType] || BIOMES.grassland;
  
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = 120;
    canvas.width = size;
    canvas.height = size;
    
    const rng = new SeededRNG(seed);
    const noise = new SeededNoise(rng);
    const imageData = ctx.createImageData(size, size);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / size - 0.5) * 2 * biome.noiseScale * 50;
        const ny = (y / size - 0.5) * 2 * biome.noiseScale * 50;
        const height = Math.max(-1, Math.min(1, noise.fractalNoise(nx, ny, biome.octaves, 2.0, 0.5)));
        const color = getVertexColor(height, biome);
        const idx = (y * size + x) * 4;
        imageData.data[idx] = Math.floor(color.r * 255);
        imageData.data[idx + 1] = Math.floor(color.g * 255);
        imageData.data[idx + 2] = Math.floor(color.b * 255);
        imageData.data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < size; i += 2) ctx.fillRect(0, i, size, 1);
    ctx.strokeStyle = `#${biome.wireColor.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }, [seed, biomeType]);
  
  return <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated' }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ProceduralTerrainV2() {
  const containerRef = useRef(null);
  const sceneManagerRef = useRef(null);
  
  const [seed, setSeed] = useState('cosmic-landscape-42');
  const [biome, setBiome] = useState('grassland');
  const [resolution, setResolution] = useState(64);
  const [editorMode, setEditorMode] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [showSeedPanel, setShowSeedPanel] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [structures, setStructures] = useState([]);
  const [gridSize, setGridSize] = useState(16);
  const [cellSize, setCellSize] = useState(3);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tileSize] = useState(50);
  
  const terrainMask = useMemo(() => generateTerrainMask(structures, gridSize), [structures, gridSize]);
  const adjacentSeeds = useMemo(() => getAdjacentTileSeeds(seed), [seed]);
  
  // Disable editor mode when preview is enabled
  useEffect(() => {
    if (previewMode && editorMode) {
      setEditorMode(false);
    }
  }, [previewMode]);
  
  // Disable preview mode when editor is enabled
  useEffect(() => {
    if (editorMode && previewMode) {
      setPreviewMode(false);
      sceneManagerRef.current?.clearAdjacentTerrain();
    }
  }, [editorMode]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    sceneManagerRef.current = new TerrainSceneManager(containerRef.current);
    const handleResize = () => sceneManagerRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      sceneManagerRef.current?.dispose();
    };
  }, []);
  
  useEffect(() => {
    if (!sceneManagerRef.current) return;
    
    if (previewMode) {
      // Generate all 9 tiles
      sceneManagerRef.current.generatePreviewTerrain(seed, biome, resolution, tileSize, terrainMask, gridSize, cellSize, 0);
    } else {
      // Generate only center tile
      sceneManagerRef.current.clearAdjacentTerrain();
      sceneManagerRef.current.generateTerrain(seed, biome, resolution, tileSize, terrainMask, gridSize, cellSize, 0);
    }
    
    sceneManagerRef.current.updateStructureGrid(gridSize, cellSize, terrainMask);
    sceneManagerRef.current.updateStructures(structures, gridSize, cellSize, 0);
  }, [seed, biome, resolution, terrainMask, gridSize, cellSize, structures, previewMode, tileSize]);
  
  useEffect(() => {
    if (!sceneManagerRef.current || !editorMode) return;
    const interval = setInterval(() => {
      const cell = sceneManagerRef.current.getHoveredCell(gridSize, cellSize);
      setHoveredCell(cell);
      sceneManagerRef.current.updateHoverIndicator(cell, gridSize, cellSize, selectedTool);
    }, 50);
    return () => clearInterval(interval);
  }, [editorMode, gridSize, cellSize, selectedTool]);
  
  useEffect(() => {
    if (!sceneManagerRef.current || !editorMode) return;
    const handleClick = () => {
      const cell = sceneManagerRef.current.getHoveredCell(gridSize, cellSize);
      if (!cell) return;
      
      const gridX = cell.x - Math.floor(gridSize / 2);
      const gridZ = cell.z - Math.floor(gridSize / 2);
      const existing = structures.find(s => s.gridX === gridX && s.gridZ === gridZ);
      
      if (existing) {
        setStructures(prev => prev.filter(s => s.id !== existing.id));
      } else if (selectedTool) {
        const structType = STRUCTURE_TYPES[selectedTool];
        setStructures(prev => [...prev, {
          id: `struct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: selectedTool, gridX, gridZ,
          width: structType.defaultWidth, height: structType.defaultHeight,
          depth: structType.defaultDepth, radius: structType.defaultRadius,
        }]);
      }
    };
    
    const el = containerRef.current;
    el?.addEventListener('click', handleClick);
    return () => el?.removeEventListener('click', handleClick);
  }, [editorMode, selectedTool, structures, gridSize, cellSize]);
  
  const randomizeSeed = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let newSeed = '';
    for (let i = 0; i < 16; i++) newSeed += chars[Math.floor(Math.random() * chars.length)];
    setSeed(newSeed);
    setStructures([]);
  };
  
  const handleExport = () => {
    // Export structure layer for center tile (0,0)
    const data = createStructureLayerData(seed, 0, 0, structures);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrain-structures-${seed}-tile-0-0.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const biomeData = BIOMES[biome] || BIOMES.grassland;
  const wireColorHex = `#${biomeData.wireColor.toString(16).padStart(6, '0')}`;
  
  const panelStyle = { background: 'rgba(0,0,0,0.9)', border: '1px solid #333', padding: '12px', color: '#0f0', fontFamily: 'monospace', fontSize: '11px' };
  const inputStyle = { background: '#111', border: '1px solid #333', color: '#0f0', padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px', width: '100%', boxSizing: 'border-box' };
  const btnStyle = { background: '#1a1a1a', border: '1px solid #0f0', color: '#0f0', padding: '6px 12px', cursor: 'pointer', fontFamily: 'monospace' };
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', fontFamily: 'monospace', overflow: 'hidden', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Control Panel */}
      <div style={{ ...panelStyle, position: 'absolute', top: '16px', left: '16px', minWidth: '220px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', boxShadow: '0 0 20px rgba(0,255,0,0.1)' }}>
        <div style={{ borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '12px', letterSpacing: '3px', fontSize: '14px' }}>◈ TERRAIN V2</div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', opacity: 0.7 }}>SEED</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={randomizeSeed} style={btnStyle}>RND</button>
          </div>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', opacity: 0.7 }}>BIOME</label>
          <select value={biome} onChange={(e) => setBiome(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {Object.keys(BIOMES).map(b => <option key={b} value={b}>{BIOMES[b].name.toUpperCase()}</option>)}
          </select>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', opacity: 0.7 }}>RESOLUTION: {resolution}</label>
          <input type="range" min="16" max="128" step="8" value={resolution} onChange={(e) => setResolution(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#0f0' }} />
        </div>
        
        <div style={{ borderTop: '1px solid #333', paddingTop: '8px', marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', opacity: 0.7 }}>GRID: {gridSize}x{gridSize}</label>
          <input type="range" min="8" max="24" step="2" value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#0f0' }} />
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', opacity: 0.7 }}>CELL SIZE: {cellSize}u</label>
          <input type="range" min="2" max="5" step="0.5" value={cellSize} onChange={(e) => setCellSize(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#0f0' }} />
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={editorMode} onChange={(e) => setEditorMode(e.target.checked)} style={{ accentColor: '#0f0' }} disabled={previewMode} />
          EDITOR MODE
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={previewMode} onChange={(e) => setPreviewMode(e.target.checked)} style={{ accentColor: '#ff6600' }} disabled={editorMode} />
          <span style={{ color: previewMode ? '#ff6600' : '#0f0' }}>PREVIEW MODE</span>
        </label>
        
        {previewMode && (
          <button onClick={() => setShowSeedPanel(!showSeedPanel)}
            style={{ ...btnStyle, borderColor: '#ff6600', color: '#ff6600', marginTop: '4px' }}>
            {showSeedPanel ? 'HIDE' : 'SHOW'} TILE SEEDS
          </button>
        )}
      </div>
      
      {/* Adjacent Seeds Panel */}
      {previewMode && showSeedPanel && (
        <div style={{ ...panelStyle, position: 'absolute', top: '16px', left: '250px', border: '1px solid #ff6600', minWidth: '320px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', boxShadow: '0 0 20px rgba(255,102,0,0.2)' }}>
          <div style={{ borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '12px', letterSpacing: '2px', fontSize: '12px', color: '#ff6600' }}>◈ ADJACENT TILE SEEDS</div>
          
          {/* Visual grid representation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '16px' }}>
            {['NW', 'N', 'NE', 'W', 'C', 'E', 'SW', 'S', 'SE'].map(key => {
              const tileInfo = adjacentSeeds[key];
              const isCenter = key === 'C';
              return (
                <div key={key} style={{
                  padding: '8px 4px',
                  background: isCenter ? 'rgba(0,255,0,0.2)' : 'rgba(255,102,0,0.1)',
                  border: `1px solid ${isCenter ? '#00ff00' : '#ff6600'}`,
                  textAlign: 'center',
                  fontSize: '10px',
                }}>
                  <div style={{ fontWeight: 'bold', color: isCenter ? '#00ff00' : '#ff6600' }}>{key}</div>
                  <div style={{ opacity: 0.7, fontSize: '8px' }}>{tileInfo.x},{tileInfo.z}</div>
                </div>
              );
            })}
          </div>
          
          {/* Seed list */}
          <div style={{ fontSize: '10px' }}>
            {Object.entries(adjacentSeeds).map(([key, tileInfo]) => {
              const isCenter = key === 'C';
              return (
                <div key={key} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '6px 4px',
                  borderBottom: '1px solid #222',
                  background: isCenter ? 'rgba(0,255,0,0.1)' : 'transparent',
                }}>
                  <span style={{ color: isCenter ? '#00ff00' : '#ff6600', minWidth: '70px' }}>
                    {key} ({tileInfo.x},{tileInfo.z})
                  </span>
                  <span style={{ fontFamily: 'monospace', color: isCenter ? '#00ff00' : '#888', fontSize: '9px' }}>
                    {tileInfo.seed}
                  </span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(tileInfo.seed)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#666', 
                      cursor: 'pointer',
                      padding: '0 4px',
                      fontSize: '10px'
                    }}
                    title="Copy seed"
                  >
                    ⧉
                  </button>
                </div>
              );
            })}
          </div>
          
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #333', opacity: 0.6, fontSize: '9px', color: '#ff6600' }}>
            TILE SIZE: {tileSize}u × {tileSize}u<br/>
            ─────────────────────────<br/>
            ALL TILES USE BASE SEED FOR<br/>
            SEAMLESS TERRAIN GENERATION<br/>
            ─────────────────────────<br/>
            TILE SEEDS = UNIQUE IDs FOR<br/>
            STRUCTURE LAYER EXPORTS
          </div>
        </div>
      )}
      
      {/* Editor Panel */}
      {editorMode && (
        <div style={{ ...panelStyle, position: 'absolute', bottom: '16px', left: '16px', border: '1px solid #00ff00', minWidth: '280px', boxShadow: '0 0 20px rgba(0,255,0,0.2)' }}>
          <div style={{ borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '10px', letterSpacing: '2px', fontSize: '12px' }}>◈ MAP EDITOR</div>
          
          <div style={{ marginBottom: '12px' }}>
            <div style={{ opacity: 0.7, marginBottom: '6px' }}>STRUCTURES</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {Object.entries(STRUCTURE_TYPES).map(([key, struct]) => (
                <button key={key} onClick={() => setSelectedTool(selectedTool === key ? null : key)}
                  style={{
                    background: selectedTool === key ? '#003300' : '#1a1a1a',
                    border: `1px solid ${selectedTool === key ? '#00ff00' : '#333'}`,
                    color: `#${struct.color.toString(16).padStart(6, '0')}`,
                    padding: '6px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '14px', minWidth: '36px'
                  }}
                  title={struct.name}>
                  {struct.icon}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ marginBottom: '12px', opacity: 0.7 }}>PLACED: {structures.length} structures</div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleExport} disabled={structures.length === 0}
              style={{ ...btnStyle, opacity: structures.length > 0 ? 1 : 0.5, cursor: structures.length > 0 ? 'pointer' : 'not-allowed' }}>
              EXPORT
            </button>
            <button onClick={() => setStructures([])} disabled={structures.length === 0}
              style={{ ...btnStyle, borderColor: '#f33', color: '#f33', opacity: structures.length > 0 ? 1 : 0.5, cursor: structures.length > 0 ? 'pointer' : 'not-allowed' }}>
              CLEAR
            </button>
          </div>
          
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #333', opacity: 0.6, fontSize: '10px' }}>
            SELECT TOOL → CLICK GRID TO PLACE<br/>CLICK STRUCTURE TO REMOVE
          </div>
        </div>
      )}
      
      {/* Info Panel */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', gap: '12px', color: '#0f0', fontFamily: 'monospace', fontSize: '11px', textShadow: '0 0 4px #0f0' }}>
        <div style={{ background: 'rgba(0,0,0,0.85)', padding: '8px', border: `1px solid ${wireColorHex}`, boxShadow: `0 0 10px ${wireColorHex}40` }}>
          <div style={{ marginBottom: '6px', letterSpacing: '2px' }}>◈ TERRAIN MAP</div>
          <Minimap seed={seed} biomeType={biome} />
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.85)', padding: '8px', border: `1px solid ${wireColorHex}`, boxShadow: `0 0 10px ${wireColorHex}40` }}>
          <div style={{ marginBottom: '4px', letterSpacing: '2px' }}>◈ SYSTEM</div>
          <div>SEED: {seed.substring(0, 12)}</div>
          <div>BIOME: {biomeData.name.toUpperCase()}</div>
          <div>GRID: {gridSize}×{gridSize}</div>
          <div style={{ color: previewMode ? '#ff6600' : '#0f0' }}>
            MODE: {previewMode ? 'PREVIEW (9 TILES)' : editorMode ? 'EDITOR' : 'VIEW'}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div style={{ position: 'absolute', bottom: '16px', right: '16px', color: '#333', fontSize: '10px', letterSpacing: '2px', fontFamily: 'monospace' }}>
        PROCEDURAL TERRAIN v2.0 • {previewMode ? 'ADJACENT TILE PREVIEW' : 'STRUCTURE LAYER'}
      </div>
    </div>
  );
}
