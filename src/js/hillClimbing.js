import { Vec } from "./util.js";

export class HillClimbing {
    constructor(graph, params) {
        this.graph = graph;
        // distance to move the node
        this.squareSize = params.squareSize;
        this.it = 0;
        this.maxIt = params.iterations || 500;
        this.done = false;

        /* 
            Assuming the following
            
                   ^ 0,-1
                   |
          -1.0 <---.---> 1,0
                   |
                   v  0,1

        */

        let v = new Vec(this.squareSize, 0);
        this.vectors = [v];
        for (let a = 45; a < 315; a += 45) {
            this.vectors.push(v.rotate(a));
        }
    }

    // single iteration of the layout algorithm
    step() {
        let nodes = this.graph.nodes();
        let lastObj = this.graph.objective();
        for (let n of nodes) {
            // start with no move as the best move
            let bestMoveIndex = null;
            let bestObj = this.graph.objective();
            for (let i = 0; i < this.vectors.length; i++) {
                this.graph.moveNode(n.id, this.vectors[i]);
                let newObj = this.graph.objective();
                // rest the move
                this.graph.moveNode(n.id, this.vectors[i].scale(-1));

                if (newObj < bestObj) {
                    bestObj = newObj;
                    bestMoveIndex = i;
                }
            }
            if (bestMoveIndex) {
                this.graph.moveNode(n, this.vectors[bestMoveIndex]);
            }
        }
        if (lastObj === this.graph.objective()) {
            this.done = true;
        }
        this.it++;
    }

    // run
    run() {
        this.done = false;
        while (this.it < this.maxIt && !this.done) {
            this.step();
        }
    }
}
