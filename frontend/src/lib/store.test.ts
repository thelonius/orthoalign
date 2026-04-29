import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getDisplayTransform } from "./store";
import type { ToothTransform } from "./store";

const IDENTITY: ToothTransform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
};

describe("getDisplayTransform", () => {
  it("возвращает identity, если target не задан", () => {
    const r = getDisplayTransform(undefined, 10, 20);
    expect(r.position).toEqual(IDENTITY.position);
    expect(r.quaternion).toEqual(IDENTITY.quaternion);
  });

  it("на стадии 0 возвращает identity (исходное состояние)", () => {
    const target: ToothTransform = {
      position: [3, -2, 1],
      quaternion: [0, 0, 0.7071, 0.7071], // 90° вокруг Z
    };
    const r = getDisplayTransform(target, 0, 20);
    expect(r.position[0]).toBeCloseTo(0);
    expect(r.position[1]).toBeCloseTo(0);
    expect(r.position[2]).toBeCloseTo(0);
    expect(r.quaternion[3]).toBeCloseTo(1); // identity w
  });

  it("на максимальной стадии возвращает target", () => {
    const target: ToothTransform = {
      position: [3, -2, 1],
      quaternion: [0, 0, 0.7071, 0.7071],
    };
    const r = getDisplayTransform(target, 20, 20);
    expect(r.position[0]).toBeCloseTo(3);
    expect(r.position[1]).toBeCloseTo(-2);
    expect(r.position[2]).toBeCloseTo(1);
    expect(r.quaternion[2]).toBeCloseTo(0.7071);
  });

  it("на половине стадии position линейно интерполируется", () => {
    const target: ToothTransform = {
      position: [4, -2, 6],
      quaternion: [0, 0, 0, 1],
    };
    const r = getDisplayTransform(target, 10, 20);
    expect(r.position[0]).toBeCloseTo(2);
    expect(r.position[1]).toBeCloseTo(-1);
    expect(r.position[2]).toBeCloseTo(3);
  });

  it("кватернион slerp'ится по дуге, а не по хорде (длина = 1)", () => {
    // Поворот на 90° вокруг Z
    const target: ToothTransform = {
      position: [0, 0, 0],
      quaternion: [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)],
    };
    for (const stage of [1, 5, 10, 15, 19]) {
      const r = getDisplayTransform(target, stage, 20);
      const q = r.quaternion;
      const len = Math.hypot(q[0], q[1], q[2], q[3]);
      // После slerp длина кватерниона должна быть 1 (lerp давал бы длину < 1 на полпути).
      expect(len).toBeCloseTo(1, 4);
    }
  });

  it("slerp 90° на половине пути даёт ровно 45°", () => {
    const target: ToothTransform = {
      position: [0, 0, 0],
      quaternion: [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)],
    };
    const r = getDisplayTransform(target, 10, 20);
    // Кватернион 45° вокруг Z: (0, 0, sin(22.5°), cos(22.5°))
    const expected = new THREE.Quaternion(
      0,
      0,
      Math.sin(Math.PI / 8),
      Math.cos(Math.PI / 8),
    );
    expect(r.quaternion[0]).toBeCloseTo(expected.x, 4);
    expect(r.quaternion[1]).toBeCloseTo(expected.y, 4);
    expect(r.quaternion[2]).toBeCloseTo(expected.z, 4);
    expect(r.quaternion[3]).toBeCloseTo(expected.w, 4);
  });

  it("при maxStage=0 возвращает identity (защита от деления на 0)", () => {
    const target: ToothTransform = {
      position: [3, 3, 3],
      quaternion: [0, 0, 0.7071, 0.7071],
    };
    const r = getDisplayTransform(target, 5, 0);
    expect(r.position).toEqual([0, 0, 0]);
  });
});
