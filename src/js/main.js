// sigam.js imports
/*global sigma*/

import { ConcreteGraph, generateGraph } from "./graph.js";
import { refreshScreen, distance, getEdgeId } from "./util.js";

let container = document.querySelector("#container");
let canvasRenderer = {
    container: "container",
    type: "canvas",
    camera: "cam1",
    settings: {
        enableEdgeHovering: true,
        edgeHoverColor: "edge",
        edgeHoverSizeRatio: 1.6
    }
};
let webglRenderer = {
    type: "webgl",
    camera: "cam1",
    container: "container"
};

const edgeSize = 1.5;
const nodeSize = 10;

let sigDefaults = {
    renderer: webglRenderer,
    settings: {
        doubleClickEnabled: false,
        autoRescale: false
    }
};
// create the main sigma instance
let sig = new sigma(sigDefaults);
let cam = sig.cameras.cam1;

// create the main graph instance
let GRAPH = new ConcreteGraph(sig.graph);

let r = Math.min(container.offsetWidth, container.offsetHeight);

// create graph layout
let customLayout = new sigma.CustomLayout(sig);
// UI events

// create an object to use to track select and drag operations
// using constructor function so we can selectively expose methods
let graphUiModes = (function() {
    let selectedNode = null;
    let selectedEdge = null;
    let dragStartPos = null;
    let dragEndPos = null;
    let dragThreshold = 5;
    let drag = null;

    function selectNode(node) {
        node.color = "#c52";
        selectedNode = node;

        refreshScreen(sig, updateMetrics);
    }
    function deSelectNode(node) {
        if (node) {
            selectedNode.color = "#921";
            selectedNode = null;
            refreshScreen(sig, updateMetrics);
        }
    }

    function dragSupport(state) {
        if (state) {
            let dragListener = sigma.plugins.dragNodes(sig, sig.renderers[0]);

            dragListener.bind("startdrag", e => {
                drag = false;
                dragStartPos = {
                    x: e.data.node.x,
                    y: e.data.node.y
                };
            });

            dragListener.bind("drag", e => {
                dragEndPos = {
                    x: e.data.node.x,
                    y: e.data.node.y
                };
                // register the movement as a drag operation
                if (distance(dragStartPos, dragEndPos) >= dragThreshold)
                    drag = true;
            });
            dragListener.bind("dragend", e => {
                // make sure to update metrics after a node drag
                updateMetrics(sig);
            });
        } else {
            sigma.plugins.killDragNodes(sig);
        }
    }

    let clickCount = 0;
    function clickStageHandler() {
        // the camera starts at the center of the canvas
        // it is treated as the origin and the coordinates are added to it when the nodes are rendered (when autoRescale is false)
        // to get the desired position we subtract away the initial coordinate of the camera
        let x = event.offsetX - container.offsetWidth / 2;
        let y = event.offsetY - container.offsetHeight / 2;

        // get x,y after applying the same transformation that were applied to the camera
        let p = cam.cameraPosition(x, y);

        let id = sig.graph.getNodesCount();
        let n = {
            label: id,
            id: id,
            x: p.x,
            y: p.y,
            size: nodeSize,
            color: "#921"
        };

        sig.graph.addNode(n);
        refreshScreen(sig, updateMetrics);
    }
    function nodeSelectHandler(e) {
        let node = e.data.node;
        if (!selectedNode) {
            selectNode(node);
        } else if (selectedNode.id !== node.id) {
            // create an edge if non existed between them
            if (!sig.graph.allNeighbors(node)[selectedNode.id]) {
                sig.graph.addEdge({
                    id: getEdgeId(selectedNode, node),
                    source: selectedNode.id,
                    target: node.id,
                    size: edgeSize,
                    color: "#ccc"
                });

                deSelectNode(selectedNode);
            } else {
                // jump to the other node
                deSelectNode(selectedNode);
                selectNode(node);
            }
        }
    }
    function nodeEraseHandler(e) {
        let clickedNode = e.data.node;
        sig.graph.dropNode(clickedNode.id);
        refreshScreen(sig, updateMetrics);
    }
    function edgeEraseHandler(e) {
        let clickedEdge = e.data.edge;
        sig.graph.dropEdge(clickedEdge.id);
        refreshScreen(sig, updateMetrics);
    }
    if (selectedEdge) sig.graph.dropEdge(selectedEdge.id);

    // expose public methods
    // map each mode item id to their activation method (toggle edit mode on and off)
    return {
        moveNode(state = true) {
            if (state) {
                dragSupport(true);
                moveNodeItem.classList.add("active");
            } else {
                dragSupport(false);
                moveNodeItem.classList.remove("active");
            }
        },
        addNode(state = true) {
            if (state) {
                sig.settings("enableCamera", false);
                sig.bind("clickStage", clickStageHandler);
                addNodeItem.classList.add("active");
            } else {
                sig.unbind("clickStage");
                sig.settings("enableCamera", true);
                addNodeItem.classList.remove("active");
            }
        },
        addEdge(state = true) {
            if (state) {
                sig.bind("clickNode", nodeSelectHandler);
                addEdgeItem.classList.add("active");
            } else {
                sig.unbind("clickNode");
                addEdgeItem.classList.remove("active");
                if (selectedNode) deSelectNode(selectedNode);
            }
        },
        erase(state = true) {
            sig.killRenderer("0");
            if (state) {
                sig.unbind("clickStage");
                sig.unbind("clickEdge");
                sig.unbind("clickNode");
                sig.bind("clickNode", nodeEraseHandler);
                sig.bind("clickEdge", edgeEraseHandler);
                sig.settings("enableEdgeHovering", true);
                eraseItem.classList.add("active");
                sig.addRenderer(canvasRenderer);
            } else {
                sig.settings("enableEdgeHovering", false);
                sig.addRenderer(webglRenderer);
                eraseItem.classList.remove("active");
                sig.unbind("clickNode");
            }
            refreshScreen(sig, updateMetrics);
        }
    };
})(); // immediately execute the function to return the object

