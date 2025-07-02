export class Hash {
    spacing: number;
    tableSize: number;
    cellStart: Int32Array;
    cellEntries: Int32Array;

    queryIds: Int32Array;
    querySize: number = 0;
    
    firstAdjId: Int32Array;
    adjIds: Int32Array;

    constructor(spacing: number, numObjects: number) {
        this.spacing = spacing;
        this.tableSize = 5 * numObjects;
        this.cellStart = new Int32Array(this.tableSize + 1);
        this.cellEntries = new Int32Array(numObjects);
        this.queryIds = new Int32Array(numObjects);
        this.firstAdjId = new Int32Array(numObjects + 1);
        this.adjIds = new Int32Array(10 * numObjects);
    }

    hashCoords(xi: number, yi:number, zi:number): number {
        const h = (xi * 92837111) ^ (yi * 689287499) ^ (zi * 283923481);
        return Math.abs(h) % this.tableSize;
    }

    intCoord(coord: number): number {
        return Math.floor(coord / this.spacing);
    }

    hashPos(pos: Float32Array, id: number): number {
        const xi = this.intCoord(pos[id * 3]);
        const yi = this.intCoord(pos[id * 3 + 1]);
        const zi = this.intCoord(pos[id * 3 + 2]);
        return this.hashCoords(xi, yi, zi);
    }

    create(pos: Float32Array) {
        const numObjects = pos.length / 3;

        this.cellStart.fill(0);
        this.cellEntries.fill(0);

        for (let i = 0; i < numObjects; i++) {
            const h = this.hashPos(pos, i);
            this.cellStart[h]++;
        }

        let start = 0;
        for (let i = 0; i < this.tableSize; i++) {
            start += this.cellStart[i];
            this.cellStart[i] = start;
        }
        this.cellStart[this.tableSize] = start;
        
        for (let i = 0; i < numObjects; i++) {
            const h = this.hashPos(pos, i);
            const index = --this.cellStart[h];
            this.cellEntries[index] = i;
        }
    }

    query(pos: Float32Array, id: number, maxDist: number) {
        const x0 = this.intCoord(pos[id * 3] - maxDist);
        const y0 = this.intCoord(pos[id * 3 + 1] - maxDist);
        const z0 = this.intCoord(pos[id * 3 + 2] - maxDist);
        const x1 = this.intCoord(pos[id * 3] + maxDist);
        const y1 = this.intCoord(pos[id * 3 + 1] + maxDist);
        const z1 = this.intCoord(pos[id * 3 + 2] + maxDist);

        this.querySize = 0;
        for (let xi = x0; xi <= x1; xi++) {
            for (let yi = y0; yi <= y1; yi++) {
                for (let zi = z0; zi <= z1; zi++) {
                    const h = this.hashCoords(xi, yi, zi);
                    const start = this.cellStart[h];
                    const end = this.cellStart[h + 1];
                    for (let i = start; i < end; i++) {
                        this.queryIds[this.querySize++] = this.cellEntries[i];
                    }
                }
            }
        }
    }

    queryAll(pos: Float32Array, maxDist: number): void {
        let num = 0;
        const maxDist2 = maxDist * maxDist;

        for (let i = 0; i < pos.length / 3; i++) {
            const id0 = i;
            this.firstAdjId[id0] = num;
            this.query(pos, id0, maxDist);

            for (let j = 0; j < this.querySize; j++) {
                const id1 = this.queryIds[j];
                if (id1 >= id0) continue;
                const dist2 = (pos[id0 * 3] - pos[id1 * 3]) ** 2 +
                              (pos[id0 * 3 + 1] - pos[id1 * 3 + 1]) ** 2 +
                              (pos[id0 * 3 + 2] - pos[id1 * 3 + 2]) ** 2;
                if (dist2 > maxDist2) continue;
                if (num >= this.adjIds.length) { // Resize adjIds if necessary
                    const newIds = new Int32Array(num * 2);
                    newIds.set(this.adjIds);
                    this.adjIds = newIds;
                }
                this.adjIds[num++] = id1;
            }
        }

        this.firstAdjId[pos.length / 3] = num;
    }
}