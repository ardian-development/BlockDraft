import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CompiledStructure } from "./types";

const COLORS: Record<string, number> = {
  stone: 0x8d98a6, wood: 0x9b623c, glass: 0x8ad9e8, roof: 0x394353, accent: 0xf5c542, gold: 0xf4bd2f,
};

function colorFor(blockId: string, material: string): number {
  if (blockId.includes("black_concrete") || blockId.includes("black_wool")) return 0x161b24;
  if (blockId.includes("white_concrete") || blockId.includes("white_wool")) return 0xf2f4f7;
  if (blockId.includes("yellow_concrete") || blockId.includes("yellow_wool")) return 0xf5d547;
  if (blockId.includes("orange_concrete") || blockId.includes("orange_wool")) return 0xe87528;
  if (blockId.includes("red_concrete") || blockId.includes("red_wool")) return 0xd64747;
  if (blockId.includes("light_blue_concrete") || blockId.includes("light_blue_wool")) return 0x4cc7d9;
  if (blockId.includes("blue_concrete") || blockId.includes("blue_wool")) return 0x3f75c5;
  if (blockId.includes("green_concrete") || blockId.includes("green_wool")) return 0x5b8c3a;
  if (blockId.includes("lime_concrete") || blockId.includes("lime_wool")) return 0x83c43b;
  if (blockId.includes("brown_concrete") || blockId.includes("brown_wool")) return 0x8f5b3e;
  if (blockId.includes("purple_concrete") || blockId.includes("purple_wool")) return 0x8e3db4;
  if (blockId.includes("magenta_concrete") || blockId.includes("magenta_wool")) return 0xc34ac7;
  if (blockId.includes("pink_concrete") || blockId.includes("pink_wool")) return 0xe997b8;
  if (blockId.includes("cyan_concrete") || blockId.includes("cyan_wool")) return 0x169c9c;
  if (blockId.includes("light_gray_concrete") || blockId.includes("light_gray_wool")) return 0x9d9d97;
  if (blockId.includes("gray_concrete") || blockId.includes("gray_wool")) return 0x4b4d52;
  return COLORS[material] ?? 0x8d98a6;
}

export function Viewer({ structure }: { structure: CompiledStructure | null }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mount.current || !structure) return;
    const host = mount.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1426);
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xcfe7ff, 0x20283b, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(20, 35, 25);
    scene.add(sun);
    scene.add(new THREE.GridHelper(Math.max(structure.dimensions.x, structure.dimensions.z) + 12, Math.max(structure.dimensions.x, structure.dimensions.z) + 12, 0x43516a, 0x202b41));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x111a2b, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.52;
    scene.add(floor);

    const groups = new Map<string, { material: string; blockId: string; blocks: typeof structure.blocks }>();
    for (const block of structure.blocks) {
      const groupKey = `${block.material}:${block.blockId}`;
      const group = groups.get(groupKey) ?? { material: block.material, blockId: block.blockId, blocks: [] };
      group.blocks.push(block);
      groups.set(groupKey, group);
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const animatedMeshes: Array<{ mesh: THREE.InstancedMesh; blocks: typeof structure.blocks }> = [];
    for (const { material, blockId, blocks } of groups.values()) {
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: colorFor(blockId, material), roughness: material === "glass" ? 0.2 : 0.85, transparent: material === "glass", opacity: material === "glass" ? 0.62 : 1 }), blocks.length);
      const matrix = new THREE.Matrix4();
      blocks.forEach((block, index) => {
        matrix.makeTranslation(block.x, block.y, block.z);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.count = 0;
      animatedMeshes.push({ mesh, blocks });
      scene.add(mesh);
    }
    const controls = new OrbitControls(camera, renderer.domElement);
    const maxDimension = Math.max(structure.dimensions.x, structure.dimensions.y, structure.dimensions.z);
    controls.target.set(structure.dimensions.x / 2, structure.dimensions.y / 2, structure.dimensions.z / 2);
    // The generator contract defines +Z as the front. Bias the initial
    // isometric view toward +Z so paired facial/front details are visible.
    camera.position.set(maxDimension * 0.82, maxDimension * 1.05, maxDimension * 1.72);
    controls.update();

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    let frame = 0;
    const buildStarted = performance.now();
    const buildDuration = Math.min(2_200, 700 + structure.blocks.length * 0.22);
    const animate = (now = performance.now()) => {
      frame = requestAnimationFrame(animate);
      const progress = Math.min(1, (now - buildStarted) / buildDuration);
      const visibleY = progress * Math.max(1, structure.dimensions.y);
      for (const { mesh, blocks } of animatedMeshes) {
        let visible = 0;
        while (visible < blocks.length && blocks[visible].y <= visibleY) visible++;
        mesh.count = visible;
      }
      controls.update(); renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); geometry.dispose();
      // Explicitly release the WebGL context on every regeneration. Without
      // this, repeated previews can accumulate contexts and render a blank or
      // partially updated canvas until the page is reloaded.
      renderer.forceContextLoss();
      renderer.dispose();
      scene.traverse((object) => { if (object instanceof THREE.Mesh && object.geometry !== geometry) object.geometry.dispose(); if (object instanceof THREE.Mesh && Array.isArray(object.material)) object.material.forEach((m) => m.dispose()); else if (object instanceof THREE.Mesh) object.material.dispose(); });
      host.replaceChildren();
    };
  }, [structure]);

  return <div ref={mount} className="viewer" aria-label="3D-Strukturvorschau" />;
}
