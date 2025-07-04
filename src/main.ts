import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, VertexData, VertexBuffer, StandardMaterial, Color3, CreateGround, PointerInfo} from "@babylonjs/core";
import {Cloth} from "./cloth";
import {Grabber} from "./grabber";

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

    const normals: number[] = [];
    VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
    vertexData.normals = normals;

    vertexData.applyToMesh(clothMesh, true);

    const material = new StandardMaterial("clothMat", scene);
    material.diffuseColor = new Color3(0.5, 0.5, 1);
    material.specularColor = new Color3(0, 0, 0);
    material.emissiveColor = new Color3(0.2, 0.2, 0.5);
    material.backFaceCulling = false;
    clothMesh.material = material;

    return clothMesh;
}

function updateClothMesh(cloth: Cloth, clothMesh: Mesh): void {
    // Update vertex positions
    const posBuffer = clothMesh.getVertexBuffer(VertexBuffer.PositionKind);
    posBuffer?.update(cloth.pos);
    clothMesh.refreshBoundingInfo();

    // Recompute normals
    const indices = clothMesh.getIndices();
    if (!indices) return;

    const normals: number[] = [];
    VertexData.ComputeNormals(cloth.pos, indices, normals);

    // Update normal buffer
    const normalBuffer = clothMesh.getVertexBuffer(VertexBuffer.NormalKind);
    normalBuffer?.update(normals);
}

function createScene(canvas: HTMLCanvasElement, engine: Engine): Scene {
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera("cam", Math.PI / 2, Math.PI / 3, 5, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    const ground = CreateGround("ground", {width: 10, height: 10}, scene);
    ground.isPickable = false;

    const cloth = new Cloth(30, 200, 0.1, 0.08, 0.0001);
    const clothMesh = createClothMesh(cloth, scene);

    const frameDT = 1 / 60;
    const numSubSteps = 10;
    const gravity = new Float32Array([0, -9.81, 0]);

    scene.onBeforeRenderObservable.add(() => {
        cloth.step(frameDT, numSubSteps, gravity);
        updateClothMesh(cloth, clothMesh);
    });

    const grabber = new Grabber(scene, cloth);
    scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
        grabber.handlePointerInfo(pointerInfo);
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