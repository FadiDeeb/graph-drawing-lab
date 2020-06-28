import { ConcreteGraph, generateGraph } from "./graph.js";
import {
    refreshScreen,
    distance,
    getEdgeId,
    cleanId,
    deepCopy
} from "./util.js";
import * as evaluator from "./metrics.js";

import { CircularLayout } from "./circularLayout.js";
import { HillClimbing } from "./hillClimbing.js";
import { Table } from "./table";
const headers = [
    { id: "status", title: "Status", visible: true },
    { id: "filename", title: "Filename", visible: true },
    { id: "executionTime", title: "execution time", visible: true },
    { id: "evaluatedSolutions", title: "evaluated solutions", visible: true },
    { id: "layout", title: "Layout", visible: true },
    { id: "nodes", title: "Nodes", visible: true },
    { id: "edges", title: "Edges", visible: true },
    { id: "density", title: "Density", visible: true },
    { id: "nodeOcclusion", title: "Node occlusion", visible: true },
    { id: "edgeNodeOcclusion", title: "Edge-Node occlusion", visible: true },
    { id: "edgeLength", title: "Edge length", visible: true },
    { id: "edgeCrossing", title: "Edge crossing", visible: true },
    { id: "angularResolution", title: "Angular Resolution", visible: true },
    { id: "objective", title: "Objective", visible: true }
];

const digits = 3;
const layouts = {
    hillClimbing: {
        name: "hillClimbing",
        displayName: "Hill Climbing",
        params: [
            {
                type: "number",
                name: "iterations",
                value: 500,
                displayName: "Max Iterations"
            },
            {
                type: "number",
                name: "squareSize",
                value: 100,
                displayName: "Square Size"
            }
        ]
    },
    tabu: {
        name: "tabu",
        displayName: "Tabu Search",
        params: [
            {
                type: "number",
                name: "iterations",
                value: 500,
                displayName: "Max Iterations"
            },
            {
                type: "number",
                name: "squareSize",
                value: 100,
                displayName: "Square Size"
            },
            {
                type: "list",
                name: "selectionStrategy",
                displayName: "Selection Strategy",
                options: [
                    { name: "bestWorst", displayName: "Best and Worst" },
                    { name: "bestSecond", displayName: "Best and Second Best" },
                    { name: "random", displayName: "Random" },
                    { name: "mostDistance", displayName: "Most Distance" }
                ],
                selectedOptionIndex: 2
            }
        ]
    },
    circular: {
        name: "circular",
        displayName: "Circular",
        params: [
            {
                type: "number",
                name: "maxIterations",
                value: 1000,
                displayName: "Max Iterations"
            },
            {
                type: "number",
                name: "radius",
                value: 450,
                displayName: "Radius"
            }
        ]
    }
};

function createLayoutList(selectedLayout) {
    let htmlOptions = "";
    for (const [name, { displayName }] of Object.entries(layouts)) {
        htmlOptions += `<option value="${name}" ${
            name === selectedLayout ? "selected" : ""
        }>${displayName}</option>`;
    }
    let selectHtml = `
        <select name="layoutAlg" id="layoutAlgList">
        ${htmlOptions}
        </select>
    `;
    return selectHtml;
}
function createLayoutParam(params) {
    function createItemWrapper(item) {
        return `<div class="menu-item-group">
            <div class="menu-item">
                ${item}
            </div>
        </div>`;
    }

    function createInputParam({ name, displayName, value }) {
        let inputHtml = `<div class=param-input-label>${displayName}</div>
            <input type="number" name="${name}" class="param-input" id="${name}" value="${value}" </input>
            `;
        return inputHtml;
    }
    function createSelectParam({
        name,
        displayName,
        selectedOptionIndex,
        options
    }) {
        let htmlOptions = "";
        for (let i = 0; i < options.length; i++) {
            const { name, displayName } = options[i];
            htmlOptions += `<option value="${name}" ${
                selectedOptionIndex === i ? "selected" : ""
            }>${displayName}</option>`;
        }

        let selectHtml = `<div class=param-input-label>${displayName}</div>
            <select name="${name}">${htmlOptions}</select>

            `;

        return selectHtml;
    }

    let html = "";
    for (const param of params) {
        let paramHtml = "";
        if (param.type === "number") paramHtml = createInputParam(param);
        else if (param.type === "list") paramHtml = createSelectParam(param);
        html += createItemWrapper(paramHtml);
    }
    return html;
}

function createTabEl(title, tabId) {
    let html = `
            <div class="tab-item" id="tab-${tabId}">
                ${title}
                ${
                    // prevent the default tab from being deleted
                    tabId !== tabs[0].id
                        ? `<span class="fas fa-times tab-close-icon"></span>`
                        : ``
                }
             </div> 
            `;
    return html;
}

