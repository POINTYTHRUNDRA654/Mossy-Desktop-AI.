import React, { useState } from 'react';
import { Map, RefreshCw, Download, Zap } from 'lucide-react';

const MAP_TYPES = ['Dungeon', 'Overworld', 'Town', 'Castle', 'Cave', 'Forest', 'Desert', 'Tundra', 'Sci-Fi Station'];
const TILE_SIZES = [16, 32, 48, 64];

const TILE_CHARS: Record<string, string> = {
  '#': 'Wall',
  '.': 'Floor',
  '+': 'Door',
  '~': 'Water',
  'T': 'Tree',
  '^': 'Mountain',
  'S': 'Stairs',
  'E': 'Enemy Spawn',
  'X': 'Exit',
  ' ': 'Empty',
};

const TILE_COLORS: Record<string, string> = {
  '#': 'text-slate-400',
  '.': 'text-slate-600',
  '+': 'text-amber-400',
  '~': 'text-blue-400',
  'T': 'text-green-400',
  '^': 'text-slate-300',
  'S': 'text-purple-400',
  'E': 'text-red-400',
  'X': 'text-emerald-400',
};

const generateDungeonASCII = (width: number, height: number, mapType: string): string[][] => {
  const map: string[][] = Array.from({ length: height }, () => Array(width).fill('#'));

  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  const numRooms = Math.floor((width * height) / 80);

  for (let i = 0; i < numRooms; i++) {
    const rw = Math.floor(Math.random() * 6) + 3;
    const rh = Math.floor(Math.random() * 4) + 3;
    const rx = Math.floor(Math.random() * (width - rw - 2)) + 1;
    const ry = Math.floor(Math.random() * (height - rh - 2)) + 1;
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
    for (let dy = ry; dy < ry + rh; dy++) {
      for (let dx = rx; dx < rx + rw; dx++) {
        if (dy >= 0 && dy < height && dx >= 0 && dx < width) map[dy][dx] = '.';
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);
    let cx = ax;
    while (cx !== bx) { if (cx >= 0 && cx < width && ay >= 0 && ay < height) map[ay][cx] = '.'; cx += cx < bx ? 1 : -1; }
    let cy = ay;
    while (cy !== by) { if (bx >= 0 && bx < width && cy >= 0 && cy < height) map[cy][bx] = '.'; cy += cy < by ? 1 : -1; }
  }

  if (mapType === 'Cave' || mapType === 'Forest') {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (map[y][x] === '.' && Math.random() < 0.05) map[y][x] = mapType === 'Forest' ? 'T' : '~';
      }
    }
  }

  if (rooms.length > 0) {
    const first = rooms[0];
    map[Math.floor(first.y + first.h / 2)][Math.floor(first.x + first.w / 2)] = 'S';
    const last = rooms[rooms.length - 1];
    map[Math.floor(last.y + last.h / 2)][Math.floor(last.x + last.w / 2)] = 'X';
  }

  return map;
};

const mapToTiledJSON = (grid: string[][], tileSize: number, tilesetName: string, mapType: string) => {
  const charToId: Record<string, number> = { '#': 1, '.': 2, '+': 3, '~': 4, 'T': 5, '^': 6, 'S': 7, 'E': 8, 'X': 9, ' ': 0 };
  const groundData = grid.flatMap(row => row.map(c => charToId[c] ?? 0));
  const collisionData = grid.flatMap(row => row.map(c => (['#', '^'].includes(c) ? 1 : 0)));

  return {
    height: grid.length,
    width: grid[0]?.length || 0,
    tileheight: tileSize,
    tilewidth: tileSize,
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    nextlayerid: 4,
    nextobjectid: 1,
    properties: [{ name: 'mapType', type: 'string', value: mapType }],
    tilesets: [{
      firstgid: 1,
      source: `${tilesetName}.tsx`,
    }],
    layers: [
      { id: 1, name: 'Ground', type: 'tilelayer', data: groundData, width: grid[0]?.length || 0, height: grid.length, visible: true, opacity: 1, x: 0, y: 0 },
      { id: 2, name: 'Collision', type: 'tilelayer', data: collisionData, width: grid[0]?.length || 0, height: grid.length, visible: false, opacity: 1, x: 0, y: 0 },
    ],
  };
};

const MapForge: React.FC = () => {
  const [mapWidth, setMapWidth] = useState(32);
  const [mapHeight, setMapHeight] = useState(24);
  const [tileSize, setTileSize] = useState(32);
  const [mapType, setMapType] = useState('Dungeon');
  const [tilesetName, setTilesetName] = useState('dungeon_tiles');
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(false);

  const generateMap = () => {
    setLoading(true);
    setTimeout(() => {
      const g = generateDungeonASCII(mapWidth, mapHeight, mapType);
      setGrid(g);
      setLoading(false);
    }, 100);
  };

  const downloadJSON = () => {
    if (!grid) return;
    const json = mapToTiledJSON(grid, tileSize, tilesetName, mapType);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapType.toLowerCase()}_map.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Map className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Map Forge</h1>
          <p className="text-slate-400 text-xs">Tiled-compatible 2D map generator</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Width (tiles)</label>
          <input type="number" value={mapWidth} min={8} max={256} onChange={e => setMapWidth(clamp(parseInt(e.target.value) || 32, 8, 256))} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Height (tiles)</label>
          <input type="number" value={mapHeight} min={8} max={256} onChange={e => setMapHeight(clamp(parseInt(e.target.value) || 24, 8, 256))} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Tile Size (px)</label>
          <select value={tileSize} onChange={e => setTileSize(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
            {TILE_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Map Type</label>
          <select value={mapType} onChange={e => setMapType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
            {MAP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1.5 block">Tileset Name (for .tsx reference)</label>
        <input type="text" value={tilesetName} onChange={e => setTilesetName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={generateMap} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Generate Map Layout
        </button>
        {grid && (
          <button onClick={downloadJSON} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Download .json
          </button>
        )}
      </div>

      {/* ASCII Preview */}
      {grid && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 font-medium mb-2">Map Preview ({mapWidth}×{mapHeight})</p>
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 overflow-auto max-h-64">
            <pre className="font-mono text-[9px] leading-[1.1] select-none">
              {grid.map((row, y) => (
                <span key={y} className="block">
                  {row.map((cell, x) => (
                    <span key={x} className={TILE_COLORS[cell] || 'text-slate-500'}>{cell}</span>
                  ))}
                </span>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
        <p className="text-xs text-slate-500 font-medium mb-2">Tile Legend</p>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
          {Object.entries(TILE_CHARS).filter(([k]) => k !== ' ').map(([char, name]) => (
            <div key={char} className="flex items-center gap-1.5">
              <span className={`font-mono text-sm ${TILE_COLORS[char] || 'text-slate-500'}`}>{char}</span>
              <span className="text-[10px] text-slate-500">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapForge;
