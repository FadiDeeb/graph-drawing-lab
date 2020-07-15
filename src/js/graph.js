const Graph = require("graphology");

import {
    distance,
    random,
    shuffle,
    deepCopy,
    getEdgeId,
    Vec,
    minMaxNorm
} from "./util.js";
import * as evaluator from "./metrics.js";

export { generateGraph, ConcreteGraph };

//TODO: add options for size and color instead of hard coding them
/**
 * Creates a random spanning tree for the given sigma graph.
 *
 * @param {object} G -  ConcreteGraph instance
 * @returns {undefined}
 *
 */
function ranSpanningTree(G) {
    // TODO: Extract rendering details
    const edgeSize = 1.5;
    // deep copy of the existing nodes
    let outTree = Array.from(G.nodes());
    // select the root
    let inTree = [outTree.pop()];

    while (outTree.length) {
        // pick a node from outside the tree
        let source = outTree.pop();
        // pick a random node from the tree
        let target = inTree[random(0, inTree.length - 1)];
        // create an edge
        let edge = {
            id: getEdgeId(source, target),
            size: edgeSize,
            source: source,
            target: target,
            color: "#ccc"
        };
        G.addEdge(edge);
        // add node to tree
        inTree.push(source);
    }
}
/**
 *
 * @param {number} nMin  Minimum number of nodes
 * @param {number} nMax  Maximum number of nodes
 * @param {number} eMin  Minimum number of edges
 * @param {number} eMax  Maximum number of edges
 * @param {object} width Width of the HTML canvas element
 * @param {object} height Height of the HTML canvas element
 * @returns {object} a Sigma graph object
 */
function generateGraph(nMin, nMax, eMin, eMax, width, height) {
    // TODO: Extract rendering details
    const edgeSize = 1.5;
    const nodeSize = 10;
    const x = width;
    const y = height;

    let G = new ConcreteGraph();
    const N = random(nMin, nMax);
    const eLimit = (N * (N - 1)) / 2;
    let E = random(Math.min(eMin, eLimit), Math.min(eMax, eLimit));

    for (let i = 0; i < N; i++) {
        let id = String(G.nextId);
        let n = {
            label: id,
            id: id,
            x: (0.5 - Math.random()) * x,
            y: (0.5 - Math.random()) * y,
            size: nodeSize,
            color: "#921"
        };
        G.addNode(n);
    }
    let nodes = G.nodes();

    // randomize the nodes order to ensure we get random edges
    shuffle(nodes);

    // create a random spanning tree (ST) to guarantee that the graph is connected
    ranSpanningTree(G);
    // subtract edges created by the ST
    E = E - (N - 1);

    // loop until the desired number of edges is reached
    for (let i = 0; E > 0; i = (i + 1) % N) {
        // determine the number of edges allowed for this node in this iteration
        let nEdge = random(0, Math.min(E, N - 1));
        for (let j = 0; j < N && nEdge > 0; j++) {
            // pick a random node to connect to
            let edges = G.edges();

            if (j !== i && !G.hasEdge(nodes[j], nodes[i])) {
                let edge = {
                    id: getEdgeId(nodes[j], nodes[i]),
                    size: edgeSize,
                    source: nodes[i],
                    target: nodes[j],
                    color: "#ccc"
                };
                G.addEdge(edge);
                nEdge--;
                // update total edge count
                E--;
            }
        }
    }
    return G.graph;
}