function createTabContent({ id, layout }) {
    let html = `
            <div class="tab-content" id="tab-content-${id}">
                <div class="param-container">
                    <div class="dropdown" id="layoutAlg">
                        <span>Layout Algorithm: </span>
                        ${createLayoutList(layout)}

                    </div>

                    <div class="param-list">
                    </div>

                </div>

            <div class="h-divider">

            </div>
                <div class="table-container">
                    <table class="run-table" id="table-${id}"><thead><tr></tr></thead><tbody></tbody></table>
                </div>
            </div>
   `;
    return html;
}
// util function

// Assume that id is after the last -
function getTabIdFromElId(id) {
    return id.split("-").pop();
}

function layoutParamHandler({ target }) {}

function addLayoutParam(layoutParam) {
    let layoutParamSec = document.querySelector("#menu-sec-layout-param");
    layoutParamSec.innerHTML = "";
    layoutParamSec.insertAdjacentHTML(
        "beforeend",
        createLayoutParam(layoutParam)
    );
    // add param layout event listener
}

function addNewTab(tabList, tab) {
    console.log("adding new tab", tab);
    // add the tab to the list of tabs
    tabList.push(tab);
    // add it to html tab list
    addTabEl(tab);
    // add html content
    addTabContentEl(tab);
}

// add new tab element and add it's tab before the new tab icon
// TODO: find a better name. This name conflicts with addNewTab
function addTabEl(tab) {
    let newTab = document.querySelector("#new-tab");
    newTab.insertAdjacentHTML("beforebegin", createTabEl(tab.title, tab.id));

    // add even listener to tab
    //tab  close event
}

function addTabContentEl(tab) {
    let tabContainer = document.querySelector("#tab-container");
    tabContainer.innerHTML = "";
    tabContainer.insertAdjacentHTML("beforeend", createTabContent(tab));

    const contentEl = document.querySelector(`#tab-content-${tab.id}`);

    addTable(tab);
    addSideMenuColSec(tab);
    addSideMenuMetricSec(tab);
    addLayoutParam(tab.layoutParam);

    // add event listener to layout algorithm list to update parameters on change
    let layoutAlgList = contentEl.querySelector("#layoutAlgList");
    layoutAlgList.onchange = ({ target }) => {
        tab.layout = target.value;
        tab.layoutParam = deepCopy(layouts[tab.layout].params);
        addLayoutParam(currentTab().layoutParam);
    };

    // add event listener for the table
    tabContainer.querySelector("table").onclick = ({ target }) => {
        let btn = null;
        let h = null;
        if (target.nodeName === "TH") {
            btn = target.querySelector("button");
            h = target.id;
        } else if (target.nodeName === "BUTTON") {
            btn = target;
            h = target.parentNode.id;
        }
        if (tab.table.getHeader(h)) {
            tab.table.sort(h, !(tab.table.sortClass === "sort-asc"));
            tab.table.refresh();
            tab.sortDirection = tab.table.sortClass;
            tab.sortHeader = h;
        }
    };
}

function addTable(tab) {
    let table = new Table(`table-${tab.id}`);
    tab.table = table;

    for (const h of tab.headers) {
        table.addHeader(h);
        if (h.visible === false) table.hideHeader(h.id);
    }

    for (const [filename, file] of Object.entries(tab.files)) {
        let graph = null;
        if (!file.concreteGraph) {
            graph = new ConcreteGraph(file.graph, {
                weights: tab.weights,
                metricsParam: tab.metricsParam
            });
        }
        let info = {
            evaluatedSolutions: file.info ? file.info.evaluatedSolutions : "-",
            executionTime: file.info ? file.info.executionTime : "-"
        };

        file.metrics = graph.metrics();
        file.objective = graph.objective();
        let {
            nodeOcclusion,
            edgeNodeOcclusion,
            edgeLength,
            edgeCrossing,
            angularResolution
        } = file.metrics;

        if (!file.originalMetrics) {
            file.originalMetrics = file.metrics;
            file.originalObjective = file.objective;
        }

        let row = {
            status: { value: file.status, type: "text" },
            filename: { value: filename, type: "text" },
            layout: {
                value: file.status !== "-" ? tab.layout : "-",
                type: "text"
            },
            nodes: { value: graph.nodes().length, type: "text" },
            edges: { value: graph.edges().length, type: "text" },
            executionTime: { value: info.executionTime, type: "text" },
            evaluatedSolutions: {
                value: info.evaluatedSolutions,
                type: "text"
            },
            density: { value: graph.density().toFixed(digits), type: "text" },
            nodeOcclusion: {
                value: nodeOcclusion.toFixed(digits),
                type: "text"
            },
            edgeNodeOcclusion: {
                value: edgeNodeOcclusion.toFixed(digits),
                type: "text"
            },
            edgeLength: { value: edgeLength.toFixed(digits), type: "text" },
            edgeCrossing: { value: edgeCrossing.toFixed(digits), type: "text" },
            angularResolution: {
                value: angularResolution.toFixed(digits),
                type: "text"
            },
            objective: {
                value: graph.objective().toFixed(digits),
                type: "text"
            }
        };

        table.addRow(row);
    }

    if (tab.sortHeader && tab.sortDirection !== "sort-neutral") {
        tab.table.sort(tab.sortHeader, tab.sortDirection === "sort-asc");
    }

    table.refresh();
}

