import { Cloth } from "./cloth";
import { PointerInfo, PointerEventTypes, Scene } from "@babylonjs/core";

export class Grabber {
    private scene: Scene;
    private cloth: Cloth;
    private distance = 0.0;

    constructor(scene: Scene, cloth: Cloth) {
        this.scene = scene;
        this.cloth = cloth;
    }

    handlePointerInfo(pointerInfo: PointerInfo): void {
        const pickInfo = pointerInfo.pickInfo;

        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                this.pointerDown(pickInfo);
                break;
            case PointerEventTypes.POINTERUP:
                this.pointerUp();
                break;
            case PointerEventTypes.POINTERMOVE:
                this.pointerMove(pickInfo);
                break;
        }
    }

    pointerDown(pickInfo: PointerInfo["pickInfo"]): void {
        if (!pickInfo?.hit || !pickInfo.pickedPoint) {
            return;
        }
        this.scene.activeCamera?.detachControl();
        this.distance = pickInfo.distance;
        this.cloth.startGrab(pickInfo.pickedPoint);
    }

    pointerMove(pickInfo: PointerInfo["pickInfo"]): void {
        if (!pickInfo || !pickInfo.ray) {
            return;
        }
        const newPosition = pickInfo.ray.origin.add(pickInfo.ray.direction.scale(this.distance));
        this.cloth.moveGrabbed(newPosition);
    }

    pointerUp(): void {
        this.scene.activeCamera?.attachControl();
        this.cloth.endGrab();
    }

}