class ConcreteGraph {
    constructor(graph, options) {
        options = options || {};
        // HACK: Temp solution to keep things up to date with the sigma graph
        // needed until the edge quad tree is ported to v2
        this.sigGraph = options.sigGraph || null;
        this.bounds = {
            xMax: 1000,
            yMax: 1000,
            xMin: -1000,
            yMin: -1000
        };

        this.nextId = 0;
        this.requireEdgeLengthPerc = 0.5;
        this.metricsParam = options.metricsParam || {
            requiredEdgeLength: 0.5
        };
        this.weights = options.weights || {
            nodeOcclusion: 1,
            edgeNodeOcclusion: 1,
            edgeLength: 1,
            edgeCrossing: 1,
            angularResolution: 1
        };
        this.metricsCache = {
            nodeOcclusion: 0,
            edgeNodeOcclusion: 0,
            edgeLength: 0,
            edgeCrossing: 0,
            angularResolution: 0
        };
        this.normalMetrics = {
            nodeOcclusion: 0,
            edgeNodeOcclusion: 0,
            edgeLength: 0,
            edgeCrossing: 0,
            angularResolution: 0
        };
        this.metricsPerNode = {};
        this.edgeCrossingCache = {};
        this.minDist = 10;
        this.maxDist = distance(
            { x: this.bounds.xMax, y: this.bounds.yMax },
            { x: this.bounds.xMin, y: this.bounds.yMin }
        );

        // keep track of number of nodes with deg > 1
        // used to calculate the max value for angularResolution
        this.nodesWithAngles = 0;

        this.graph = new Graph({});
        if (graph) this.read(graph);
    }

    setBounds(bounds) {
        this.bounds = bounds;
        updateBounds.call(this);
    }
    objective() {
        let wSum = 0;
        // normalize the metrics

        let N = this.graph.nodes().length;
        let E = this.graph.edges().length;

        // node node nodeOcclusion
        if (N > 1) {
            let minSum = (N * (N - 1)) / this.maxDist ** 2;
            let maxSum = (N * (N - 1)) / this.minDist ** 2;
            this.normalMetrics.nodeOcclusion = minMaxNorm(
                this.metricsCache.nodeOcclusion || minSum,
                minSum,
                maxSum
            );
        }

        if (E > 0) {
            // edge node occlusion

            // number of connected nodes (part of an edge) and edge
            let EE = 2 * E * (E - 1);
            // number of disconnected nodes (not part of an edge) and edge
            let NE = (N - 2 * E) * E;
            let total = EE + NE;

            let minSum = total / this.maxDist ** 2;
            let maxSum = total / this.minDist ** 2;
            this.normalMetrics.edgeNodeOcclusion = minMaxNorm(
                this.metricsCache.edgeNodeOcclusion || minSum,
                minSum,
                maxSum
            );

            // edge length
            let len = this.metricsParam.requiredEdgeLength * this.maxDist;
            let max = (this.minDist - this.maxDist) ** 2;
            this.normalMetrics.edgeLength = minMaxNorm(
                this.metricsCache.edgeLength,
                0,
                E * max
            );
        }

        // edge crossing
        if (E > 1) {
            this.normalMetrics.edgeCrossing = minMaxNorm(
                this.metricsCache.edgeCrossing,
                0,
                (E * (E - 1)) / 2
            );
        }

        // angular resolution
        if (E > 1) {
            // but if a vertex had E edges than the max angle would be 360/E
            this.normalMetrics.angularResolution = minMaxNorm(
                this.metricsCache.angularResolution,
                0,
                // largest value when all nodes have > 1 edge with 0 deg between them
                this.nodesWithAngles * 360
                //TODO: Are you sure this is correct?
            );
        }

        for (let key in this.normalMetrics)
            wSum += this.normalMetrics[key] * this.weights[key];
        if (!Number.isFinite(wSum) || wSum < 0) {
            throw `invalid weights or metrics\nmetrics:\n ${JSON.stringify(
                this.normalMetrics
            )}\nweights:\n ${JSON.stringify(this.weights)}`;
        }
        return wSum;
    }