function currentTab() {
    let activeTabElId = document.querySelector(".tab-active").id;
    return tabs.find(t => t.id === getTabIdFromElId(activeTabElId));
}

function switchTab(tab) {
    let tabEl = document.querySelector(`#tab-${tab.id}`);
    if (!tabEl) throw `no tab with id tab-${tab.id}`;

    let oldTabEl = document.querySelector(".tab-active");
    if (oldTabEl && oldTabEl !== tabEl) {
        let oldTabId = getTabIdFromElId(oldTabEl.id);
        oldTabEl.classList.remove("tab-active");
    }

    tabEl.classList.add("tab-active");

    addTabContentEl(tab);
}

let tabNum = 1;
let tabs = [];

const metricsParam = {
    requiredEdgeLength: 0.5
};
const weights = {
    nodeOcclusion: 1,
    edgeNodeOcclusion: 1,
    edgeLength: 1,
    edgeCrossing: 1,
    angularResolution: 1
};

// Assumes to be created in a loaded batchRun page (with side menu)
// TODO: add option to save tab to disk (save the run)
class Tab {
    constructor(title, otherTab) {
        let d = new Date();
        let date = `${d.getFullYear()}${d.getDate()}${d.getDate()}${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
        this.creationDate = date;
        this.table = null; // mainly used to control the sort
        this.id = `${date + Math.floor(Math.random() * 1000)}`;
        this.headers = deepCopy(otherTab ? otherTab.headers : headers);
        this.sortHeader = otherTab ? otherTab.sortHeader : null;
        this.sortDirection = otherTab ? otherTab.sortDirection : "sort-neutral";
        this.weights = deepCopy(otherTab ? otherTab.weights : weights);
        this.metricsParam = deepCopy(
            otherTab ? otherTab.metricsParam : metricsParam
        );
        

        this.files = {};
        if (otherTab) {
            // remove the computed graph from the current tab
            for (let [filename, file] of Object.entries(otherTab.files)) {
                this.files[filename] = {
                    graph: deepCopy(file.originalGraph),
                    originalGraph: deepCopy(file.originalGraph),
                    status: "-"
                };
                this.originalMetrics = null;
                this.originalObjective = null;
            }
        }

        this.runCount = 0;
        this.title = title;
        this.layoutParam = deepCopy(
            otherTab ? otherTab.layoutParam : layouts["hillClimbing"].params
        );
        this.metricsParam = deepCopy(
            otherTab ? otherTab.metricsParam : metricsParam
        );
        this.layout = otherTab ? otherTab.layout : "hillClimbing";
    }
    getTabContent() {
        let content = document.querySelector(`#tab-content-${this.id}`);
        return content;
    }
    // shallow copy save into the current object
    restoreFrom(saved) {
        Object.assign(this, saved);

        console.log(`restoring from save \n${saved}`, this);
        return this;
    }

    runTest(filename) {
        let options = {
            weights: this.weights,
            metricsParam: this.metricsParam,
            layoutParam: {}
        };
        for (let p of this.layoutParam) {
            options.layoutParam[p.name] = p.value;
        }
        let graphData = currentTab().files[filename].originalGraph;

        let worker = new Worker("build/layoutWorker.js");
        worker.postMessage([graphData, currentTab().layout, options, "run"]);

        currentTab().files[filename].status = "running";

        worker.onmessage = function(e) {
            this.files[filename].graph = e.data[0];
            this.files[filename].layout = e.data[1];
            this.files[filename].status = "done";
            this.files[filename].info = e.data[4];

            // TODO: Make sure the options are in sync with the ui
            currentTab().options = e.data[2];

            this.runCount--;

            if (!this.runCount) {
            }
            addTable(currentTab());
            worker.terminate();
        }.bind(this);
    }
    runBatch() {
        for (let filename in this.files) {
            this.runCount++;
            this.runTest(filename);
        }
        addTable(this);
    }
    clearBatch() {
        if (!this.runCount) {
            this.files = {};
            addTable(this);
        }
    }
}
function loadFile(filename, data) {
    /*
        loadedTests = {
            filename: {
                graph: origianlGraph,
                layout: layoutAlgUsed, // default is null
                originalMetrics:{),
                metrics:{}
            }
        }
    */
    let parsedData = JSON.parse(data);

    currentTab().files[filename] = {
        graph: parsedData.graph,
        originalGraph: deepCopy(parsedData.graph),
        status: "-"
    };
    addTable(currentTab());
}
// setup tab bar
let savedTabs = JSON.parse(localStorage.getItem("runs"));