// tool bar
const genGraph = document.querySelector("#genGraph"),
    saveGraph = document.querySelector("#saveGraph"),
    loadGraph = document.querySelector("#loadGraph"),
    fileSelector = document.querySelector("#fileSelector"),
    deleteGraph = document.querySelector("#deleteGraph"),
    moveNodeItem = document.querySelector("#moveNode"),
    addNodeItem = document.querySelector("#addNode"),
    addEdgeItem = document.querySelector("#addEdge"),
    eraseItem = document.querySelector("#erase"),
    randomLayout = document.querySelector("#randomLayout"),
    runLayout = document.querySelector("#runLayout"),
    stepLayout = document.querySelector("#stepLayout"),
    toolbar = document.querySelector(".toolbar-container"),
    sideMenu = document.querySelector("#side-menu");

toolbar.addEventListener("click", event => {
    let target = event.target;

    // handle mode change
    let modes = graphUiModes;
    let isActive = target.classList.contains("active");
    if (!isActive) {
        // deactivate any active mode
        let active = document.querySelector(".active");
        if (active) {
            modes[active.id](false);
        }
        // select it if was a mode item
        if (target.id in modes) modes[target.id](true);
    } else {
        modes[target.id](false);
    }

    switch (target.id) {
        case "menu":
            if (sideMenu.style.display === "flex") {
                sideMenu.style.display = "none";
            } else {
                sideMenu.style.display = "flex";
            }
            break;
        case "genGraph":
            if (!sig.graph.nodes().length) genModal.style.display = "flex";
            else {
                warnModal.style.display = "flex";
            }
            break;
        case "saveGraph":
            saveCurrentGraph();

            break;
        case "loadGraph":
            // eslint-disable-next-line no-undef
            openFileDialog((filename, data) => {
                sig.graph.clear();
                sig.graph.read(JSON.parse(data).graph);
                refreshScreen(sig, updateMetrics);
            });
            break;
        case "deleteGraph":
            sig.graph.clear();
            refreshScreen(sig, updateMetrics);
            break;
        case "randomLayout":
            const x = container.offsetWidth;
            const y = container.offsetHeight;
            sig.graph.nodes().forEach(n => {
                n.x = (0.5 - Math.random()) * x;
                n.y = (0.5 - Math.random()) * y;
            });
            refreshScreen(sig, updateMetrics);

            break;
        case "runLayout":
            customLayout.run();
            refreshScreen(sig, updateMetrics);

            break;
        case "stepLayout":
            customLayout.step();
            refreshScreen(sig, updateMetrics);
            break;
        case "resetLayout":
            break;
        case "testingPage":
            window.location.replace("testing.html");

            break;

        default:
            break;
    }
});

