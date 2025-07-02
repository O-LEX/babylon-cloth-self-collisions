import { Hash } from "./hash";

export class Cloth {
    numX: number;
    numY: number;
    numParticles: number;
    pos: Float32Array;
    prevPos: Float32Array;
    restPos: Float32Array;
    vel: Float32Array;
    invMass: Float32Array;
    thickness: number;

    handleCollisions: boolean = true;
    hash: Hash;

    // Constraints
    // Each constraint is defined by two particle indices and a compliance value.
    ids: Int32Array;
    compliances: Float32Array;
    numConstraints: number;
    restLens: Float32Array;

    constructor(numX: number, numY: number, spacing: number, thickness: number, bendingCompliance: number) {
        this.numX = numX;
        this.numY = numY;
        this.numParticles = numX * numY;
        this.pos = new Float32Array(this.numParticles * 3);
        this.prevPos = new Float32Array(this.numParticles * 3);
        this.restPos = new Float32Array(this.numParticles * 3);
        this.vel = new Float32Array(this.numParticles * 3);
        this.invMass = new Float32Array(this.numParticles);
        this.thickness = thickness;

        for (let j = 0; j < numY; j++) {
            for (let i = 0; i < numX; i++) {
                let id = j * numX + i;
                this.pos.set([i * spacing, j * spacing, 0.0], id * 3);
                this.invMass[id] = 1.0;
            }
        }

        const jitter = 0.001 * spacing;
        for (let i = 0; i < this.numParticles; i++) {
            this.pos[i] += (Math.random() * 2.0 - 1.0) * jitter;
        }

        this.hash = new Hash(spacing, this.numParticles);

        this.restPos.set(this.pos);
        this.vel.fill(0.0);

        const numConstraintTypes = 6;
        this.ids = new Int32Array(this.numParticles * numConstraintTypes * 2);
        this.compliances = new Float32Array(this.numParticles * numConstraintTypes);

        const offsets = [0,0, 0,1,  0,0, 1,0,  0,0, 1,1,  0,1, 1,0,  0,0, 0,2,  0,0, 2,0];
        let num = 0;

        const stretchCompliance = 0.0;
		const shearCompliance = 0.0001;

		const compliances = [stretchCompliance, stretchCompliance, shearCompliance, shearCompliance, bendingCompliance, bendingCompliance];
        for (let constType = 0; constType < numConstraintTypes; constType++) {
            for (let j = 0; j < numY; j++) {
                for (let i = 0; i < numX; i++) {
                    let p = constType * 4;

                    const i0 = i + offsets[p];
                    const j0 = j + offsets[p + 1];
                    const i1 = i + offsets[p + 2];
                    const j1 = j + offsets[p + 3];
                    if (i0 < numX && j0 <numY && i1 < numX && j1 < numY) {
                        this.ids[num] = j0 * numX + i0;
                        this.ids[num + 1] = j1 * numX + i1;
                        this.compliances[num / 2] = compliances[constType];
                        num += 2;
                    }
                }
            }
        }

        this.numConstraints = num / 2;
        this.restLens = new Float32Array(this.numConstraints);
        for (let i = 0; i < this.numConstraints; i++) {
            const id0 = this.ids[i * 2];
            const id1 = this.ids[i * 2 + 1];
            const dx = this.restPos[id0 * 3] - this.restPos[id1 * 3];
            const dy = this.restPos[id0 * 3 + 1] - this.restPos[id1 * 3 + 1];
            const dz = this.restPos[id0 * 3 + 2] - this.restPos[id1 * 3 + 2];
            this.restLens[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
    }

    step(frameDT: number, numSubSteps: number, gravity: Float32Array): void {
        const dt = frameDT / numSubSteps;
        const maxVelocity = 0.2 * this.thickness / dt;

        if (this.handleCollisions) {
            this.hash.create(this.pos);
            const maxTravelDist = maxVelocity * frameDT;
            this.hash.queryAll(this.pos, maxTravelDist);
        }

        for (let step = 0; step < numSubSteps; step++) {
            this.prevPos.set(this.pos);
            for (let i = 0; i < this.numParticles; i++) {
                if (this.invMass[i] > 0.0) {
                    this.vel[i * 3] += gravity[0] * dt;
                    this.vel[i * 3 + 1] += gravity[1] * dt;
                    this.vel[i * 3 + 2] += gravity[2] * dt;
                    const v = Math.sqrt(this.vel[i * 3] ** 2 + this.vel[i * 3 + 1] ** 2 + this.vel[i * 3 + 2] ** 2);
                    if (v > maxVelocity) {
                        const scale = maxVelocity / v;
                        this.vel[i * 3] *= scale;
                        this.vel[i * 3 + 1] *= scale;
                        this.vel[i * 3 + 2] *= scale;
                    }
                    this.pos[i * 3] += this.vel[i * 3] * dt;
                    this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
                    this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
                }
            }

            this.solveGroundCollisions();

            this.solveConstraints(dt);
            if (this.handleCollisions) {
                this.solveCollisions(dt);
            }

            for (let i = 0; i < this.numParticles; i++) {
                if (this.invMass[i] === 0.0) continue;
                this.vel[i * 3] = (this.pos[i * 3] - this.prevPos[i * 3]) / dt;
                this.vel[i * 3 + 1] = (this.pos[i * 3 + 1] - this.prevPos[i * 3 + 1]) / dt;
                this.vel[i * 3 + 2] = (this.pos[i * 3 + 2] - this.prevPos[i * 3 + 2]) / dt;
            }
        }
    }

    solveGroundCollisions(): void {
        const groundLevel = this.thickness * 0.5;
        const damping = 0.5;
        for (let i = 0; i < this.numParticles; i++) {
            if (this.invMass[i] === 0.0) continue;
            const y = this.pos[i * 3 + 1];
            if (y < groundLevel) {
                const dx = this.pos[i * 3] - this.prevPos[i * 3];
                const dz = this.pos[i * 3 + 2] - this.prevPos[i * 3 + 2];
                this.pos[i * 3] -= dx * damping;
                this.pos[i * 3 + 1] = groundLevel;
                this.pos[i * 3 + 2] -= dz * damping;
            }
        }
    }

    solveConstraints(dt: number): void {
        for (let i = 0; i < this.numConstraints; i++) {
            const id0 = this.ids[i * 2];
            const id1 = this.ids[i * 2 + 1];
            const w0 = this.invMass[id0];
            const w1 = this.invMass[id1];
            if (w0 + w1 === 0.0) continue;
            const dx = this.pos[id0 * 3] - this.pos[id1 * 3];
            const dy = this.pos[id0 * 3 + 1] - this.pos[id1 * 3 + 1];
            const dz = this.pos[id0 * 3 + 2] - this.pos[id1 * 3 + 2];

            const dist = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
            if (dist === 0.0) continue; // Avoid division by zero
            const restLen = this.restLens[i];
            const C = dist - restLen;
            const alpha = this.compliances[i] / dt / dt;
            const s = -C / (w0 + w1 + alpha);
            const scale0 = s * w0;
            const scale1 = s * w1;

            this.pos[id0 * 3]     += dx * scale0;
            this.pos[id0 * 3 + 1] += dy * scale0;
            this.pos[id0 * 3 + 2] += dz * scale0;

            this.pos[id1 * 3]     -= dx * scale1;
            this.pos[id1 * 3 + 1] -= dy * scale1;
            this.pos[id1 * 3 + 2] -= dz * scale1;
        }
    }

    solveCollisions(dt: number): void {
        const thickness2 = this.thickness * this.thickness;

        for (let i = 0; i < this.numParticles; i++) {
            const w0 = this.invMass[i];
            if (w0 === 0.0) continue;
            const id0 = i;
            const first = this.hash.firstAdjId[id0];
            const last = this.hash.firstAdjId[id0 + 1];

            for (let j = first; j < last; j++) {
                const id1 = this.hash.adjIds[j];
                const w1 = this.invMass[id1];
                if (w1 === 0.0) continue;
                const dx = this.pos[id0 * 3] - this.pos[id1 * 3];
                const dy = this.pos[id0 * 3 + 1] - this.pos[id1 * 3 + 1];
                const dz = this.pos[id0 * 3 + 2] - this.pos[id1 * 3 + 2];
                const dist2 = dx * dx + dy * dy + dz * dz;
                if (dist2 > thickness2 || dist2 === 0.0) continue; // check collision
                const restdx = this.restPos[id0 * 3] - this.restPos[id1 * 3];
                const restdy = this.restPos[id0 * 3 + 1] - this.restPos[id1 * 3 + 1];
                const restdz = this.restPos[id0 * 3 + 2] - this.restPos[id1 * 3 + 2];
                const restDist2 = restdx * restdx + restdy * restdy + restdz * restdz;

                let minDist = this.thickness;
                if (dist2 > restDist2) continue; 
                if (restDist2 < thickness2) minDist = Math.sqrt(restDist2);

                const dist = Math.sqrt(dist2);
                const scale = (minDist - dist) / dist;
                const scale0 = scale * w0 / (w0 + w1);
                const scale1 = scale * w1 / (w0 + w1);

                this.pos[id0 * 3]     += dx * scale0;
                this.pos[id0 * 3 + 1] += dy * scale0;
                this.pos[id0 * 3 + 2] += dz * scale0;
                this.pos[id1 * 3]     -= dx * scale1;
                this.pos[id1 * 3 + 1] -= dy * scale1;
                this.pos[id1 * 3 + 2] -= dz * scale1;

                // friction
                /*
                const vx0 = (this.pos[id0 * 3] - this.prevPos[id0 * 3]) / dt;
                const vy0 = (this.pos[id0 * 3 + 1] - this.prevPos[id0 * 3 + 1]) / dt;
                const vz0 = (this.pos[id0 * 3 + 2] - this.prevPos[id0 * 3 + 2]) / dt;
                const vx1 = (this.pos[id1 * 3] - this.prevPos[id1 * 3]) / dt;
                const vy1 = (this.pos[id1 * 3 + 1] - this.prevPos[id1 * 3 + 1]) / dt;
                const vz1 = (this.pos[id1 * 3 + 2] - this.prevPos[id1 * 3 + 2]) / dt;

                const avx = (vx0 + vx1) * 0.5;
                const avy = (vy0 + vy1) * 0.5;
                const avz = (vz0 + vz1) * 0.5;

                const friction = 0.2;
                this.pos[id0 * 3]     += (avx - vx0) * friction * dt;
                this.pos[id0 * 3 + 1] += (avy - vy0) * friction * dt;
                this.pos[id0 * 3 + 2] += (avz - vz0) * friction * dt;
                this.pos[id1 * 3]     += (avx - vx1) * friction * dt;
                this.pos[id1 * 3 + 1] += (avy - vy1) * friction * dt;
                this.pos[id1 * 3 + 2] += (avz - vz1) * friction * dt;
                */
            }
        }
    }
}