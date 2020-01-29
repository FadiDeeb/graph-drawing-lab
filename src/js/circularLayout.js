import { Vec } from "./util.js";

export class CircularLayout {
    constructor(graph, params) {
        this.graph = graph;
        this.iterationCount = 0;
        this.maxIteration = params.maxIteration || 1000;
        this.radius = params.radius || 450;
    }

    run() {
        while (this.iterationCount < this.maxIteration) {
            this.step();
        }
        this.iterationCount = 0;
    }

    /**
     * Execute one iteration
     */
    step() {
        let nodes = this.graph.nodes();
        let step = 30;
        let N = nodes.length;

        for (let i = 0; i < N; i++) {
            let n = nodes[i];
            let x = this.radius * Math.cos((2 * Math.PI * i) / N);
            let y = this.radius * Math.sin((2 * Math.PI * i) / N);

            let v = new Vec((x - n.x) / step, (y - n.y) / step);
            this.graph.moveNode(n, v,true);
        }

        this.iterationCount++;
    }
}