const genModal = document.querySelector("#gen-modal"),
    warnModal = document.querySelector("#warn-modal"),
    genMode = document.querySelector("#gen-mode"),
    nodeNumMinEl = document.querySelector("#node-num-min"),
    nodeNumMaxEl = document.querySelector("#node-num-max"),
    nodeError = document.querySelector("#node-error"),
    edgeNumMinEl = document.querySelector("#edge-num-min"),
    edgeNumMaxEl = document.querySelector("#edge-num-max"),
    edgeError = document.querySelector("#edge-error");
genModal.addEventListener("click", event => {
    const target = event.target;

    switch (target.id) {
        case "generate":
            let maxEdges = null;
            let nodeNumMin = parseInt(nodeNumMinEl.value),
                edgeNumMin = parseInt(edgeNumMinEl.value),
                nodeNumMax = parseInt(nodeNumMaxEl.value),
                edgeNumMax = parseInt(edgeNumMaxEl.value);

            // toggle any existing error messages
            nodeError.innerHTML = "";
            nodeError.style.display = "none";
            edgeError.innerHTML = "";
            edgeError.style.display = "none";

            if (genMode.value === "range") {
                maxEdges = (nodeNumMax * (nodeNumMax - 1)) / 2;
                if (nodeNumMax < nodeNumMin || !nodeNumMin || !nodeNumMax) {
                    nodeError.innerHTML = "Max is less than min!";
                    nodeError.style.display = "block";
                    break;
                }
                if (edgeNumMax < edgeNumMin || !edgeNumMin || !edgeNumMax) {
                    edgeError.innerHTML = "Max is less than min!";
                    edgeError.style.display = "block";
                    break;
                }
            } else {
                maxEdges = (nodeNumMin * (nodeNumMin - 1)) / 2;
                nodeNumMax = nodeNumMin;
                edgeNumMax = edgeNumMin;
            }

            if (nodeNumMin < 1 || !nodeNumMin) {
                nodeError.innerHTML = "Can't have less than 1 nodes";
                nodeError.style.display = "block";
                break;
            }
            if (edgeNumMin < nodeNumMin - 1 || !edgeNumMin) {
                edgeError.innerHTML = `Can't have less than ${nodeNumMin -
                    1} edges `;
                edgeError.style.display = "block";
                break;
            }
            if (edgeNumMax > maxEdges || !edgeNumMin) {
                edgeError.innerHTML = `Can't have more than ${maxEdges} edges`;
                edgeError.style.display = "block";
                break;
            }
            let G = generateGraph(
                nodeNumMin,
                nodeNumMax,
                edgeNumMin,
                edgeNumMax,
                container.offsetWidth,
                container.offsetHeight
            );

            sig.graph.clear();
            // extract the nodes and edges from the created graph and update the current instance with it
            sig.graph.read({ nodes: G.nodes(), edges: G.edges() });
            refreshScreen(sig, updateMetrics);
            genModal.style.display = "none";
            break;
        case "dismiss":
            genModal.style.display = "none";
            break;
    }
});
warnModal.addEventListener("click", event => {
    const target = event.target;

    switch (target.id) {
        case "save":
            warnModal.style.display = "none";
            saveCurrentGraph();
            sig.graph.clear();
            refreshScreen(sig, updateMetrics);
            genModal.style.display = "flex";
            break;
        case "delete":
            warnModal.style.display = "none";
            sig.graph.clear();
            refreshScreen(sig, updateMetrics);
            genModal.style.display = "flex";
            break;
    }
});

