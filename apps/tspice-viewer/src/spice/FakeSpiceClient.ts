import {
  type Abcorr,
  type BodyMeta,
  type BodyRef,
  type BodyState,
  type EtSeconds,
  type FrameId,
  type GetBodyStateInput,
  type GetFrameTransformInput,
  type Mat3,
  type SpiceClient,
  type Vec3Km,
  type Vec3KmPerSec,
  J2000_FRAME
} from "./SpiceClient.js";

// NAIF IDs for initial demo scope
export const NAIF_ID_SUN = 10;
export const NAIF_ID_EARTH = 399;
export const NAIF_ID_MOON = 301;

const TWO_PI = Math.PI * 2;

const IDENTITY_MAT3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const BODY_META: readonly BodyMeta[] = [
  { id: NAIF_ID_SUN, name: "SUN", radiusKm: 695_700 },
  { id: NAIF_ID_EARTH, name: "EARTH", radiusKm: 6_371 },
  { id: NAIF_ID_MOON, name: "MOON", radiusKm: 1_737.4 }
];

const NAME_TO_ID = new Map<string, number>(
  BODY_META.flatMap((b) => [
    [b.name, b.id],
    [b.name.toLowerCase(), b.id]
  ])
);

function resolveBodyId(body: BodyRef): number {
  if (typeof body === "number") return body;

  const resolved = NAME_TO_ID.get(body) ?? NAME_TO_ID.get(body.toLowerCase());
  if (resolved === undefined) {
    throw new Error(`FakeSpiceClient: unknown body ref: ${JSON.stringify(body)}`);
  }
  return resolved;
}

function subVec3(a: Vec3Km, b: Vec3Km): Vec3Km {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function subVec3Vel(a: Vec3KmPerSec, b: Vec3KmPerSec): Vec3KmPerSec {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Deterministic toy ephemerides.
 *
 * This is **not** physically accurate. It's only meant to drive an early
 * renderer prototype with stable, non-zero motion.
 */
function getAbsoluteStateInJ2000(bodyId: number, et: EtSeconds): BodyState {
  switch (bodyId) {
    case NAIF_ID_SUN: {
      return {
        positionKm: [0, 0, 0],
        velocityKmPerSec: [0, 0, 0]
      };
    }
    case NAIF_ID_EARTH: {
      // Rough Earth orbit around Sun (circular, ecliptic plane).
      const rKm = 149_597_870.7;
      const periodSec = 365.25 * 24 * 60 * 60;
      const w = TWO_PI / periodSec;
      const t = w * et;

      const x = rKm * Math.cos(t);
      const y = rKm * Math.sin(t);

      const vx = -rKm * w * Math.sin(t);
      const vy = rKm * w * Math.cos(t);

      return {
        positionKm: [x, y, 0],
        velocityKmPerSec: [vx, vy, 0]
      };
    }
    case NAIF_ID_MOON: {
      const earth = getAbsoluteStateInJ2000(NAIF_ID_EARTH, et);

      // Rough Moon orbit around Earth (circular, same plane).
      const rKm = 384_400;
      const periodSec = 27.321661 * 24 * 60 * 60;
      const w = TWO_PI / periodSec;
      const t = w * et;

      const xRel = rKm * Math.cos(t);
      const yRel = rKm * Math.sin(t);

      const vxRel = -rKm * w * Math.sin(t);
      const vyRel = rKm * w * Math.cos(t);

      return {
        positionKm: [earth.positionKm[0] + xRel, earth.positionKm[1] + yRel, 0],
        velocityKmPerSec: [
          earth.velocityKmPerSec[0] + vxRel,
          earth.velocityKmPerSec[1] + vyRel,
          0
        ]
      };
    }
    default: {
      throw new Error(`FakeSpiceClient: unsupported NAIF ID: ${bodyId}`);
    }
  }
}

export class FakeSpiceClient implements SpiceClient {
  listBodies(): readonly BodyMeta[] {
    return BODY_META;
  }

  getBodyMeta(body: BodyRef): BodyMeta | undefined {
    const id = resolveBodyId(body);
    return BODY_META.find((b) => b.id === id);
  }

  getBodyState(input: GetBodyStateInput): BodyState {
    const { target, observer, frame, abcorr, et } = input;

    // Keep these in the signature for API compatibility, even if we ignore them.
    void (abcorr satisfies Abcorr | undefined);

    if (frame !== J2000_FRAME) {
      throw new Error(
        `FakeSpiceClient: only ${J2000_FRAME} is supported (got ${frame})`
      );
    }

    const targetId = resolveBodyId(target);
    const observerId = resolveBodyId(observer);

    const targetState = getAbsoluteStateInJ2000(targetId, et);
    const observerState = getAbsoluteStateInJ2000(observerId, et);

    return {
      positionKm: subVec3(targetState.positionKm, observerState.positionKm),
      velocityKmPerSec: subVec3Vel(
        targetState.velocityKmPerSec,
        observerState.velocityKmPerSec
      )
    };
  }

  getFrameTransform(input: GetFrameTransformInput): Mat3 {
    const { from, to } = input;

    // `et` is included for parity with real SPICE implementations.
    void input.et;

    if (from === to) return IDENTITY_MAT3;

    if (from === J2000_FRAME && to === J2000_FRAME) return IDENTITY_MAT3;

    throw new Error(
      `FakeSpiceClient: frame transforms not implemented (from ${from} to ${to})`
    );
  }
}
