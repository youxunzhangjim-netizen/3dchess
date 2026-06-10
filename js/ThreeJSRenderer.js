import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ThreeJSRenderer {
    constructor(game) {
        this.game = game;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.boardGroup = new THREE.Group();
        this.piecesGroup = new THREE.Group();
        this.highlightGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();

        this.cellSize = 1;
        this.offset = 3.5;
    }

    init3D() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error('Missing #gameCanvas element.');
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101722);

        this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
        this.camera.position.set(12, 14, 16);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 6;
        this.controls.maxDistance = 42;
        this.controls.target.set(0, 0, 0);

        this.scene.add(this.boardGroup);
        this.scene.add(this.piecesGroup);
        this.scene.add(this.highlightGroup);
        this.scene.add(this.labelGroup);

        this.addLighting();
        this.createBoard3D();
        this.addAxisLabels();
        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    addLighting() {
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 0.82));

        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(8, 12, 10);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x94a3b8, 0.42);
        fill.position.set(-10, -6, -8);
        this.scene.add(fill);
    }

    createBoard3D() {
        this.boardGroup.clear();

        const cubeGeometry = new THREE.BoxGeometry(this.cellSize, this.cellSize, this.cellSize);
        const lightMaterial = new THREE.MeshLambertMaterial({
            color: 0xd8e7f5,
            transparent: true,
            opacity: 0.1,
            depthWrite: false
        });
        const darkMaterial = new THREE.MeshLambertMaterial({
            color: 0x496275,
            transparent: true,
            opacity: 0.22,
            depthWrite: false
        });

        for (let z = 0; z < 8; z++) {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const cube = new THREE.Mesh(cubeGeometry, (x + y + z) % 2 === 0 ? lightMaterial : darkMaterial);
                    cube.position.copy(this.toWorld(x, y, z));
                    cube.userData = { type: 'cell', x, y, z };
                    this.boardGroup.add(cube);
                }
            }
        }

        const frameGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 8, 8));
        const frameMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
        const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
        this.boardGroup.add(frame);

        const gridMaterial = new THREE.LineBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.22 });
        for (let i = 0; i <= 8; i++) {
            const p = i - 4;
            this.boardGroup.add(this.makeGridLine([[-4, p, -4], [4, p, -4], [4, p, 4], [-4, p, 4], [-4, p, -4]], gridMaterial));
            this.boardGroup.add(this.makeGridLine([[p, -4, -4], [p, 4, -4], [p, 4, 4], [p, -4, 4], [p, -4, -4]], gridMaterial));
            this.boardGroup.add(this.makeGridLine([[-4, -4, p], [4, -4, p], [4, 4, p], [-4, 4, p], [-4, -4, p]], gridMaterial));
        }
    }

    makeGridLine(points, material) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        return new THREE.Line(geometry, material);
    }

    addAxisLabels() {
        this.labelGroup.clear();

        const labels = [
            ['X', 0xff6b6b, new THREE.Vector3(5.2, -4.8, -4.8)],
            ['Y', 0x22c55e, new THREE.Vector3(-4.8, 5.2, -4.8)],
            ['Z', 0xf59e0b, new THREE.Vector3(-4.8, -4.8, 5.2)]
        ];

        for (const [text, color, position] of labels) {
            const sprite = this.createTextSprite(text, color, 96);
            sprite.position.copy(position);
            sprite.scale.set(1.4, 1.4, 1.4);
            this.labelGroup.add(sprite);
        }

        for (let i = 0; i < 8; i++) {
            const x = this.createTextSprite(String(i), 0xff6b6b, 64);
            x.position.set(i - this.offset, -4.55, -4.55);
            this.labelGroup.add(x);

            const y = this.createTextSprite(String(i), 0x22c55e, 64);
            y.position.set(-4.55, i - this.offset, -4.55);
            this.labelGroup.add(y);

            const z = this.createTextSprite(String(i), 0xf59e0b, 64);
            z.position.set(-4.55, -4.55, i - this.offset);
            this.labelGroup.add(z);
        }
    }

    renderPieces3D(board) {
        this.piecesGroup.clear();

        for (let z = 0; z < 8; z++) {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const piece = board[z][y][x];
                    if (piece) this.addPiece3D(x, y, z, piece);
                }
            }
        }
    }

    addPiece3D(x, y, z, piece) {
        const group = this.createPieceShape(piece);
        group.position.copy(this.toWorld(x, y, z));
        group.userData = { type: 'piece', x, y, z, piece };
        group.traverse((child) => {
            child.userData = { type: 'piece', x, y, z, piece };
        });
        this.piecesGroup.add(group);
    }

    createPieceShape(piece) {
        const color = piece.color === 'white' ? 0xf4f7fb : 0x2b3445;
        const accent = piece.color === 'white' ? 0x38bdf8 : 0xfbbf24;
        const outline = piece.color === 'white' ? 0x7dd3fc : 0xfbbf24;
        const material = new THREE.MeshStandardMaterial({
            color,
            metalness: piece.color === 'white' ? 0.12 : 0.18,
            roughness: piece.color === 'white' ? 0.32 : 0.28,
            emissive: accent,
            emissiveIntensity: piece.color === 'white' ? 0.06 : 0.2
        });
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: accent,
            metalness: 0.2,
            roughness: 0.3,
            emissive: accent,
            emissiveIntensity: piece.color === 'white' ? 0.18 : 0.32
        });
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: outline,
            transparent: true,
            opacity: piece.color === 'white' ? 0.7 : 0.9
        });

        const group = new THREE.Group();
        const add = (mesh, meshMaterial = material) => {
            mesh.material = meshMaterial;
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 24), edgeMaterial);
            edges.renderOrder = 12;
            mesh.add(edges);
            group.add(mesh);
        };

        add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.12, 24), trimMaterial), trimMaterial);

        switch (piece.type) {
            case 'P':
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.32, 24), material));
                group.children[1].position.y = 0.22;
                add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), material));
                group.children[2].position.y = 0.48;
                break;

            case 'R':
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 24), material));
                group.children[1].position.y = 0.26;
                add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.52), trimMaterial), trimMaterial);
                group.children[2].position.y = 0.53;
                break;

            case 'N':
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.34, 18), material));
                group.children[1].position.y = 0.24;
                add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.3), material));
                group.children[2].position.set(0.08, 0.5, 0);
                group.children[2].rotation.z = 0.38;
                break;

            case 'B':
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.42, 24), material));
                group.children[1].position.y = 0.28;
                add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), material));
                group.children[2].position.y = 0.57;
                add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), trimMaterial), trimMaterial);
                group.children[3].position.y = 0.78;
                break;

            case 'Q':
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.46, 24), material));
                group.children[1].position.y = 0.29;
                add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 8), material));
                group.children[2].position.y = 0.66;
                add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), trimMaterial), trimMaterial);
                group.children[3].position.y = 0.88;
                break;

            case 'K':
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.27, 0.48, 24), material));
                group.children[1].position.y = 0.3;
                add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.2, 8), material));
                group.children[2].position.y = 0.68;
                add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), trimMaterial), trimMaterial);
                group.children[3].position.y = 0.92;
                add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), trimMaterial), trimMaterial);
                group.children[4].position.y = 0.96;
                break;

            default:
                add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), material));
                group.children[1].position.y = 0.28;
                break;
        }

        group.scale.setScalar(0.9);
        return group;
    }

    showSelected(x, y, z) {
        this.removeHighlightsByType('selection');

        const geometry = new THREE.BoxGeometry(1.08, 1.08, 1.08);
        const material = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.7,
            wireframe: true,
            depthTest: false
        });

        const box = new THREE.Mesh(geometry, material);
        box.position.copy(this.toWorld(x, y, z));
        box.renderOrder = 20;
        box.userData = { type: 'selection', x, y, z };
        this.highlightGroup.add(box);
    }

    showLegalMoves(moves) {
        this.removeHighlightsByType('legal-move');
        if (!this.game.showMoveHints) return;

        const geometry = new THREE.SphereGeometry(0.18, 24, 16);
        for (const move of moves) {
            const material = new THREE.MeshBasicMaterial({
                color: move.capture ? 0xef4444 : 0x22c55e,
                transparent: true,
                opacity: 0.96,
                depthTest: false,
                depthWrite: false
            });

            const dot = new THREE.Mesh(geometry, material);
            dot.position.copy(this.toWorld(move.x, move.y, move.z));
            dot.renderOrder = 30;
            dot.userData = {
                type: 'legal-move',
                x: move.x,
                y: move.y,
                z: move.z,
                move
            };
            this.highlightGroup.add(dot);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.28, 0.018, 8, 28),
                new THREE.MeshBasicMaterial({
                    color: move.capture ? 0xef4444 : 0x22c55e,
                    transparent: true,
                    opacity: 0.85,
                    depthTest: false,
                    depthWrite: false
                })
            );
            ring.position.copy(dot.position);
            ring.lookAt(this.camera.position);
            ring.renderOrder = 29;
            ring.userData = dot.userData;
            this.highlightGroup.add(ring);
        }
    }

    showChosenMove(x, y, z) {
        this.removeHighlightsByType('chosen-move');

        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 24, 16),
            new THREE.MeshBasicMaterial({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.98,
                depthTest: false,
                depthWrite: false
            })
        );
        dot.position.copy(this.toWorld(x, y, z));
        dot.renderOrder = 35;
        dot.userData = { type: 'chosen-move', x, y, z };
        this.highlightGroup.add(dot);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.38, 0.026, 8, 32),
            new THREE.MeshBasicMaterial({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.96,
                depthTest: false,
                depthWrite: false
            })
        );
        ring.position.copy(dot.position);
        ring.lookAt(this.camera.position);
        ring.renderOrder = 34;
        ring.userData = { type: 'chosen-move', x, y, z };
        this.highlightGroup.add(ring);
    }

    clearChosenMove() {
        this.removeHighlightsByType('chosen-move');
    }

    clearLegalMoveHints() {
        this.removeHighlightsByType('legal-move');
    }

    clearHighlights() {
        this.highlightGroup.clear();
    }

    removeHighlightsByType(type) {
        const remove = this.highlightGroup.children.filter((child) => child.userData?.type === type);
        for (const child of remove) this.highlightGroup.remove(child);
    }

    async onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const hintHits = this.raycaster.intersectObjects(this.highlightGroup.children, true);
        const hint = hintHits.find((hit) => hit.object.userData?.type === 'legal-move');
        if (hint) {
            const { x, y, z } = hint.object.userData;
            await this.game.handleSquareClick(x, y, z);
            return;
        }

        const pieceHits = this.raycaster.intersectObjects(this.piecesGroup.children, true);
        if (pieceHits.length) {
            let obj = pieceHits[0].object;
            while (obj && !obj.userData?.piece) obj = obj.parent;
            if (obj?.userData?.piece) {
                await this.game.handleSquareClick(obj.userData.x, obj.userData.y, obj.userData.z);
                return;
            }
        }

        const cellHits = this.raycaster.intersectObjects(this.boardGroup.children, false);
        const cell = cellHits.find((hit) => hit.object.userData?.type === 'cell');
        if (cell) {
            const { x, y, z } = cell.object.userData;
            await this.game.handleSquareClick(x, y, z);
        }
    }

    resetCamera() {
        if (this.game.currentPlayer === 'black') {
            this.camera.position.set(-12, -14, -16);
        } else {
            this.camera.position.set(12, 14, 16);
        }
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    resize() {
        const canvas = this.renderer.domElement;
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    animate() {
        this.controls.update();
        for (const child of this.highlightGroup.children) {
            if (child.geometry?.type === 'TorusGeometry') child.lookAt(this.camera.position);
        }
        this.renderer.render(this.scene, this.camera);
    }

    toWorld(x, y, z) {
        return new THREE.Vector3(
            x * this.cellSize - this.offset,
            y * this.cellSize - this.offset,
            z * this.cellSize - this.offset
        );
    }

    createTextSprite(text, color = 0xffffff, fontSize = 80) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.font = `800 ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 66);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.55, 0.55, 0.55);
        sprite.renderOrder = 40;
        return sprite;
    }
}