    metrics() {
        // to make sure the normalized metrics are up to date
        this.objective();

        return this.normalMetrics;
    }
    setMetricParam(metricsParam) {
        this.status = ConcreteGraph.status.DIRTY;
        this.metricsParam = metricsParam;
        recalculateMetrics.call(this);
    }
    setWeights(weights) {
        this.weights = weights;
        // to ensure the caches of the metrics that were set to 0 are up to date
        recalculateMetrics.call(this);
    }
    // returns the score generated by the move or null if out of bound
    // it doesn't move the node
    testMove(nodeId, vec) {
        let newPos = this.moveNode(nodeId, vec);
        // move is out of bound
        if (!newPos) return null;

        let objective = this.objective();

        // reset the node movement
        this.moveNode(nodeId, vec.scale(-1));
        return objective;
    }
    // effectBounds will determine whether moving outside the bounds will expand them
    // or return an error
    moveNode(nodeId, vec, effectBounds = false) {
        this.status = ConcreteGraph.status.DIRTY;
        let node = this.graph.getNodeAttributes(nodeId);
        let oldPos = { x: node.x, y: node.y };

        let x = node.x + vec.x;
        let y = node.y + vec.y;

        if (!effectBounds && !this.withinBounds(x, y)) {
            return null;
        }

        if (this.sigGraph) {
            let sigNode = this.sigGraph.nodes(nodeId);
            sigNode.x = x;
            sigNode.y = y;
        }
        this.graph.setNodeAttribute(nodeId, "x", x);
        this.graph.setNodeAttribute(nodeId, "y", y);

        updateMetrics.call(this, nodeId, oldPos);
        // recalculate metrics that are hard to update
        this.metricsCache.edgeNodeOcclusion = 0;
        for (let e of this.graph.edges()) {
            this.metricsCache.edgeNodeOcclusion += evaluator.edgeNodeOcclusion(
                this.graph,
                e,
                this.minDist
            );
        }
        if (effectBounds) {
            updateBounds.call(this);
        }
        return { x: node.x, y: node.y };
    }
    // defaults to true since it's mostly used in the ui and we want to
    // always change the bounds there
    setNodePos(nodeId, newPos, effectBounds = true) {
        let node = this.graph.getNodeAttributes(nodeId);
        let a = new Vec(node);
        let b = new Vec(newPos);
        this.moveNode(nodeId, b.sub(a), effectBounds);
    }
    getNodePos(nodeId) {
        let attr = this.getNodeAttributes(nodeId);
        return { x: attr.x, y: attr.y };
    }

    withinBounds(x, y) {
        let { xMax, yMax, xMin, yMin } = this.bounds;
        return x <= xMax && x >= xMin && y <= yMax && y >= yMin;
    }
    // returns the min bounding box
    getBoundaries() {
        let b;

        b = {
            xMax: 0,
            yMax: 0,
            xMin: 0,
            yMin: 0
        };
        for (let nId of this.graph.nodes()) {
            let n = this.graph.getNodeAttributes(nId);
            b.xMax = Math.max(b.xMax, n.x);
            b.xMin = Math.min(b.xMin, n.x);
            b.yMax = Math.max(b.yMax, n.y);
            b.yMin = Math.min(b.yMin, n.y);
        }
        return b;
    }

    density() {
        let V = this.graph.nodes().length;
        let E = this.graph.edges().length;
        let D = (2 * E) / (V * (V - 1)) || 0;
        return D;
    }

    nodes() {
        return this.graph.nodes.apply(this.graph, arguments);
    }

    getNodeAttributes() {
        return this.graph.getNodeAttributes.apply(this.graph, arguments);
    }
    // TODO: add option to provide id as parameter?
    addNode(node) {
        this.status = ConcreteGraph.status.DIRTY;
        node.id = String(this.nextId);
        this.graph.addNode(String(this.nextId), node);
        if (this.sigGraph) {
            node.label = node.label + "";
            this.sigGraph.addNode(node);
        }
        this.nextId++;
        updateBounds.call(this);
        recalculateMetrics.call(this);
    }
    removeNode(nodeId) {
        this.status = ConcreteGraph.status.DIRTY;
        this.graph.dropNode(nodeId);
        if (this.sigGraph) this.sigGraph.dropNode(nodeId);
        updateBounds.call(this);
        recalculateMetrics.call(this);
    }

