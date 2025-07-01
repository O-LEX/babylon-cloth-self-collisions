import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, VertexData, VertexBuffer, StandardMaterial, Color3} from "@babylonjs/core";
import {Cloth} from "./cloth";

function createClothMesh(cloth: Cloth, scene: Scene): Mesh {
    const clothMesh = new Mesh("cloth", scene);
    const indices: number[] = [];
    for (let j = 0; j < cloth.numY - 1; j++) {
      for (let i = 0; i < cloth.numX - 1; i++) {
        const id = j * cloth.numX + i;
        indices.push(id, id + 1, id + cloth.numX);
        indices.push(id + 1, id + cloth.numX + 1, id + cloth.numX);
      }
    }
    
    const vertexData = new VertexData();
    vertexData.positions = cloth.pos;
    vertexData.indices = indices;
    vertexData.applyToMesh(clothMesh, true);

    const material = new StandardMaterial("clothMat", scene);
    material.diffuseColor = new Color3(0.8, 0.2, 0.2);
    material.backFaceCulling = false;
    clothMesh.material = material;

    return clothMesh;
}

function updateClothMesh(cloth: Cloth, clothMesh: Mesh): void {
    clothMesh.getVertexBuffer(VertexBuffer.PositionKind)?.update(cloth.pos);
}


function createScene(canvas: HTMLCanvasElement, engine: Engine): Scene {
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera("cam", Math.PI / 2, Math.PI / 3, 5, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    const cloth = new Cloth(10, 10, 0.1, 0.01, 0.0001);
    const clothMesh = createClothMesh(cloth, scene);

    const dt = 1 / 60;
    engine.runRenderLoop(() => {
        cloth.step(dt);
        updateClothMesh(cloth, clothMesh);
        scene.render();
    });

    return scene;
}

function main() {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const engine = new Engine(canvas, true);
    const scene = createScene(canvas, engine);

    engine.runRenderLoop(() => {
        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });
}

main();