fileSelector.addEventListener("change", function handleFiles(event) {
    let files = event.target.files;
    let reader = new FileReader();

    // eslint-disable-next-line no-undef
});
genMode.addEventListener("change", event => {
    // toggle any existing error messages
    nodeError.innerHTML = "";
    nodeError.style.display = "none";
    edgeError.innerHTML = "";
    edgeError.style.display = "none";

    if (event.target.value === "range") {
        nodeNumMaxEl.style.display = "inline";
        edgeNumMaxEl.style.display = "inline";
    } else {
        nodeNumMaxEl.style.display = "none";
        edgeNumMaxEl.style.display = "none";
        nodeNumMaxEl.value = null;
        edgeNumMaxEl.value = null;
    }
});

// side menu events
sideMenu.addEventListener("change", event => {
    updateObjective();
});

let toggleEl = document.querySelectorAll(".menu-section-label");
for (const e of toggleEl) {
    e.onclick = function() {
        let secId = this.getAttribute("data-section");
        let secEl = document.querySelector(`#${secId}`);
        let t = this.querySelector(".menu-section-toggle");
        if (t.classList.contains("arrow-right")) {
            t.classList.remove("arrow-right");
            t.style.animationDirection = "reverse";
            t.classList.add("arrow-down");
            secEl.style.display = "block";
        } else {
            t.classList.remove("arrow-down");
            t.style.animationDirection = "normal";
            t.style.animationPlayState = "running";
            t.classList.add("arrow-right");
            secEl.style.display = "none";
        }
        var newOne = t.cloneNode(true);
        t.parentNode.replaceChild(newOne, t);
    };
}

// return string to use for edge id
function saveCurrentGraph() {
    let json = JSON.stringify({
        graph: {
            nodes: sig.graph.nodes(),
            edges: sig.graph.edges()
        }
    });

    // eslint-disable-next-line no-undef
    saveFileDialog(json);
}

refreshScreen(sig, updateMetrics);

function getWeights() {
    return {
        nodeOcclusion: parseFloat(
            document.querySelector("#node-occlusion-weight").value
        ),
        edgeNodeOcclusion: parseFloat(
            document.querySelector("#edge-node-occlusion-weight").value
        ),
        edgeLength: parseFloat(
            document.querySelector("#edge-length-weight").value
        ),
        edgeCrossing: parseFloat(
            document.querySelector("#edge-crossing-weight").value
        ),
        angularResolution: parseFloat(
            document.querySelector("#angular-resolution-weight").value
        )
    };
}
function updateObjective() {
    document.querySelector(
        "#objective-function"
    ).innerHTML = GRAPH.objective().toFixed(3);
}

function updateMetrics() {
    // create concrete graph or update existing one
    GRAPH.setGraph(sig.graph);
    // configure it's evaluator

    GRAPH.evaluator.weights = getWeights();

    // get the needed parameters
    let c = document.querySelector(".sigma-scene");
    let maxLen = Math.sqrt(c.width * c.width + c.height * c.height);
    GRAPH.evaluator.setParam("maxEdgeLength", maxLen);

    // calculate the needed metrics
    let metrics = GRAPH.metrics();
    // update ui
    document.querySelector("#node-num").innerHTML = GRAPH.nodes().length;
    document.querySelector("#edge-num").innerHTML = GRAPH.edges().length;
    document.querySelector("#density").innerHTML = GRAPH.density().toFixed(3);
    document.querySelector(
        "#node-occlusion"
    ).innerHTML = metrics.nodeOcclusion.toFixed(3);
    document.querySelector(
        "#edge-node-occlusion"
    ).innerHTML = metrics.edgeNodeOcclusion.toFixed(3);

    document.querySelector(
        "#edge-length"
    ).innerHTML = metrics.edgeLength.toFixed(3);
    document.querySelector(
        "#edge-cross"
    ).innerHTML = metrics.edgeCrossing.toFixed(3);
    document.querySelector(
        "#angular-resolution"
    ).innerHTML = metrics.angularResolution.toFixed(3);

    updateObjective();
}