    addEdge(edge) {
        this.status = ConcreteGraph.status.DIRTY;
        this.graph.addEdgeWithKey(edge.id, edge.source, edge.target, edge);
        if (this.sigGraph) this.sigGraph.addEdge(edge);
        recalculateMetrics.call(this);
    }
    removeEdge(edgeId) {
        this.status = ConcreteGraph.status.DIRTY;
        this.graph.dropEdge(edgeId);
        if (this.sigGraph) this.sigGraph.dropEdge(edgeId);
        recalculateMetrics.call(this);
    }

    edges() {
        return this.graph.edges.apply(this.graph, arguments);
    }

    clear() {
        this.status = ConcreteGraph.status.DIRTY;
        this.graph.clear();
        if (this.sigGraph) this.sigGraph.clear();
        this.nextId = 0;
        this.bounds = {
            xMax: 1000,
            yMax: 1000,
            xMin: -1000,
            yMin: -1000
        };
        updateBounds.call(this);
        recalculateMetrics.call(this);
        return this;
    }

    read(obj) {
        this.status = ConcreteGraph.status.DIRTY;
        this.clear();
        this.graph.import(obj);

        for (let nId of this.graph.nodes()) {
            this.nextId = Math.max(this.nextId + 1, Number(nId));
            if (this.sigGraph) {
                let node = this.graph.getNodeAttributes(nId);
                node.label = node.label + "";
                this.sigGraph.addNode(node);
            }
        }
        if (this.sigGraph) {
            for (let eId of this.graph.edges()) {
                let [sourceId, targetId] = this.graph.extremities(eId);
                let edge = this.graph.getEdgeAttributes(eId);
                let sigEdge = {
                    id: String(eId),
                    source: String(sourceId),
                    target: String(targetId),
                    size: edge.size,
                    color: edge.color
                };
                this.sigGraph.addEdge(sigEdge);
            }
        }

        updateBounds.call(this);
        recalculateMetrics.call(this);
    }

    neighbors() {
        return this.graph.neighbors.apply(this.graph, arguments);
    }
    hasEdge(sourceId, targetId) {
        return (
            this.graph.hasEdge(sourceId, targetId) ||
            this.graph.hasEdge(targetId, sourceId)
        );
    }
    restoreFrom(concreteGraphObj) {
        let cg = concreteGraphObj;
        this.options = { ...cg.options };
        this.bounds = { ...cg.bounds };
        this.nextId = cg.nextId;
        this.requireEdgeLengthPerc = cg.requireEdgeLengthPerc;
        this.metricsParam = { ...cg.metricsParam };
        this.weights = { ...cg.weights };
        this.metricsCache = { ...cg.metricsCache };
        this.normalMetrics = { ...cg.normalMetrics };
        this.minDist = cg.minDist;
        this.maxDist = cg.maxDist;
        this.nodesWithAngles = cg.nodesWithAngles;

        this.metricsPerNode = {};
        // TODO: remove this from the code. It's just too big!
        this.edgeCrossingCache = {};
        for (let k in cg.metricsPerNode) {
            this.metricsPerNode[k] = { ...cg.metricsPerNode[k] };
        }
        this.status = ConcreteGraph.status.COMPUTED;

        this.graph.clear();
        this.graph.import(concreteGraphObj.graph);
        return this;
    }
    toJSON() {
        let serialized = {};

        for (const k in this) {
            if (k !== "graph") {
                serialized[k] = deepCopy(this[k]);
            } else if (Object.keys(this[k]).length) {
                serialized[k] = this[k].toJSON();
            }
        }
        return serialized;
    }

    toSigGraph() {
        let nodes = [];
        let edges = [];
        for (const nId of this.nodes()) {
            let node = Object.assign({}, this.graph.getNodeAttributes(nId));
            nodes.push(node);
        }
        for (const eId of this.edges()) {
            let edge = Object.assign({}, this.graph.getEdgeAttributes(eId));
            edges.push(edge);
        }

        return { nodes, edges };
    }
}
ConcreteGraph.status = {
    COMPUTED: 0, // metrics are up to data with the graph
    DIRTY: 1 // metrics and graph are out of sync (require recomputing the metrics)
};