if (savedTabs) {
    for (const tab of savedTabs) {
        let nTab = new Tab("new one");
        nTab.restoreFrom(tab);
        addNewTab(tabs, nTab);
    }

    switchTab(tabs[0]);
} else {
    let defaultTab = new Tab("Run 0");
    addNewTab(tabs, defaultTab);
    switchTab(defaultTab);
}

let tabList = document.querySelector(".tab-list");
tabList.addEventListener("click", event => {
    let el = event.target;
    // TODO: Limit how far you can click to create a new type to avoid miss-clicks
    if (el.classList.contains("tab-item")) {
        const selectedTab = tabs.find(t => t.id === getTabIdFromElId(el.id));
        switchTab(selectedTab);
    } else if (el.id === "new-tab") {
        // TODO: change this when you can delete tabs
        let prevTab = null;
        if (tabs.length > 0) prevTab = tabs[tabs.length - 1];
        let tab = new Tab(`Run ${tabs.length}`, prevTab);
        addNewTab(tabs, tab);
        switchTab(tab);
    } else if (el.classList.contains("tab-close-icon")) {
        let id = getTabIdFromElId(el.parentNode.id);
        let index = tabs.findIndex(e => e.id === id);
        tabs.splice(index, 1);
        index = index > 0 ? index - 1 : 0;
        el.parentNode.remove();
        if (el.parentNode.classList.contains("tab-active"))
            switchTab(tabs[index]);
    }
});

// end of tap stuff

// Add headers to show/hide side menu
// TODO: How will this interact with every table in every run?
//

function addSideMenuColSec(tab) {
    let menuColSecFrag = document.createDocumentFragment();
    for (const h of tab.headers) {
        let item = document.createElement("div");
        item.classList.add("menu-item-checkbox");
        let checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.checked = h.visible;
        checkbox.setAttribute("data-col", h.id);
        let label = document.createElement("p");
        label.innerHTML = h.title;

        item.appendChild(checkbox);
        item.appendChild(label);
        menuColSecFrag.appendChild(item);
    }
    let el = document.querySelector("#menu-sec-columns");
    el.innerHTML = "";
    el.appendChild(menuColSecFrag);
}

function createSideMenuMetricSec(tab) {
    const { weights, metricsParam } = tab;
    const {
        nodeOcclusion,
        edgeNodeOcclusion,
        edgeLength,
        edgeCrossing,
        angularResolution
    } = tab.weights;
    const { requiredEdgeLength } = tab.metricsParam;
    let html = `
    <div class="menu-item-group">
        <div class="menu-item">
            <p>Node occlusion</p>
        </div>

        <div class="menu-item">
            <p>Weight</p>
            <input type="number" class="weight-input" id="node-occlusion-weight" value="${nodeOcclusion}" step="0.01"
                min="0" max="1" />
        </div>

    </div>
    <div class="menu-item-group">
        <div class="menu-item">
            <p>Edge node occlusion:</p>
        </div>
        <div class="menu-item">
            <p>Weight</p>
            <input type="number" class="weight-input" id="edge-node-occlusion-weight" value="${edgeNodeOcclusion}" step="0.01"
                min="0" max="1" />
        </div>

    </div>
    <div class="menu-item-group">
        <div class="menu-item">
            <p>Edge length</p>
        </div>

        <div class="menu-item">
            <p>Weight</p>
            <input type="number" class="weight-input" id="edge-length-weight" value="${edgeLength}" step="0.01" min="0"
                max="1" />
        </div>

        <div class="menu-item">
            <p>Required length</p>
            <input type="number" id="edge-length-required" value="${requiredEdgeLength}" step="0.01" min="0" max="1" />
        </div>

    </div>

    <div class="menu-item-group">
        <div class="menu-item">
            <p>Edge crossing</p>
        </div>
        <div class="menu-item">
            <p>Weight</p>
            <input type="number" class="weight-input" id="edge-crossing-weight" value="${edgeCrossing}" step="0.01"
                min="0" max="1" />
        </div>

    </div>
    <div class="menu-item-group">
        <div class="menu-item">
            <p>Angular resolution</p>
        </div>
        <div class="menu-item">
            <p>Weight</p>
            <input type="number" class="weight-input" id="angular-resolution-weight" value="${angularResolution}" step="0.01"
                min="0" max="1" />
        </div>
    </div>
    `;
    return html;
}

