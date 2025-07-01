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

    step(dt: number): void {
    }
}