// internal methods that must be called with a ConcreteGraph object as the context
function recalculateMetrics() {
    console.trace("recalculateMetrics trace");
    console.time("recalculateMetrics time");
    this.metricsPerNode = {};
    this.metricsCache = {
        nodeOcclusion: 0,
        edgeNodeOcclusion: 0,
        edgeLength: 0,
        edgeCrossing: 0,
        angularResolution: 0
    };
    this.normalMetrics = {
        nodeOcclusion: 0,
        edgeNodeOcclusion: 0,
        edgeLength: 0,
        edgeCrossing: 0,
        angularResolution: 0
    };
    this.edgeCrossingCache = {};
    this.nodesWithAngles = 0;

    for (let nId of this.graph.nodes()) {
        let nodeMetrics = {
            nodeOcclusion: 0,
            angularResolution: 0,
            edgeNodeOcclusion: 0,
            edgeLength: 0,
            edgeCrossing: 0
        };
        // update indexes
        this.nodesWithAngles += this.graph.neighbors(nId).length > 1 ? 1 : 0;

        // recalculate nodeOcclusion
        if (this.weights.nodeOcclusion > 0) {
            nodeMetrics.nodeOcclusion = evaluator.nodeNodeOcclusion(
                this.graph,
                nId,
                this.minDist
            );
        }

        // recalculate angularResolution
        if (this.weights.angularResolution > 0) {
            nodeMetrics.angularResolution += evaluator.angularResolution(
                this.graph,
                nId
            );
        }

        // recalculate edge metrics
        // outEdges is only really needed for edgeLength. TODO: find a better way
        for (let eId of this.graph.outEdges(nId)) {
            if (this.weights.edgeLength > 0) {
                this.metricsCache.edgeLength += evaluator.edgeLength(
                    this.graph,
                    eId,
                    this.metricsParam.requiredEdgeLength * this.maxDist,
                    this.minDist
                );
            }

            // recalculate edgeCrossing
            if (this.weights.edgeCrossing > 0) {
                // what edges does this edge cross?
                let cross = evaluator.edgeCrossing(this.graph, eId);

                for (let ecId in cross) {
                    // first time we are tracking this edge?
                    if (!this.edgeCrossingCache[eId])
                        this.edgeCrossingCache[eId] = {};

                    // did we account for this intersection before?
                    if (!this.edgeCrossingCache[eId][ecId]) {
                        // add to own entry
                        this.edgeCrossingCache[eId][ecId] = 1;
                        // let the other edge know that it has a new intersection
                        if (!this.edgeCrossingCache[ecId])
                            this.edgeCrossingCache[ecId] = {};

                        this.edgeCrossingCache[ecId][eId] = 1;
                        // update the total count
                        this.metricsCache.edgeCrossing++;
                    }
                }
            }
            // recalculate edgeNodeOcclusion
            if (this.weights.edgeNodeOcclusion > 0) {
                this.metricsCache.edgeNodeOcclusion += evaluator.edgeNodeOcclusion(
                    this.graph,
                    eId,
                    this.minDist
                );
            }
        }
        this.metricsPerNode[nId] = nodeMetrics;
        for (let m in this.metricsCache)
            this.metricsCache[m] += this.metricsPerNode[nId][m];
    }

    this.status = ConcreteGraph.status.COMPUTED;
    console.timeEnd("recalculateMetrics time");
}
function updateMetrics(nodeId, oldPos) {
    this.metricsPerNode[nodeId].nodeOcclusion = 0;
    this.metricsCache.nodeOcclusion = 0;
    this.nodesWithAngles = 0;

    let node = this.graph.getNodeAttributes(nodeId);

    for (let nId of this.graph.nodes()) {
        // update indexes
        this.nodesWithAngles += this.graph.neighbors(nId).length > 1 ? 1 : 0;

        if (nodeId !== nId) {
            // remove old value from other node sum
            let n = this.graph.getNodeAttributes(nId);
            let oldD = distance(oldPos, n);
            oldD = Math.max(oldD, this.minDist);
            this.metricsPerNode[n.id].nodeOcclusion -= 1 / oldD ** 2;

            // add the new distance
            let newD = distance(node, n);
            newD = Math.max(newD, this.minDist);
            this.metricsPerNode[n.id].nodeOcclusion += 1 / newD ** 2;
            // update the total sum for nodeOcclusion
            this.metricsCache.nodeOcclusion += this.metricsPerNode[
                n.id
            ].nodeOcclusion;

            // update it's own contribution
            this.metricsPerNode[nodeId].nodeOcclusion += 1 / newD ** 2;
        }
    }
    // update the total sum for nodeOcclusion
    this.metricsCache.nodeOcclusion += this.metricsPerNode[
        nodeId
    ].nodeOcclusion;

    let nodeMetrics = this.metricsPerNode[nodeId];
    // update angular resolution for the current node

    this.metricsCache.angularResolution -= this.metricsPerNode[
        nodeId
    ].angularResolution;
    nodeMetrics.angularResolution = evaluator.angularResolution(
        this.graph,
        nodeId
    );
    this.metricsCache.angularResolution += this.metricsPerNode[
        nodeId
    ].angularResolution;

    nodeMetrics.edgeCrossing = 0;
    for (let eId of this.graph.edges(nodeId)) {
        // make sure to update the edgelength of connected sources
        let [sourceId, targetId] = this.graph.extremities(eId);
        let distTo = this.graph.getNodeAttributes(
            targetId === nodeId ? sourceId : targetId
        );
        this.metricsCache.edgeLength -=
            (this.metricsParam.requiredEdgeLength * this.maxDist -
                distance(oldPos, distTo)) **
            2;

        let d = distance(this.getNodeAttributes(nodeId), distTo);
        Math.min(d, this.minDist);
        this.metricsCache.edgeLength +=
            (this.metricsParam.requiredEdgeLength * this.maxDist - d) ** 2;

        // make sure to update the angular resolution of the connected nodes
        let otherNodeId = this.graph.target(eId);
        if (otherNodeId === nodeId) otherNodeId = this.graph.source(eId);

        this.metricsCache.angularResolution -= this.metricsPerNode[
            otherNodeId
        ].angularResolution;
        this.metricsPerNode[
            otherNodeId
        ].angularResolution = evaluator.angularResolution(
            this.graph,
            otherNodeId
        );
        this.metricsCache.angularResolution += this.metricsPerNode[
            otherNodeId
        ].angularResolution;

        if (this.edgeCrossingCache[eId]) {
            // remove the current edge from the total
            this.metricsCache.edgeCrossing -= Object.keys(
                this.edgeCrossingCache[eId]
            ).length;

            // remove current edge from the other crossed edges
            // needed when those edges get modified
            for (let ecId in this.edgeCrossingCache[eId]) {
                delete this.edgeCrossingCache[ecId][eId];
            }
        }
        // get new intersections and update other edges
        this.edgeCrossingCache[eId] = evaluator.edgeCrossing(this.graph, eId);

        for (let ecId in this.edgeCrossingCache[eId]) {
            if (!this.edgeCrossingCache[ecId])
                this.edgeCrossingCache[ecId] = {};
            this.edgeCrossingCache[ecId][eId] = 1;
            this.metricsCache.edgeCrossing++;
        }
    }
    this.status = ConcreteGraph.status.COMPUTED;
}

function updateBounds() {
    let b = this.getBoundaries();

    if (
        !this.withinBounds(b.xMax, b.yMax) ||
        !this.withinBounds(b.xMin, b.yMin)
    ) {
        this.bounds = {
            xMax: Math.max(this.bounds.xMax, b.xMax),
            yMax: Math.max(this.bounds.yMax, b.yMax),
            xMin: Math.min(this.bounds.xMin, b.xMin),
            yMin: Math.min(this.bounds.yMin, b.yMin)
        };
    }
    this.maxDist = distance(
        { x: this.bounds.xMax, y: this.bounds.yMax },
        { x: this.bounds.xMin, y: this.bounds.yMin }
    );
}

function toSigNode(node) {
    let n = this.graph.getAttributes(node);
    return n;
}