function addSideMenuMetricSec(tab) {
    let el = document.querySelector("#menu-sec-metrics");
    el.innerHTML = "";
    el.insertAdjacentHTML("beforeend", createSideMenuMetricSec(tab));
}

// eslint-disable-next-line no-undef
const sig = new sigma();

// tool bar
const toolbar = document.querySelector(".toolbar-container"),
    sideMenu = document.querySelector("#side-menu");

toolbar.addEventListener("click", toolbarClickHandler);
function toolbarClickHandler(event) {
    let target = event.target;
    switch (target.id) {
        case "menu":
            sideMenu.classList.toggle("hidden");
            break;
        case "genTest":
            genModal.style.display = "flex";
            break;
        case "saveTest":
            break;
        case "loadFile":
            openFileDialog(loadFile);
            break;
        case "batchRunTest":
            currentTab().runBatch();
            break;
        case "backToMain":
            window.location.replace("index.html");
            break;
        case "clearTest":
            localStorage.removeItem("runs");
            window.location.replace("batchRun.html");
            break;
        case "summary":
            // save tabs to local storage
            localStorage.setItem("runs", JSON.stringify(tabs));
            window.location.replace("summary.html");
            break;
        default:
            break;
    }
}
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

const genModal = document.querySelector("#gen-modal"),
    genMode = document.querySelector("#gen-mode"),
    nodeNumMinEl = document.querySelector("#node-num-min"),
    nodeNumMaxEl = document.querySelector("#node-num-max"),
    nodeError = document.querySelector("#node-error"),
    edgeNumMinEl = document.querySelector("#edge-num-min"),
    edgeNumMaxEl = document.querySelector("#edge-num-max"),
    testNumEl = document.querySelector("#test-num"),
    edgeError = document.querySelector("#edge-error");

genModal.addEventListener("click", event => {
    const target = event.target;

    switch (target.id) {
        case "generate":
            let maxEdges = null;
            let nodeNumMin = parseInt(nodeNumMinEl.value),
                edgeNumMin = parseInt(edgeNumMinEl.value),
                nodeNumMax = parseInt(nodeNumMaxEl.value),
                edgeNumMax = parseInt(edgeNumMaxEl.value),
                testNum = parseInt(testNumEl.value);

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
            // TODO: Remove hardcoded values
            let G = genTest(
                testNum,
                nodeNumMin,
                nodeNumMax,
                edgeNumMin,
                edgeNumMax,
                1900,
                1300
            );
            genModal.style.display = "none";
            break;
        case "dismiss":
            genModal.style.display = "none";
            break;
    }
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
sideMenu
    .querySelector("#menu-sec-columns")
    .addEventListener("change", ({ target }) => {
        let table = currentTab().table;
        let colId = target.getAttribute("data-col");

        // sync ui with data
        let header = currentTab().headers.find(({ id }) => id === colId);
        header.visible = target.checked;

        addTable(currentTab());
    });

sideMenu
    .querySelector("#menu-sec-metrics")
    .addEventListener("change", event => {
        let table = currentTab().table;

        let options = { weights: getWeights(), metricsParam };

        currentTab().weights = getWeights();
        currentTab().metricsParam = {
            requiredEdgeLength: parseFloat(
                document.querySelector("#edge-length-required").value
            )
        };
    });

sideMenu
    .querySelector("#menu-sec-layout-param")
    .addEventListener("change", ({ target }) => {
        let type = target.nodeName;
        let param = currentTab().layoutParam.find(e => e.name === target.name);

        if (type === "INPUT") {
            param.value = Number(target.value);
        } else {
            let index = param.options.findIndex(e => e.name === target.value);
            param.selectedOptionIndex = index;
        }
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

function genTest(testNum, nMin, nMax, eMin, eMax, width, height) {
    // TODO: Make this async

    while (testNum--) {
        let G = generateGraph(nMin, nMax, eMin, eMax, height, width);
        let obj = {
            graph: G.toJSON()
        };
        let json = JSON.stringify(obj);
        // eslint-disable-next-line no-undef
        saveFile(json);
    }
}

window.tabs = tabs;
